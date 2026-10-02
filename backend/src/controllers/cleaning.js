const { query }         = require('../db');
const { cleanDataset }  = require('../services/analysis');
const { createNotification } = require('../services/notifications');
const { deleteObject, materialize, deleteTemporaryFile } = require('../services/storage');

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

async function getMemberRole(datasetOwnerId, userId) {
  if (datasetOwnerId === userId) return 'owner';
  const result = await query(
    `SELECT om.role FROM org_members om
     JOIN organizations o ON o.id = om.org_id
     WHERE om.user_id = $1 AND om.status = 'active' AND o.owner_id = $2 LIMIT 1`,
    [userId, datasetOwnerId]
  );
  return result.rows[0]?.role || null;
}

async function previewClean(req, res, next) {
  try {
    const ds = await getDatasetWithAccess(req.params.id, req.user.id);
    if (!ds) return res.status(404).json({ error: 'Dataset not found' });

    // viewer مش يقدر يعمل cleaning
    const role = await getMemberRole(ds.user_id, req.user.id);
    if (role === 'viewer') return res.status(403).json({ error: 'Viewers cannot perform cleaning operations' });

    const source = await materialize(ds.storage_key, ds.file_path);
    try {
      const result = await cleanDataset(ds.id, source.path, { ...req.body.operations, preview: true });
      res.json(result);
    } finally {
      if (source.temporary) await deleteTemporaryFile(source.path);
    }
  } catch (err) { next(err); }
}

async function applyClean(req, res, next) {
  try {
    const ds = await getDatasetWithAccess(req.params.id, req.user.id);
    if (!ds) return res.status(404).json({ error: 'Dataset not found' });

    // viewer مش يقدر يعمل cleaning
    const role = await getMemberRole(ds.user_id, req.user.id);
    if (role === 'viewer') return res.status(403).json({ error: 'Viewers cannot perform cleaning operations' });

    const source = await materialize(ds.storage_key, ds.file_path);
    let result;
    try {
      result = await cleanDataset(ds.id, source.path, { ...req.body.operations, preview: false });
    } finally {
      if (source.temporary) await deleteTemporaryFile(source.path);
    }

    if (result.cleanedFilePath) {
      const previousResult = await query(
        `SELECT result_data FROM analysis_results WHERE dataset_id = $1 AND result_type = 'cleaned' LIMIT 1`,
        [ds.id]
      );
      const resultData = JSON.stringify({
        filePath: result.cleanedFilePath,
        storageKey: result.cleanedStorageKey,
        operations: req.body.operations,
        appliedAt: new Date(),
      });

      const updated = await query(
        `UPDATE analysis_results
         SET result_data = $2
         WHERE dataset_id = $1 AND result_type = 'cleaned'
         RETURNING id`,
        [ds.id, resultData]
      );

      if (updated.rows.length === 0) {
        await query(
          `INSERT INTO analysis_results (dataset_id, result_type, result_data)
           VALUES ($1, 'cleaned', $2)`,
          [ds.id, resultData]
        );
      }
      const previousPath = previousResult.rows[0]?.result_data?.filePath;
      const previousStorageKey = previousResult.rows[0]?.result_data?.storageKey;
      if (previousPath && previousPath !== result.cleanedFilePath) await deleteObject(previousPath);
      if (previousStorageKey && previousStorageKey !== result.cleanedStorageKey) await deleteObject(previousStorageKey);
      await createNotification({
        userId: req.user.id,
        title: 'Cleaning complete',
        message: `${ds.name} has been cleaned and the updated file is ready to download.`,
        type: 'success',
        eventKey: `dataset:cleaned:${ds.id}:${Date.now()}`,
      });
    }

    res.json(result);
  } catch (err) { next(err); }
}

module.exports = { previewClean, applyClean };