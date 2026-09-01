const { query }              = require('../db');
const { generateAIInsights } = require('../services/ai');

// نفس الـ helper بتاع datasets
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

async function getInsights(req, res, next) {
  try {
    const ds = await getDatasetWithAccess(req.params.datasetId, req.user.id);
    if (!ds) return res.status(404).json({ error: 'Dataset not found' });

    const existing = await query(
      `SELECT result_data FROM analysis_results WHERE dataset_id = $1 AND result_type = 'insights' ORDER BY created_at DESC LIMIT 1`,
      [req.params.datasetId]
    );
    if (existing.rows.length > 0) return res.json(existing.rows[0].result_data);

    const summaryResult = await query(
      `SELECT result_data FROM analysis_results WHERE dataset_id = $1 AND result_type = 'summary' ORDER BY created_at DESC LIMIT 1`,
      [req.params.datasetId]
    );
    const qualityResult = await query(
      `SELECT result_data FROM analysis_results WHERE dataset_id = $1 AND result_type = 'quality' ORDER BY created_at DESC LIMIT 1`,
      [req.params.datasetId]
    );

    const context = {
      name: ds.name, rows: ds.rows_count, columns: ds.columns_count,
      format: ds.format, healthScore: ds.health_score,
      columnSummary: summaryResult.rows[0]?.result_data?.columns || [],
      sampleStats: summaryResult.rows[0]?.result_data?.stats || null,
      qualityIssues: qualityResult.rows[0]?.result_data?.issues  || [],
    };

    const insights = await generateAIInsights(context);
    await query(
      `INSERT INTO analysis_results (dataset_id, result_type, result_data) VALUES ($1, 'insights', $2)`,
      [req.params.datasetId, JSON.stringify(insights)]
    );

    res.json(insights);
  } catch (err) { next(err); }
}

async function regenerateInsights(req, res, next) {
  try {
    const ds = await getDatasetWithAccess(req.params.datasetId, req.user.id);
    if (!ds) return res.status(404).json({ error: 'Dataset not found' });

    await query(
      `DELETE FROM analysis_results WHERE dataset_id = $1 AND result_type = 'insights'`,
      [req.params.datasetId]
    );
    return getInsights(req, res, next);
  } catch (err) { next(err); }
}

module.exports = { getInsights, regenerateInsights };