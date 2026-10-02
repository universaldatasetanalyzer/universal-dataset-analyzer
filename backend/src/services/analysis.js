const fetch = require('node-fetch');
const fs = require('fs');
const FormData = require('form-data');
const { query } = require('../db');
const { createNotification } = require('./notifications');
const { provider, putFile, createObjectKey, deleteObject, deleteTemporaryFile } = require('./storage');
const { acquireAnalysisSlot, validateShape } = require('./resourceLimits');

const PYTHON_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

async function callPython(endpoint, filePath, fields) {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));

  for (const [key, value] of Object.entries(fields)) {
    form.append(key, typeof value === 'string' ? value : JSON.stringify(value));
  }

  const response = await fetch(`${PYTHON_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      ...form.getHeaders(),
      ...(process.env.PYTHON_SERVICE_TOKEN ? { 'x-internal-service-token': process.env.PYTHON_SERVICE_TOKEN } : {}),
    },
    body: form,
    timeout: 120000,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Python service error: ${response.status} - ${text}`);
  }

  return response.json();
}

async function analyzeDataset(datasetId, filePath, format, storageKey) {
  let releaseSlot = () => {};
  try {
    releaseSlot = acquireAnalysisSlot();
    console.log(`Starting analysis for dataset ${datasetId}`);

    await query('UPDATE datasets SET status = $1 WHERE id = $2', ['processing', datasetId]);

    // Call Python microservice for full analysis
    const result = await callPython('/analyze', filePath, { format, datasetId });
    validateShape(result.summary?.rowCount, result.summary?.columnCount);

    // Store summary
    await query(
      `INSERT INTO analysis_results (dataset_id, result_type, result_data) VALUES ($1, 'summary', $2)
       ON CONFLICT DO NOTHING`,
      [datasetId, JSON.stringify(result.summary)]
    );

    // Store quality
    await query(
      `INSERT INTO analysis_results (dataset_id, result_type, result_data) VALUES ($1, 'quality', $2)
       ON CONFLICT DO NOTHING`,
      [datasetId, JSON.stringify(result.quality)]
    );

    // Store visualization data
    await query(
      `INSERT INTO analysis_results (dataset_id, result_type, result_data) VALUES ($1, 'visualization', $2)
       ON CONFLICT DO NOTHING`,
      [datasetId, JSON.stringify(result.visualization)]
    );

    // Update dataset metadata
    await query(
      `UPDATE datasets SET
         rows_count = $1,
         columns_count = $2,
         health_score = $3,
         status = 'ready',
         updated_at = NOW()
       WHERE id = $4`,
      [result.summary.rowCount, result.summary.columnCount, result.quality.healthScore, datasetId]
    );

    const owner = await query('SELECT user_id, name FROM datasets WHERE id = $1', [datasetId]);
    await createNotification({
      userId: owner.rows[0]?.user_id,
      title: 'Analysis complete',
      message: `${owner.rows[0]?.name || 'Your dataset'} has been analyzed and is ready to explore.`,
      type: 'success',
      eventKey: `dataset:analysis-ready:${datasetId}`,
    });

    console.log(`Analysis complete for dataset ${datasetId}`);
    return result;
  } catch (err) {
    console.error(`Analysis failed for dataset ${datasetId}:`, err.message);
    await query('UPDATE datasets SET status = $1 WHERE id = $2', ['error', datasetId]);
    const owner = await query('SELECT user_id, name FROM datasets WHERE id = $1', [datasetId]);
    await createNotification({
      userId: owner.rows[0]?.user_id,
      title: 'Analysis failed',
      message: `${owner.rows[0]?.name || 'Your dataset'} could not be analyzed. Please check the file and try again.`,
      type: 'error',
      eventKey: `dataset:analysis-failed:${datasetId}`,
    });
    throw err;
  } finally {
    releaseSlot();
    if (provider === 's3' && storageKey) await deleteTemporaryFile(filePath);
  }
}

async function cleanDataset(datasetId, filePath, operations) {
  let releaseSlot = () => {};
  try {
    releaseSlot = acquireAnalysisSlot();
    const result = await callPython('/clean', filePath, {
      operations,
      datasetId,
      format: require('path').extname(filePath).slice(1),
    });
    if (result.cleanedFilePath) {
      const temporaryPath = result.cleanedFilePath;
      const storageKey = createObjectKey(datasetId, temporaryPath, 'cleaned');
      const stored = await putFile(temporaryPath, storageKey);
      result.cleanedStorageKey = storageKey;
      result.cleanedFilePath = stored.path;
      await deleteTemporaryFile(temporaryPath);
    }
    return result;
  } finally {
    releaseSlot();
  }
}

async function generateInsights(datasetId, filePath, summaryData) {
  const releaseSlot = acquireAnalysisSlot();
  try {
    return await callPython('/insights', filePath, { summaryData, datasetId });
  } finally {
    releaseSlot();
  }
}

module.exports = { analyzeDataset, cleanDataset, generateInsights };
