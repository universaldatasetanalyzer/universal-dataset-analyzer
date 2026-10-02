const path = require('path');
const fs = require('fs');
const { query } = require('../db');
const { analyzeDataset } = require('../services/analysis');
const { createNotification } = require('../services/notifications');
const { deleteObject, putFile, readBuffer } = require('../services/storage');

async function getDatasetWithAccess(datasetId, userId) {
  const result = await query(
    `SELECT d.* FROM datasets d
     WHERE d.id = $1
       AND (
         d.user_id = $2
         OR EXISTS (
           SELECT 1 FROM org_members om
           JOIN organizations o ON o.id = om.org_id
           WHERE om.user_id = $2 AND om.status = 'active' AND o.owner_id = d.user_id
         )
       )`,
    [datasetId, userId]
  );
  return result.rows[0] || null;
}

async function uploadDataset(req, res, next) {
  let uploadedStorageKey;
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { originalname, filename, size, path: uploadedPath } = req.file;
    const filePath = path.resolve(uploadedPath);
    const storageKey = req.storageObjectKey || `datasets/${req.user.id}/${filename}`;
    const ext = path.extname(originalname).toLowerCase().slice(1);
    await putFile(filePath, storageKey);
    uploadedStorageKey = storageKey;

    // Insert dataset record
    const result = await query(
      `INSERT INTO datasets (user_id, name, original_name, file_path, storage_key, file_size, format, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'processing')
       RETURNING id, name, status, created_at`,
      [req.user.id, originalname, filename, filePath, storageKey, size, ext]
    );

    const dataset = result.rows[0];

    // Kick off async analysis (don't await)
    analyzeDataset(dataset.id, filePath, ext).catch(err => {
      console.error('Analysis failed for dataset', dataset.id, err.message);
    });

    // Track usage
    await query(
      'INSERT INTO usage_tracking (user_id, action_type, metadata) VALUES ($1, $2, $3)',
      [req.user.id, 'dataset_upload', JSON.stringify({ datasetId: dataset.id, size, format: ext })]
    );
    await createNotification({
      userId: req.user.id,
      title: 'Dataset uploaded',
      message: `${originalname} was uploaded. Analysis is now in progress.`,
      type: 'info',
      eventKey: `dataset:uploaded:${dataset.id}`,
    });

    res.status(201).json({ dataset: { ...dataset, size, format: ext } });
  } catch (err) {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    if (uploadedStorageKey) {
      try { await deleteObject(uploadedStorageKey); } catch { /* best-effort orphan cleanup */ }
    }
    next(err);
  }
}

async function getDatasets(req, res, next) {
  try {
    // 1. الـ datasets بتاعته هو
    const ownResult = await query(
      `SELECT id, name, original_name, file_size, format, rows_count, columns_count, status, health_score, created_at, is_demo,
              NULL as shared_by_name, NULL as shared_by_email, NULL as org_name, 'own' as source
       FROM datasets WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );

    // 2. الـ datasets اللي شاركها معاه ناس تانيين (من orgs هو member فيها بس مش owner)
    const sharedResult = await query(
      `SELECT d.id, d.name, d.original_name, d.file_size, d.format, d.rows_count, d.columns_count,
              d.status, d.health_score, d.created_at, d.is_demo,
              u.name as shared_by_name, u.email as shared_by_email,
              o.name as org_name, 'shared' as source
       FROM datasets d
       JOIN users u ON u.id = d.user_id
       JOIN organizations o ON o.owner_id = d.user_id
       JOIN org_members om ON om.org_id = o.id
       WHERE om.user_id = $1
         AND om.status = 'active'
         AND d.user_id != $1
       ORDER BY d.created_at DESC`,
      [req.user.id]
    );

    const mapRow = (d) => ({
      id:           d.id,
      name:         d.name,
      size:         parseInt(d.file_size),
      rows:         d.rows_count || 0,
      columns:      d.columns_count || 0,
      uploadedAt:   d.created_at,
      status:       d.status,
      healthScore:  d.health_score || 0,
      format:       d.format,
      isDemo:       d.is_demo || false,
      source:       d.source,
      sharedByName:  d.shared_by_name  || null,
      sharedByEmail: d.shared_by_email || null,
      orgName:       d.org_name        || null,
    });

    res.json({
      datasets:       ownResult.rows.map(mapRow),
      sharedDatasets: sharedResult.rows.map(mapRow),
    });
  } catch (err) {
    next(err);
  }
}

async function getDataset(req, res, next) {
  try {
    const ds = await getDatasetWithAccess(req.params.id, req.user.id);
    if (!ds) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    const result = await query(
      `SELECT result_data as analysis
       FROM analysis_results
       WHERE dataset_id = $1 AND result_type = 'summary'
       ORDER BY created_at DESC LIMIT 1`,
      [req.params.id]
    );

    res.json({
      dataset: {
        id: ds.id,
        name: ds.name,
        size: parseInt(ds.file_size),
        rows: ds.rows_count || 0,
        columns: ds.columns_count || 0,
        uploadedAt: ds.created_at,
        status: ds.status,
        healthScore: ds.health_score || 0,
        format: ds.format,
        isDemo: ds.is_demo || false,
        analysis: result.rows[0]?.analysis || null,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getSummary(req, res, next) {
  try {
    const ds = await getDatasetWithAccess(req.params.id, req.user.id);
    if (!ds) return res.status(404).json({ error: 'Dataset not found' });

    const result = await query(
      `SELECT result_data FROM analysis_results WHERE dataset_id = $1 AND result_type = 'summary' ORDER BY created_at DESC LIMIT 1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(202).json({ status: 'processing', message: 'Analysis in progress' });
    }

    res.json(result.rows[0].result_data);
  } catch (err) {
    next(err);
  }
}

async function getQuality(req, res, next) {
  try {
    const ds = await getDatasetWithAccess(req.params.id, req.user.id);
    if (!ds) return res.status(404).json({ error: 'Dataset not found' });

    const result = await query(
      `SELECT result_data FROM analysis_results WHERE dataset_id = $1 AND result_type = 'quality' ORDER BY created_at DESC LIMIT 1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(202).json({ status: 'processing', message: 'Analysis in progress' });
    }

    res.json(result.rows[0].result_data);
  } catch (err) {
    next(err);
  }
}

async function getVisualization(req, res, next) {
  try {
    const ds = await getDatasetWithAccess(req.params.id, req.user.id);
    if (!ds) return res.status(404).json({ error: 'Dataset not found' });

    const result = await query(
      `SELECT result_data FROM analysis_results WHERE dataset_id = $1 AND result_type = 'visualization' ORDER BY created_at DESC LIMIT 1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(202).json({ status: 'processing', message: 'Analysis in progress' });
    }

    res.json(result.rows[0].result_data);
  } catch (err) {
    next(err);
  }
}

async function deleteDataset(req, res, next) {
  try {
    const datasetResult = await query(
      'SELECT id, file_path, storage_key, name FROM datasets WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (datasetResult.rows.length === 0) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    const dataset = datasetResult.rows[0];
    const cleanedResult = await query(
      `SELECT result_data->>'filePath' AS file_path, result_data->>'storageKey' AS storage_key
       FROM analysis_results WHERE dataset_id = $1 AND result_type = 'cleaned'`,
      [req.params.id]
    );

    await query('DELETE FROM datasets WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);

    const filePaths = [dataset.file_path, ...cleanedResult.rows.map(row => row.file_path)];
    for (const filePath of filePaths) {
      if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await deleteObject(dataset.storage_key);
    for (const row of cleanedResult.rows) await deleteObject(row.storage_key);

    res.json({ message: `${dataset.name} deleted` });
  } catch (err) {
    next(err);
  }
}

async function downloadClean(req, res, next) {
  try {
    const ds = await getDatasetWithAccess(req.params.id, req.user.id);
    if (!ds) return res.status(404).json({ error: 'Dataset not found' });

    const cleanResult = await query(
      `SELECT result_data FROM analysis_results WHERE dataset_id = $1 AND result_type = 'cleaned' ORDER BY created_at DESC LIMIT 1`,
      [req.params.id]
    );

    if (cleanResult.rows.length === 0) {
      return res.status(404).json({ error: 'No cleaned version available. Apply cleaning operations first.' });
    }

    const cleaned = cleanResult.rows[0].result_data;
    if (cleaned.storageKey) {
      const buffer = await readBuffer(cleaned.storageKey);
      res.setHeader('Content-Disposition', `attachment; filename="cleaned_${ds.name}"`);
      return res.send(buffer);
    }

    if (!cleaned.filePath || !fs.existsSync(cleaned.filePath)) {
      return res.status(404).json({ error: 'Cleaned file not found' });
    }

    res.download(cleaned.filePath, `cleaned_${ds.name}`);
  } catch (err) {
    next(err);
  }
}

module.exports = { uploadDataset, getDatasets, getDataset, getSummary, getQuality, getVisualization, deleteDataset, downloadClean };