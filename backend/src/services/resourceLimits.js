const { query } = require('../db');

const limits = {
  maxFileSize: Number(process.env.MAX_FILE_SIZE || 50 * 1024 * 1024),
  maxRows: Number(process.env.MAX_DATASET_ROWS || 1000000),
  maxColumns: Number(process.env.MAX_DATASET_COLUMNS || 200),
  maxStorageBytes: Number(process.env.MAX_STORAGE_BYTES || 5 * 1024 * 1024 * 1024),
  maxConcurrentAnalyses: Number(process.env.MAX_CONCURRENT_ANALYSES || 2),
};

let activeAnalyses = 0;

async function assertStorageAvailable(userId, incomingBytes) {
  const result = await query(
    `SELECT COALESCE(SUM(file_size), 0) AS total
     FROM datasets WHERE user_id = $1 AND is_demo = false`,
    [userId]
  );
  const total = Number(result.rows[0]?.total || 0);
  if (total + Number(incomingBytes || 0) > limits.maxStorageBytes) {
    const error = new Error('Your storage limit has been reached. Delete an existing dataset or contact support.');
    error.status = 413;
    error.code = 'STORAGE_LIMIT';
    throw error;
  }
}

function acquireAnalysisSlot() {
  if (activeAnalyses >= limits.maxConcurrentAnalyses) {
    const error = new Error('Analysis capacity is temporarily full. Please try again in a moment.');
    error.status = 429;
    error.code = 'ANALYSIS_CAPACITY';
    throw error;
  }
  activeAnalyses += 1;
  let released = false;
  return () => {
    if (!released) {
      released = true;
      activeAnalyses = Math.max(0, activeAnalyses - 1);
    }
  };
}

function validateShape(rows, columns) {
  if (Number(rows) > limits.maxRows) {
    const error = new Error(`This dataset exceeds the ${limits.maxRows.toLocaleString()} row limit.`);
    error.status = 413;
    error.code = 'ROW_LIMIT';
    throw error;
  }
  if (Number(columns) > limits.maxColumns) {
    const error = new Error(`This dataset exceeds the ${limits.maxColumns.toLocaleString()} column limit.`);
    error.status = 413;
    error.code = 'COLUMN_LIMIT';
    throw error;
  }
}

module.exports = { limits, assertStorageAvailable, acquireAnalysisSlot, validateShape };
