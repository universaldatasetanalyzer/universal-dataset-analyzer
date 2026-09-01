import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Plus, Trash2, Download, RefreshCw, Clock } from 'lucide-react';
import { Card, Badge } from '../components/ui';
import { reportsApi, datasetsApi, formatDate, type Report, type Dataset } from '../services/api';

export const ReportsPage: React.FC = () => {
  const [reports, setReports]     = useState<Report[]>([]);
  const [datasets, setDatasets]   = useState<Dataset[]>([]);
  const [loading, setLoading]     = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showForm, setShowForm]   = useState(false);
  const [datasetId, setDatasetId] = useState('');

  useEffect(() => {
    Promise.all([reportsApi.list(), datasetsApi.list()]).then(([r, d]) => {
      setReports(r.reports);
      const own    = d.datasets.filter(ds => ds.status === 'ready');
      const shared = ((d as unknown as { sharedDatasets: Dataset[] }).sharedDatasets || []).filter(ds => ds.status === 'ready');
      setDatasets([...own, ...shared]);
      setLoading(false);
    });
    const poll = setInterval(async () => {
      const r = await reportsApi.list();
      setReports(r.reports);
    }, 5000);
    return () => clearInterval(poll);
  }, []);

  async function generate() {
    if (!datasetId) return;
    setGenerating(true);
    try {
      const res = await reportsApi.generate(datasetId, 'full');
      setReports(prev => [res.report, ...prev]);
      setShowForm(false);
      setDatasetId('');
    } catch (err) { console.error(err); }
    finally { setGenerating(false); }
  }

  async function deleteReport(id: string) {
    try {
      await reportsApi.delete(id);
      setReports(prev => prev.filter(r => r.id !== id));
    } catch (err) { console.error(err); }
  }

  const statusBadge = (s: string) => {
    if (s === 'ready')      return <Badge variant="green">Ready</Badge>;
    if (s === 'generating') return <Badge variant="yellow">Generating…</Badge>;
    if (s === 'error')      return <Badge variant="red">Error</Badge>;
    return <Badge variant="gray">{s}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Reports</h1>
          <p className="text-surface-500 text-sm mt-1">Generate and download dataset reports</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2 text-sm px-4 py-2.5">
          <Plus className="w-4 h-4" /> Generate Report
        </button>
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="p-6">
            <h2 className="font-semibold text-sm mb-4">New Report</h2>
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <label className="text-xs font-medium text-surface-500 mb-1 block">Dataset</label>
                <select
                  value={datasetId}
                  onChange={e => setDatasetId(e.target.value)}
                  className="input w-full text-sm py-2"
                >
                  <option value="">Select dataset…</option>
                  {datasets.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.source === 'shared' ? `📤 ${d.name} (shared by ${d.sharedByName})` : d.name}
                  </option>
                ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={generate}
                  disabled={!datasetId || generating}
                  className="btn-primary text-sm px-4 py-2 disabled:opacity-50 flex items-center gap-2"
                >
                  {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  Generate
                </button>
                <button
                  onClick={() => { setShowForm(false); setDatasetId(''); }}
                  className="text-sm px-4 py-2 rounded-xl border border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-14 bg-surface-100 dark:bg-surface-800 rounded-xl animate-pulse" />)}
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <FileText className="w-10 h-10 text-surface-300 mb-3" />
            <p className="text-surface-500 text-sm">No reports generated yet</p>
            <button onClick={() => setShowForm(true)} className="btn-primary mt-4 text-sm px-4 py-2">Generate your first report</button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-100 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-800/30">
                {['Name', 'Dataset', 'Status', 'Size', 'Created', ''].map(h => (
                  <th key={h} className="text-left py-3 px-4 font-medium text-surface-500 text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reports.map(r => (
                <tr key={r.id} className="border-b border-surface-100 dark:border-surface-800/50 hover:bg-surface-50 dark:hover:bg-surface-800/30 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <FileText className="w-4 h-4 text-brand-500" />
                      <span className="font-medium text-xs">{r.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-xs text-surface-500">{r.datasetName || '—'}</td>
                  <td className="py-3 px-4">{statusBadge(r.status)}</td>
                  <td className="py-3 px-4 text-xs text-surface-400">{r.size || '—'}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5 text-xs text-surface-400">
                      <Clock className="w-3 h-3" />{formatDate(r.createdAt)}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {r.status === 'ready' && (
                        <button onClick={() => reportsApi.download(r.id)} className="text-brand-500 hover:text-brand-600 transition-colors">
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => deleteReport(r.id)} className="text-surface-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
};