const fs = require('fs');
const path = require('path');
const { query } = require('../db');
const { analyzeDataset } = require('./analysis');
const { putFile, createObjectKey, deleteObject, provider } = require('./storage');

const DEMO_SOURCE = path.join(__dirname, '../data/demo-dataset.csv');
const DEMO_DISPLAY_NAME = 'Demo Dataset — Try it out';

/**
 * Copies the bundled demo CSV into the new user's upload folder, inserts a
 * `datasets` row flagged is_demo=true, and kicks off the normal analysis
 * pipeline so Summary / Quality / Visualization / Chat all work immediately.
 * Never throws — failures are logged so they never block registration.
 */
async function seedDemoDataset(userId, db = { query }, options = {}) {
  const { startAnalysis = true, throwOnError = false } = options;
  let destPath;
  let storageKey;
  try {
    if (!fs.existsSync(DEMO_SOURCE)) {
      console.error('Demo dataset source file missing at', DEMO_SOURCE);
      return null;
    }

    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    const userDir = path.join(uploadDir, userId);
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });

    const filename = `demo-${Date.now()}-${Math.random().toString(36).slice(2)}.csv`;
    destPath = path.resolve(path.join(userDir, filename));
    fs.copyFileSync(DEMO_SOURCE, destPath);
    const { size } = fs.statSync(destPath);
    storageKey = createObjectKey(userId, 'demo-sales-data.csv');
    await putFile(destPath, storageKey);

    const result = await db.query(
      `INSERT INTO datasets (user_id, name, original_name, file_path, storage_key, file_size, format, status, is_demo)
       VALUES ($1, $2, $3, $4, $5, $6, 'csv', 'processing', true)
       RETURNING id`,
      [userId, DEMO_DISPLAY_NAME, 'demo-sales-data.csv', destPath, storageKey, size]
    );

    const datasetId = result.rows[0].id;

    if (startAnalysis) {
      analyzeDataset(datasetId, destPath, 'csv', storageKey).catch(err => {
        console.error('Demo dataset analysis failed for user', userId, err.message);
      });
    }

    return { datasetId, filePath: destPath, storageKey, format: 'csv' };
  } catch (err) {
    console.error('Failed to seed demo dataset for user', userId, err.message);
    if (throwOnError) {
      if (destPath && fs.existsSync(destPath)) fs.unlinkSync(destPath);
      if (storageKey && provider === 's3') {
        try { await deleteObject(storageKey); } catch { /* best-effort cleanup */ }
      }
      throw err;
    }
    return null;
  }
}

module.exports = { seedDemoDataset, DEMO_DISPLAY_NAME };
