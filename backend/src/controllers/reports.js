const { query } = require('../db');
const { createNotification } = require('../services/notifications');
const { putBuffer, readBuffer, deleteObject, createObjectKey, exists } = require('../services/storage');

const REPORT_TYPES = new Set(['full', 'quality', 'summary', 'executive']);

async function getReports(req, res, next) {
  try {
    const result = await query(
      `SELECT r.id, r.name, r.dataset_id, r.report_type, r.status, r.file_size, r.created_at, d.name as dataset_name
       FROM reports r
       LEFT JOIN datasets d ON d.id = r.dataset_id
       WHERE r.user_id = $1 ORDER BY r.created_at DESC`,
      [req.user.id]
    );
    res.json({
      reports: result.rows.map(r => ({
        id: r.id, name: r.name, datasetId: r.dataset_id, datasetName: r.dataset_name,
        type: r.report_type, status: r.status,
        size: r.file_size ? formatSize(r.file_size) : null, createdAt: r.created_at,
      })),
    });
  } catch (err) { next(err); }
}

async function generateReport(req, res, next) {
  try {
    const { datasetId, reportType, name } = req.body;
    if (!datasetId || !reportType) return res.status(400).json({ error: 'datasetId and reportType are required' });
    if (!REPORT_TYPES.has(reportType)) return res.status(400).json({ error: 'Unsupported report type' });

    const dsResult = await query(
      `SELECT * FROM datasets WHERE id = $1
       AND (
         user_id = $2
         OR EXISTS (
           SELECT 1 FROM org_members om
           JOIN organizations o ON o.id = om.org_id
           WHERE om.user_id = $2 AND om.status = 'active' AND o.owner_id = datasets.user_id
         )
       )`,
      [datasetId, req.user.id]
    );
    if (dsResult.rows.length === 0) return res.status(404).json({ error: 'Dataset not found' });

    const activeReport = await query(
      `SELECT id, name, report_type, status, created_at FROM reports
       WHERE user_id = $1 AND dataset_id = $2 AND report_type = $3 AND status = 'generating'
       ORDER BY created_at DESC LIMIT 1`,
      [req.user.id, datasetId, reportType]
    );
    if (activeReport.rows.length > 0) return res.status(202).json({ report: activeReport.rows[0] });

    const reportName = name || `${dsResult.rows[0].name} - ${reportType} Report`;
    const result = await query(
      `INSERT INTO reports (user_id, dataset_id, name, report_type, status)
       VALUES ($1, $2, $3, $4, 'generating') RETURNING id, name, report_type, status, created_at`,
      [req.user.id, datasetId, reportName, reportType]
    );

    const report = result.rows[0];
    generateReportAsync(report.id, datasetId, reportType, req.user.id).catch(err => {
      console.error('Report generation failed:', err.message);
    });
    res.status(201).json({ report });
  } catch (err) { next(err); }
}

async function generateReportAsync(reportId, datasetId, reportType, userId) {
  try {
    const reportResult = await query(
      `SELECT r.*, d.name as dataset_name FROM reports r JOIN datasets d ON d.id = r.dataset_id WHERE r.id = $1`,
      [reportId]
    );
    if (reportResult.rows.length === 0) throw new Error('Report record not found');
    const report = reportResult.rows[0];
    const [summaryRes, qualityRes, vizRes, insightsRes] = await Promise.all([
      query(`SELECT result_data FROM analysis_results WHERE dataset_id = $1 AND result_type = 'summary' ORDER BY created_at DESC LIMIT 1`, [datasetId]),
      query(`SELECT result_data FROM analysis_results WHERE dataset_id = $1 AND result_type = 'quality' ORDER BY created_at DESC LIMIT 1`, [datasetId]),
      query(`SELECT result_data FROM analysis_results WHERE dataset_id = $1 AND result_type = 'visualization' ORDER BY created_at DESC LIMIT 1`, [datasetId]),
      query(`SELECT result_data FROM analysis_results WHERE dataset_id = $1 AND result_type = 'insights' ORDER BY created_at DESC LIMIT 1`, [datasetId]),
    ]);
    const html = buildHtmlReport(
      report,
      summaryRes.rows[0]?.result_data || {},
      qualityRes.rows[0]?.result_data || {},
      vizRes.rows[0]?.result_data || {},
      insightsRes.rows[0]?.result_data || {}
    );
    const storageKey = createObjectKey(userId, `${report.name}.html`, 'reports');
    const stored = await putBuffer(Buffer.from(html, 'utf8'), storageKey);
    if (!(await exists(storageKey))) throw new Error('Report artifact was not persisted');
    await query(
      `UPDATE reports SET status = 'ready', file_path = $1, storage_key = $2, file_size = $3 WHERE id = $4`,
      [stored.path, storageKey, Buffer.byteLength(html), reportId]
    );
    await createNotification({
      userId,
      title: 'Report ready',
      message: 'Your generated report is ready to download.',
      type: 'success',
      eventKey: `report:ready:${reportId}`,
    });
  } catch (err) {
    await query('UPDATE reports SET status = $1 WHERE id = $2', ['error', reportId]);
    await createNotification({
      userId,
      title: 'Report generation failed',
      message: 'We could not generate your report. Please try again.',
      type: 'error',
      eventKey: `report:error:${reportId}`,
    });
  }
}

async function downloadReport(req, res, next) {
  try {
    const result = await query(
      `SELECT r.*, d.name as dataset_name FROM reports r
       LEFT JOIN datasets d ON d.id = r.dataset_id
       WHERE r.id = $1 AND r.user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Report not found' });

    const report = result.rows[0];
    if (report.status !== 'ready') return res.status(400).json({ error: 'Report is not ready yet', status: report.status });
    if (!report.storage_key || !(await exists(report.storage_key))) {
      return res.status(409).json({ error: 'Report artifact is unavailable. Please generate the report again.' });
    }

    const fileName = `${report.name.replace(/[^a-z0-9]/gi, '_')}.html`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(await readBuffer(report.storage_key));
  } catch (err) { next(err); }
}

function buildHtmlReport(report, summary, quality, viz, insights) {
  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  const safeClass = (value, fallback = '') => /^[a-z0-9_-]+$/i.test(String(value || '')) ? String(value) : fallback;
  const safeColor = (value, fallback = '#6366f1') => /^#[0-9a-f]{3,8}$/i.test(String(value || '')) ? String(value) : fallback;
  const now      = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const columns  = summary.columns || [];
  const issues   = quality.issues  || [];
  const charts   = viz.charts      || [];
  const score    = quality.healthScore || 0;
  const scoreColor = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';

  // ── Column Details Table ────────────────────────────────────────────────────
  const columnsTable = columns.length > 0 ? `
    <table>
      <thead><tr><th>Column</th><th>Type</th><th>Missing</th><th>Unique</th><th>Min</th><th>Max</th><th>Mean</th><th>Std</th></tr></thead>
      <tbody>
        ${columns.map(c => `
          <tr>
            <td><strong>${escapeHtml(c.name)}</strong></td>
            <td><span class="badge type-${safeClass(c.type)}">${escapeHtml(c.type)}</span></td>
            <td class="${c.nullPercent > 5 ? 'warn' : ''}">${escapeHtml(c.nullPercent ?? 0)}%</td>
            <td>${escapeHtml(c.uniqueCount ?? '—')}</td>
            <td>${escapeHtml(c.min ?? '—')}</td>
            <td>${escapeHtml(c.max ?? '—')}</td>
            <td>${escapeHtml(c.mean ?? '—')}</td>
            <td>${escapeHtml(c.std ?? '—')}</td>
          </tr>`).join('')}
      </tbody>
    </table>` : '<p class="empty">No column data available.</p>';

  // ── Quality Issues ──────────────────────────────────────────────────────────
  const issuesList = issues.length > 0
    ? issues.map(i => `<div class="issue ${safeClass(i.severity)}"><span class="sev">${escapeHtml(i.severity).toUpperCase()}</span>${escapeHtml(i.description)}</div>`).join('')
    : '<p class="empty">✅ No quality issues detected.</p>';

  // ── Visualizations (SVG bar charts inline) ──────────────────────────────────
  function buildBarChart(data, labelKey, valueKey, color = '#6366f1') {
    if (!data || data.length === 0) return '<p class="empty">No data available.</p>';
    const max   = Math.max(...data.map(d => Number(d[valueKey]) || 0)) || 1;
    const W     = 480, H = 220, pad = { top: 10, right: 10, bottom: 60, left: 45 };
    const bw    = Math.max(8, Math.floor((W - pad.left - pad.right) / data.length) - 4);
    const items = data.slice(0, 12);
    const barW  = Math.max(8, Math.floor((W - pad.left - pad.right) / items.length) - 4);
    const COLORS = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#ec4899','#14b8a6','#f97316','#8b5cf6','#06b6d4','#d946ef','#84cc16','#f43f5e'];

    const bars = items.map((d, i) => {
      const val  = Number(d[valueKey]) || 0;
      const barH = Math.max(2, Math.round((val / max) * (H - pad.top - pad.bottom)));
      const x    = pad.left + i * ((W - pad.left - pad.right) / items.length);
      const y    = H - pad.bottom - barH;
      const lbl  = String(d[labelKey] || '').slice(0, 10);
      const fill = safeColor(d.color, COLORS[i % COLORS.length]);
      return `
        <rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="${fill}" rx="3"/>
        <text x="${x + barW/2}" y="${H - pad.bottom + 14}" text-anchor="middle" font-size="9" fill="#64748b" transform="rotate(-30,${x + barW/2},${H - pad.bottom + 14})">${escapeHtml(lbl)}</text>
        <text x="${x + barW/2}" y="${y - 4}" text-anchor="middle" font-size="9" fill="#475569">${val.toLocaleString()}</text>`;
    });

    // Y axis lines
    const yLines = [0, 0.25, 0.5, 0.75, 1].map(p => {
      const yy = H - pad.bottom - Math.round(p * (H - pad.top - pad.bottom));
      return `<line x1="${pad.left}" y1="${yy}" x2="${W - pad.right}" y2="${yy}" stroke="#e2e8f0" stroke-dasharray="3,3"/>
              <text x="${pad.left - 5}" y="${yy + 4}" text-anchor="end" font-size="9" fill="#94a3b8">${Math.round(p * max).toLocaleString()}</text>`;
    });

    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:${W}px">
      ${yLines.join('')}
      ${bars.join('')}
      <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${H - pad.bottom}" stroke="#cbd5e1"/>
      <line x1="${pad.left}" y1="${H - pad.bottom}" x2="${W - pad.right}" y2="${H - pad.bottom}" stroke="#cbd5e1"/>
    </svg>`;
  }

  function buildScatter(data) {
    if (!data || data.length === 0) return '<p class="empty">No data.</p>';
    const xs   = data.map(d => Number(d.x)), ys = data.map(d => Number(d.y));
    const minX = Math.min(...xs), maxX = Math.max(...xs) || 1;
    const minY = Math.min(...ys), maxY = Math.max(...ys) || 1;
    const W = 480, H = 220, pad = { top: 10, right: 10, bottom: 40, left: 45 };
    const pts = data.slice(0, 200).map(d => {
      const cx = pad.left + ((Number(d.x) - minX) / (maxX - minX)) * (W - pad.left - pad.right);
      const cy = H - pad.bottom - ((Number(d.y) - minY) / (maxY - minY)) * (H - pad.top - pad.bottom);
      return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="3" fill="#0ea5e9" opacity="0.55"/>`;
    });
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:${W}px">
      <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${H-pad.bottom}" stroke="#cbd5e1"/>
      <line x1="${pad.left}" y1="${H-pad.bottom}" x2="${W-pad.right}" y2="${H-pad.bottom}" stroke="#cbd5e1"/>
      ${pts.join('')}
    </svg>`;
  }

  function buildCorrelation(corr) {
    if (!corr || corr.columns.length < 2) return '';
    const cols = corr.columns.slice(0, 6);
    const n    = cols.length;
    const cell = 60, pad = 80;
    const W    = pad + n * cell, H = pad + n * cell;
    const cells = cols.flatMap((row, ri) =>
      cols.map((col, ci) => {
        const d   = corr.data.find(d => d.x === col && d.y === row);
        const v   = d?.value ?? 0;
        const abs = Math.abs(v);
        const r   = v >= 0 ? Math.round(14 + abs * 220) : 239;
        const g   = v >= 0 ? Math.round(165 * abs)      : Math.round(68 * (1 - abs));
        const b   = v >= 0 ? Math.round(233 * abs)      : Math.round(68 * (1 - abs));
        const textColor = abs > 0.4 ? '#fff' : '#475569';
        const x   = pad + ci * cell, y = pad + ri * cell;
        return `<rect x="${x}" y="${y}" width="${cell-2}" height="${cell-2}" fill="rgb(${r},${g},${b})" rx="4"/>
                <text x="${x+cell/2-1}" y="${y+cell/2+4}" text-anchor="middle" font-size="10" fill="${textColor}" font-weight="600">${v.toFixed(2)}</text>`;
      })
    );
    const rowLabels = cols.map((c, i) => `<text x="${pad-6}" y="${pad + i*cell + cell/2 + 4}" text-anchor="end" font-size="10" fill="#64748b">${escapeHtml(c.slice(0,10))}</text>`);
    const colLabels = cols.map((c, i) => `<text x="${pad + i*cell + cell/2}" y="${pad-8}" text-anchor="middle" font-size="10" fill="#64748b" transform="rotate(-30,${pad+i*cell+cell/2},${pad-8})">${escapeHtml(c.slice(0,10))}</text>`);
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:${W}px">
      ${rowLabels.join('')}${colLabels.join('')}${cells.join('')}
    </svg>`;
  }

  // بناء sections الـ charts
  const chartSections = charts.map((chart, idx) => {
    let chartSvg = '';
    const title  = chart.title || chart.column || `Chart ${idx+1}`;

    if (chart.type === 'histogram') {
      chartSvg = buildBarChart(chart.data, 'bin', 'count', '#6366f1');
    } else if (chart.type === 'bar') {
      chartSvg = buildBarChart(chart.data, 'name', 'value');
    } else if (chart.type === 'scatter') {
      chartSvg = buildScatter(chart.data);
    } else if (chart.type === 'boxplot') {
      const d = chart.data;
      chartSvg = `<div class="box-stats">
        <div class="bs"><span>Min</span><strong>${escapeHtml(d.min ?? '—')}</strong></div>
        <div class="bs"><span>Q1</span><strong>${escapeHtml(d.q1 ?? '—')}</strong></div>
        <div class="bs"><span>Median</span><strong>${escapeHtml(d.median ?? '—')}</strong></div>
        <div class="bs"><span>Mean</span><strong>${escapeHtml(d.mean ?? '—')}</strong></div>
        <div class="bs"><span>Q3</span><strong>${escapeHtml(d.q3 ?? '—')}</strong></div>
        <div class="bs"><span>Max</span><strong>${escapeHtml(d.max ?? '—')}</strong></div>
        ${d.outlierCount > 0 ? `<div class="bs outlier"><span>Outliers</span><strong>${d.outlierCount}</strong></div>` : ''}
      </div>`;
    } else if (chart.type === 'pie') {
      // pie as horizontal bars with %
      const total = chart.data.reduce((s, d) => s + (Number(d.value) || 0), 0) || 1;
      chartSvg = chart.data.map(d => {
        const pct = ((Number(d.value) / total) * 100).toFixed(1);
        return `<div class="pie-row">
          <span class="pie-label">${escapeHtml(d.name)}</span>
          <div class="pie-bar-wrap"><div class="pie-bar" style="width:${pct}%;background:${safeColor(d.fill)}"></div></div>
          <span class="pie-pct">${pct}%</span>
        </div>`;
      }).join('');
    } else if (chart.type === 'line') {
      const data = chart.data || [];
      if (data.length > 1) {
        const W = 480, H = 180, pad = { top: 10, right: 10, bottom: 40, left: 45 };
        const vals = data.map(d => Number(d.records) || 0);
        const maxV = Math.max(...vals) || 1;
        const pts  = data.map((d, i) => {
          const x = pad.left + (i / (data.length - 1)) * (W - pad.left - pad.right);
          const y = H - pad.bottom - (vals[i] / maxV) * (H - pad.top - pad.bottom);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        }).join(' ');
        chartSvg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:${W}px">
          <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${H-pad.bottom}" stroke="#cbd5e1"/>
          <line x1="${pad.left}" y1="${H-pad.bottom}" x2="${W-pad.right}" y2="${H-pad.bottom}" stroke="#cbd5e1"/>
          <polyline points="${pts}" fill="none" stroke="#0ea5e9" stroke-width="2"/>
          ${data.map((d, i) => {
            const x = pad.left + (i / (data.length - 1)) * (W - pad.left - pad.right);
            const y = H - pad.bottom - (vals[i] / maxV) * (H - pad.top - pad.bottom);
            return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="#0ea5e9"/>`;
          }).join('')}
        </svg>`;
      }
    }

    return chartSvg ? `<div class="chart-card"><h4>${escapeHtml(title)}</h4>${chartSvg}</div>` : '';
  }).filter(Boolean);

  const corrSection = viz.correlation ? `
    <div class="chart-card full">
      <h4>Correlation Heatmap</h4>
      ${buildCorrelation(viz.correlation)}
      <p style="font-size:11px;color:#94a3b8;margin-top:8px">Blue = positive correlation · Red = negative correlation</p>
    </div>` : '';

  const vizSection = (chartSections.length > 0 || corrSection)
    ? `<div class="section">
        <h2>Visualizations</h2>
        <div class="charts-grid">${chartSections.join('')}</div>
        ${corrSection}
       </div>`
    : '';

  // ── AI Insights ─────────────────────────────────────────────────────────────
  const execSummary = insights.executiveSummary
    ? `<div class="insight-box exec"><h4>Executive Summary</h4><p>${escapeHtml(insights.executiveSummary)}</p></div>` : '';

  const keyFindings = (insights.keyFindings || []).map(f => `
    <div class="insight-card">
      <div class="insight-header">
        <span class="insight-metric">${escapeHtml(f.metric)}</span>
        <span class="insight-impact impact-${safeClass(f.impact?.toLowerCase())}">${escapeHtml(f.impact)}</span>
      </div>
      <h4>${escapeHtml(f.title)}</h4>
      <p>${escapeHtml(f.description)}</p>
    </div>`).join('');

  const trends = (insights.trends || []).map(t => `
    <div class="trend-item">
      <span class="trend-dir ${safeClass(t.direction)}">${t.direction === 'up' ? '↑' : t.direction === 'down' ? '↓' : '→'}</span>
      <div><strong>${escapeHtml(t.title)}</strong><p>${escapeHtml(t.description)}</p></div>
    </div>`).join('');

  const anomalies = (insights.anomalies || []).map(a => `
    <div class="issue ${safeClass(a.severity)}"><span class="sev">${escapeHtml(a.severity).toUpperCase()}</span>${escapeHtml(a.title)}: ${escapeHtml(a.description)}</div>`).join('');

  const recommendations = (insights.recommendations || []).map((r, i) => `
    <div class="rec"><span class="rec-num">${i + 1}</span>${escapeHtml(r)}</div>`).join('');

  const insightsSection = (insights.executiveSummary || (insights.keyFindings || []).length > 0)
    ? `<div class="section">
        <h2>AI Insights</h2>
        ${execSummary}
        ${keyFindings ? `<h3 class="sub-h">Key Findings</h3><div class="findings-grid">${keyFindings}</div>` : ''}
        ${trends      ? `<h3 class="sub-h">Trends</h3><div class="trends-list">${trends}</div>` : ''}
        ${anomalies   ? `<h3 class="sub-h">Anomalies</h3>${anomalies}` : ''}
        ${recommendations ? `<h3 class="sub-h">Recommendations</h3><div class="recs">${recommendations}</div>` : ''}
       </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>${escapeHtml(report.name)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;color:#1e293b;padding:32px}
.container{max-width:960px;margin:0 auto}

/* Header */
.header{background:linear-gradient(135deg,#6366f1,#0ea5e9);color:#fff;border-radius:16px;padding:36px;margin-bottom:28px}
.header h1{font-size:26px;font-weight:800;margin-bottom:6px}
.header p{opacity:.85;font-size:14px}
.meta{display:flex;gap:12px;margin-top:18px;flex-wrap:wrap}
.meta span{background:rgba(255,255,255,.2);border-radius:8px;padding:5px 14px;font-size:12px;font-weight:500}

/* Sections */
.section{background:#fff;border-radius:16px;padding:28px;margin-bottom:24px;box-shadow:0 1px 4px rgba(0,0,0,.06)}
.section h2{font-size:16px;font-weight:700;color:#6366f1;border-bottom:2px solid #e2e8f0;padding-bottom:10px;margin-bottom:20px}
.sub-h{font-size:13px;font-weight:700;color:#475569;margin:20px 0 10px;text-transform:uppercase;letter-spacing:.04em}

/* Stats */
.stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:14px}
.stat{background:#f1f5f9;border-radius:12px;padding:18px;text-align:center}
.stat .value{font-size:28px;font-weight:800;color:#6366f1}
.stat .label{font-size:11px;color:#64748b;margin-top:4px}
.health-score{font-size:44px;font-weight:800}

/* Table */
table{width:100%;border-collapse:collapse;font-size:12px}
th{background:#f1f5f9;padding:9px 12px;text-align:left;font-weight:600;color:#475569;white-space:nowrap}
td{padding:9px 12px;border-bottom:1px solid #f1f5f9}
tr:hover td{background:#fafafa}
.warn{color:#ef4444;font-weight:600}

/* Badges */
.badge{display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:600}
.type-numeric{background:#e0e7ff;color:#6366f1}
.type-categorical{background:#fce7f3;color:#be185d}
.type-datetime{background:#d1fae5;color:#065f46}
.type-text{background:#fef3c7;color:#92400e}

/* Issues */
.issue{padding:10px 14px;border-radius:8px;margin-bottom:8px;font-size:13px;display:flex;align-items:flex-start;gap:10px}
.issue.high{background:#fef2f2;color:#991b1b;border-left:4px solid #ef4444}
.issue.medium{background:#fffbeb;color:#92400e;border-left:4px solid #f59e0b}
.issue.low{background:#f0fdf4;color:#166534;border-left:4px solid #10b981}
.sev{font-weight:700;white-space:nowrap;font-size:11px}
.empty{color:#94a3b8;font-size:13px;padding:8px 0}

/* Charts */
.charts-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:20px;margin-bottom:20px}
.chart-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px}
.chart-card.full{margin-top:0}
.chart-card h4{font-size:13px;font-weight:600;color:#374151;margin-bottom:12px}

/* Box plot */
.box-stats{display:flex;gap:10px;flex-wrap:wrap}
.bs{background:#e0e7ff;border-radius:8px;padding:10px 16px;text-align:center;min-width:80px}
.bs span{display:block;font-size:10px;color:#6366f1;text-transform:uppercase;font-weight:600}
.bs strong{font-size:16px;color:#1e293b}
.bs.outlier{background:#fef2f2}
.bs.outlier span{color:#ef4444}

/* Pie bars */
.pie-row{display:flex;align-items:center;gap:10px;margin-bottom:8px;font-size:12px}
.pie-label{min-width:120px;color:#475569;font-weight:500;truncate:ellipsis}
.pie-bar-wrap{flex:1;background:#e2e8f0;border-radius:4px;height:14px;overflow:hidden}
.pie-bar{height:100%;border-radius:4px;transition:width .3s}
.pie-pct{min-width:40px;text-align:right;color:#64748b;font-weight:600}

/* AI Insights */
.insight-box{border-radius:12px;padding:18px;margin-bottom:16px}
.insight-box.exec{background:#eff6ff;border-left:4px solid #6366f1}
.insight-box h4{font-size:13px;font-weight:700;margin-bottom:8px;color:#6366f1}
.insight-box p{font-size:13px;color:#334155;line-height:1.6}

.findings-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin-bottom:4px}
.insight-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px}
.insight-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.insight-metric{font-size:20px;font-weight:800;color:#6366f1}
.insight-impact{font-size:10px;font-weight:700;padding:3px 9px;border-radius:20px}
.impact-high{background:#fef2f2;color:#991b1b}
.impact-medium{background:#fffbeb;color:#92400e}
.impact-low{background:#f0fdf4;color:#166534}
.insight-card h4{font-size:13px;font-weight:600;margin-bottom:6px;color:#1e293b}
.insight-card p{font-size:12px;color:#64748b;line-height:1.5}

.trends-list{display:flex;flex-direction:column;gap:10px}
.trend-item{display:flex;align-items:flex-start;gap:14px;background:#f8fafc;border-radius:10px;padding:12px 16px}
.trend-dir{font-size:22px;font-weight:800;line-height:1}
.trend-dir.up{color:#10b981}
.trend-dir.down{color:#ef4444}
.trend-dir.stable{color:#f59e0b}
.trend-item strong{font-size:13px;display:block;margin-bottom:4px}
.trend-item p{font-size:12px;color:#64748b}

.recs{display:flex;flex-direction:column;gap:8px}
.rec{display:flex;align-items:flex-start;gap:12px;background:#f0fdf4;border-radius:8px;padding:10px 14px;font-size:13px;color:#166534}
.rec-num{font-weight:800;color:#10b981;min-width:20px}

.footer{text-align:center;color:#94a3b8;font-size:12px;margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0}
</style>
</head>
<body>
<div class="container">

  <div class="header">
    <h1>${escapeHtml(report.name)}</h1>
    <p>Universal Dataset Analyzer &mdash; ${escapeHtml(report.report_type.charAt(0).toUpperCase() + report.report_type.slice(1))} Report</p>
    <div class="meta">
      <span>📁 ${escapeHtml(report.dataset_name || 'Dataset')}</span>
      <span>📅 ${now}</span>
      <span>📊 ${(summary.rowCount || 0).toLocaleString()} rows &times; ${summary.columnCount || 0} columns</span>
      <span>📄 ${escapeHtml(summary.format?.toUpperCase() || 'CSV')}</span>
    </div>
  </div>

  <div class="section">
    <h2>Overview</h2>
    <div class="stats-grid">
      <div class="stat"><div class="value">${(summary.rowCount || 0).toLocaleString()}</div><div class="label">Total Rows</div></div>
      <div class="stat"><div class="value">${summary.columnCount || 0}</div><div class="label">Columns</div></div>
      <div class="stat"><div class="value">${quality.totalMissing || 0}</div><div class="label">Missing Values</div></div>
      <div class="stat"><div class="value">${quality.totalDuplicates || 0}</div><div class="label">Duplicates</div></div>
      <div class="stat"><div class="value">${quality.totalOutliers || 0}</div><div class="label">Outliers</div></div>
      <div class="stat"><div class="health-score" style="color:${scoreColor}">${score}%</div><div class="label">Health Score</div></div>
    </div>
  </div>

  <div class="section">
    <h2>Column Details</h2>
    ${columnsTable}
  </div>

  <div class="section">
    <h2>Quality Issues</h2>
    ${issuesList}
  </div>

  ${vizSection}

  ${insightsSection}

  <div class="footer">Generated by Universal Dataset Analyzer &middot; ${now}</div>
</div>
</body>
</html>`;
}

async function deleteReport(req, res, next) {
  try {
    const result = await query(
      'DELETE FROM reports WHERE id = $1 AND user_id = $2 RETURNING id, storage_key',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Report not found' });
    await deleteObject(result.rows[0].storage_key);
    res.json({ message: 'Report deleted' });
  } catch (err) { next(err); }
}

function formatSize(bytes) {
  if (bytes > 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes > 1024)    return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

module.exports = { getReports, generateReport, downloadReport, deleteReport };