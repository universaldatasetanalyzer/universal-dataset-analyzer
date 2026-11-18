const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const FormData = require('form-data');
const { query } = require('../db');
const { createNotification } = require('./notifications');
const { provider, putFile, putBuffer, createObjectKey, deleteObject, deleteTemporaryFile } = require('./storage');
const { acquireAnalysisSlot, validateShape } = require('./resourceLimits');

const PYTHON_URL = (process.env.PYTHON_SERVICE_URL || 'http://localhost:8000').replace(/\/+$/, '');
const httpAgent = new http.Agent({ keepAlive: false });
const httpsAgent = new https.Agent({ keepAlive: false });

function isTransientPythonError(error) {
  return ['ECONNRESET', 'ECONNREFUSED', 'EPIPE', 'ETIMEDOUT', 'EAI_AGAIN'].includes(error?.code);
}

function isTransientPythonStatus(status) {
  return [429, 502, 503, 504].includes(status);
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getFormDataLength(form) {
  return new Promise((resolve, reject) => {
    form.getLength((error, length) => {
      if (error) reject(error);
      else resolve(length);
    });
  });
}

async function warmPythonService(requestId) {
  const startedAt = Date.now();
  const isHttps = PYTHON_URL.startsWith('https://');
  const response = await fetch(`${PYTHON_URL}/health`, {
    headers: requestId ? { 'x-request-id': requestId } : {},
    agent: isHttps ? httpsAgent : httpAgent,
    timeout: 90000,
  });
  if (!response.ok) {
    const error = new Error(`Python health check failed: ${response.status}`);
    error.status = response.status;
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('retry-after'), 10);
      if (retryAfter > 0) error.retryAfter = retryAfter;
    }
    throw error;
  }
  console.log(`[${requestId || 'no-request-id'}] [PythonService] HEALTHY (${Date.now() - startedAt}ms)`);
}

async function callPython(endpoint, filePath, fields, options = {}) {
  const maxAttempts = 4;
  // Render free services can take 50+ seconds to wake up. Keep the
  // multipart request retry window long enough to span that cold start.
  const retryDelays = [5000, 15000, 30000];
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    // A multipart request body cannot be reused after a failed request because
    // its file stream has already been consumed.
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));

    for (const [key, value] of Object.entries(fields)) {
      form.append(key, typeof value === 'string' ? value : JSON.stringify(value));
    }

    try {
      await warmPythonService(options.requestId);
      const formLength = await getFormDataLength(form);
      const isHttps = PYTHON_URL.startsWith('https://');
      const response = await fetch(`${PYTHON_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          ...form.getHeaders(),
          'Content-Length': String(formLength),
          ...(options.requestId ? { 'x-request-id': options.requestId } : {}),
          ...(process.env.PYTHON_SERVICE_TOKEN ? { 'x-internal-service-token': process.env.PYTHON_SERVICE_TOKEN } : {}),
        },
        body: form,
        agent: isHttps ? httpsAgent : httpAgent,
        timeout: 120000,
      });

      if (!response.ok) {
        const text = await response.text();
        const error = new Error(`Python service error: ${response.status} - ${text}`);
        error.status = response.status;
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('retry-after'), 10);
          if (retryAfter > 0) error.retryAfter = retryAfter;
        }
        throw error;
      }

      return response.json();
    } catch (error) {
      lastError = error;
      const shouldRetry = attempt < maxAttempts
        && (isTransientPythonError(error) || isTransientPythonStatus(error.status));

      if (!shouldRetry) throw error;

      // Respect Retry-After header for 429 responses, otherwise use default delays
      const retryAfterMs = error.status === 429 && error.retryAfter
        ? Math.min(error.retryAfter * 1000, 60000)
        : retryDelays[attempt - 1];

      console.warn(
        `Python service request ${endpoint} failed (attempt ${attempt}/${maxAttempts}); retrying in ${retryAfterMs}ms:`,
        error.message
      );
      await wait(retryAfterMs);
    }
  }

  throw lastError;
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

async function cleanDataset(datasetId, filePath, operations, options = {}) {
  let releaseSlot = () => {};
  try {
    releaseSlot = acquireAnalysisSlot();
    const result = await callPython('/clean', filePath, {
      operations,
      datasetId,
      format: path.extname(filePath).slice(1) || 'csv',
    }, options);
    if (result.cleanedDataBase64) {
      const format = result.cleanedFormat || path.extname(filePath).slice(1) || 'csv';
      const buffer = Buffer.from(result.cleanedDataBase64, 'base64');
      const storageKey = createObjectKey(datasetId, `cleaned.${format}`, 'cleaned');
      const stored = await putBuffer(buffer, storageKey);
      result.cleanedStorageKey = storageKey;
      result.cleanedFilePath = stored.path || storageKey;
      delete result.cleanedDataBase64;
    } else if (result.cleanedFilePath && fs.existsSync(result.cleanedFilePath)) {
      const temporaryPath = result.cleanedFilePath;
      const storageKey = createObjectKey(datasetId, temporaryPath, 'cleaned');
      const stored = await putFile(temporaryPath, storageKey);
      result.cleanedStorageKey = storageKey;
      result.cleanedFilePath = stored.path || storageKey;
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
