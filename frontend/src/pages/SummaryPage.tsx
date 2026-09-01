import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Database, Rows3, Columns, HardDrive, Tag, ChevronDown, ChevronUp, RefreshCw, AlertCircle } from 'lucide-react';
import { Card, StatCard, Badge, Tabs } from '../components/ui';
import { datasetsApi, formatBytes, type Column } from '../services/api';
import { useStore } from '../store';

const typeColors: Record<string, 'blue' | 'green' | 'purple' | 'yellow' | 'gray'> = {
  numeric: 'blue', categorical: 'green', datetime: 'purple', boolean: 'yellow', text: 'gray',
};

export const SummaryPage: React.FC = () => {
  const { selectedDataset } = useStore();
  const [tab, setTab] = useState('columns');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ rowCount: number; columnCount: number; columns: Column[]; typeDistribution: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!selectedDataset) return;
    load();
  }, [selectedDataset?.id]);

  async function load() {
    if (!selectedDataset) return;
    setLoading(true); setError('');
    try {
      const data = await datasetsApi.getSummary(selectedDataset.id);
      if ((data as { status?: string }).status === 'processing') {
        setProcessing(true);
        setTimeout(load, 3000);
        return;
      }
      setSummary(data as typeof summary);
      setProcessing(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load summary');
    } finally {
      setLoading(false);
    }
  }

  if (!selectedDataset) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Database className="w-12 h-12 text-surface-300 mb-3" />
        <h2 className="font-semibold mb-1">No dataset selected</h2>
        <p className="text-sm text-surface-500">Go to the Upload page to upload a dataset first.</p>
      </div>
    );
  }

  if (processing || (loading && !summary)) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <RefreshCw className="w-10 h-10 text-brand-500 animate-spin mb-3" />
        <h2 className="font-semibold">Analyzing dataset...</h2>
        <p className="text-sm text-surface-500 mt-1">This may take a moment for large files.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
        <p className="text-red-500">{error}</p>
        <button onClick={load} className="btn-primary mt-3 text-sm px-4 py-2">Retry</button>
      </div>
    );
  }

  const ds = selectedDataset;
  const columns = summary?.columns || [];
  const typeCounts = summary?.typeDistribution || {};

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Database className="w-5 h-5 text-brand-500" />
            <h1 className="text-xl font-display font-bold">{ds.name}</h1>
            <Badge variant={ds.status === 'ready' ? 'green' : 'yellow'}>{ds.status}</Badge>
          </div>
          <p className="text-surface-500 text-sm">Uploaded {new Date(ds.uploadedAt).toLocaleDateString()}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className="text-xs text-surface-500">Health Score</p>
            <p className={`text-2xl font-bold font-display ${ds.healthScore > 80 ? 'text-emerald-500' : ds.healthScore > 60 ? 'text-amber-500' : 'text-red-500'}`}>{ds.healthScore}%</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Rows" value={(summary?.rowCount || ds.rows || 0).toLocaleString()} icon={<Rows3 className="w-5 h-5" />} color="brand" />
        <StatCard title="Total Columns" value={summary?.columnCount || ds.columns || 0} icon={<Columns className="w-5 h-5" />} color="purple" />
        <StatCard title="File Size" value={formatBytes(ds.size)} icon={<HardDrive className="w-5 h-5" />} color="amber" />
        <StatCard title="Column Types" value={Object.keys(typeCounts).length} icon={<Tag className="w-5 h-5" />} color="green" />
      </div>

      {Object.keys(typeCounts).length > 0 && (
        <Card className="p-6">
          <h2 className="font-display font-semibold text-base mb-4">Column Type Distribution</h2>
          <div className="flex flex-wrap gap-3">
            {Object.entries(typeCounts).map(([type, count]) => (
              <div key={type} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-50 dark:bg-surface-800">
                <Badge variant={typeColors[type] || 'gray'}>{type}</Badge>
                <span className="font-semibold">{count}</span>
                <span className="text-xs text-surface-400">cols</span>
              </div>
            ))}
          </div>
          {columns.length > 0 && (
            <div className="mt-4 h-3 rounded-full overflow-hidden flex gap-0.5">
              {Object.entries(typeCounts).map(([type, count]) => {
                const pct = (count / columns.length) * 100;
                const colors: Record<string, string> = { numeric: 'bg-brand-500', categorical: 'bg-emerald-500', datetime: 'bg-purple-500', boolean: 'bg-amber-500', text: 'bg-surface-400' };
                return <div key={type} className={`h-full ${colors[type] || 'bg-surface-400'} rounded-full`} style={{ width: `${pct}%` }} />;
              })}
            </div>
          )}
        </Card>
      )}

      <Tabs tabs={[
        { id: 'columns', label: 'Column Details' },
        { id: 'metadata', label: 'Dataset Metadata' },
      ]} active={tab} onChange={setTab} />

      {tab === 'columns' && (
        <Card className="overflow-hidden">
          {columns.length === 0 ? (
            <div className="p-8 text-center text-surface-500">No column data available yet.</div>
          ) : (
            <div className="divide-y divide-surface-100 dark:divide-surface-800">
              {columns.map(col => (
                <motion.div key={col.name} layout className="overflow-hidden">
                  <button
                    onClick={() => setExpanded(expanded === col.name ? null : col.name)}
                    className="w-full flex items-center gap-4 p-4 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors text-left"
                  >
                    <Badge variant={typeColors[col.type] || 'gray'}>{col.type}</Badge>
                    <span className="font-mono text-sm font-medium flex-1">{col.name}</span>
                    <div className="flex items-center gap-6 text-xs text-surface-500">
                      <span><span className="font-medium text-surface-700 dark:text-surface-300">{(col.uniqueCount || 0).toLocaleString()}</span> unique</span>
                      <span className={col.nullPercent > 1 ? 'text-red-500' : col.nullPercent > 0 ? 'text-amber-500' : 'text-emerald-500'}>
                        <span className="font-medium">{(col.nullPercent || 0).toFixed(2)}%</span> null
                      </span>
                    </div>
                    {expanded === col.name ? <ChevronUp className="w-4 h-4 text-surface-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-surface-400 flex-shrink-0" />}
                  </button>
                  {expanded === col.name && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                      className="px-4 pb-4 bg-surface-50 dark:bg-surface-800/30">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
                        <div className="text-center"><p className="text-xs text-surface-500">Null Count</p><p className="font-semibold mt-0.5">{col.nullCount}</p></div>
                        {col.min !== undefined && <div className="text-center"><p className="text-xs text-surface-500">Min</p><p className="font-semibold mt-0.5">{col.min}</p></div>}
                        {col.max !== undefined && <div className="text-center"><p className="text-xs text-surface-500">Max</p><p className="font-semibold mt-0.5">{col.max}</p></div>}
                        {col.mean !== undefined && <div className="text-center"><p className="text-xs text-surface-500">Mean</p><p className="font-semibold mt-0.5">{Number(col.mean).toFixed(2)}</p></div>}
                        {col.median !== undefined && <div className="text-center"><p className="text-xs text-surface-500">Median</p><p className="font-semibold mt-0.5">{Number(col.median).toFixed(2)}</p></div>}
                        {col.std !== undefined && <div className="text-center"><p className="text-xs text-surface-500">Std Dev</p><p className="font-semibold mt-0.5">{Number(col.std).toFixed(2)}</p></div>}
                      </div>
                      {col.sample?.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs text-surface-500 mb-1.5">Sample Values</p>
                          <div className="flex gap-2 flex-wrap">
                            {col.sample.map((s, i) => <span key={i} className="px-2 py-1 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg text-xs font-mono">{s}</span>)}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === 'metadata' && (
        <Card className="overflow-hidden">
          <div className="divide-y divide-surface-100 dark:divide-surface-800">
            {[
              ['File Name', ds.name],
              ['Format', ds.format?.toUpperCase()],
              ['File Size', formatBytes(ds.size)],
              ['Total Rows', (summary?.rowCount || ds.rows || 0).toLocaleString()],
              ['Total Columns', String(summary?.columnCount || ds.columns || 0)],
              ['Upload Date', new Date(ds.uploadedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })],
              ['Status', ds.status.charAt(0).toUpperCase() + ds.status.slice(1)],
              ['Health Score', `${ds.healthScore}%`],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between px-6 py-3">
                <span className="text-sm text-surface-500">{k}</span>
                <span className="text-sm font-medium">{v}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
