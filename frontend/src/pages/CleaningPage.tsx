import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Wand2, Play, Eye, Download, CheckCircle2, RefreshCw, Database, AlertCircle } from 'lucide-react';
import { Card, Badge } from '../components/ui';
import { cleaningApi, datasetsApi, type Column, type CleanOperations, type CleanResult } from '../services/api';
import { useStore } from '../store';

export const CleaningPage: React.FC = () => {
  const { selectedDataset } = useStore();
  const [columns, setColumns] = useState<Column[]>([]);
  const [applying, setApplying] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [result, setResult] = useState<CleanResult | null>(null);
  const [error, setError] = useState('');

  const [ops, setOps] = useState<CleanOperations>({
    removeDuplicates: false,
    dropEmptyColumns: false,
    fillMissing: {},
    outliers: {},
    text: {},
  });

  useEffect(() => {
    if (!selectedDataset) return;
    datasetsApi.getSummary(selectedDataset.id).then((data: unknown) => {
      const summary = data as { columns: Column[] };
      if (summary?.columns) setColumns(summary.columns);
    });
  }, [selectedDataset?.id]);

  const setFillMethod = (col: string, method: string) => {
    setOps(prev => ({ ...prev, fillMissing: { ...prev.fillMissing, [col]: method } }));
  };
  const setOutlierMethod = (col: string, method: string) => {
    setOps(prev => ({ ...prev, outliers: { ...prev.outliers, [col]: method } }));
  };
  const toggleTextOp = (col: string, op: string) => {
    setOps(prev => {
      const current = (prev.text?.[col] as string[]) || [];
      const updated = current.includes(op) ? current.filter(o => o !== op) : [...current, op];
      return { ...prev, text: { ...prev.text, [col]: updated } };
    });
  };

  const hasOps = ops.removeDuplicates || ops.dropEmptyColumns
    || Object.keys(ops.fillMissing || {}).length > 0
    || Object.keys(ops.outliers || {}).length > 0
    || Object.values(ops.text || {}).some(v => (v as string[]).length > 0);

  async function preview() {
    if (!selectedDataset || !hasOps) return;
    setPreviewing(true); setError('');
    try {
      const r = await cleaningApi.preview(selectedDataset.id, ops);
      setResult(r);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setPreviewing(false);
    }
  }

  async function apply() {
    if (!selectedDataset || !hasOps) return;
    setApplying(true); setError('');
    try {
      const r = await cleaningApi.apply(selectedDataset.id, ops);
      setResult(r);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Cleaning failed');
    } finally {
      setApplying(false);
    }
  }

  if (!selectedDataset) return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <Database className="w-12 h-12 text-surface-300 mb-3" />
      <h2 className="font-semibold mb-1">No dataset selected</h2>
    </div>
  );

  const numericCols = columns.filter(c => c.type === 'numeric');
  const catCols = columns.filter(c => c.type === 'categorical' || c.type === 'text');
  const colsWithMissing = columns.filter(c => c.nullCount > 0);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2"><Wand2 className="w-6 h-6 text-brand-500" /> Data Cleaning</h1>
          <p className="text-surface-500 text-sm mt-1">{selectedDataset.name}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={preview} disabled={!hasOps || previewing}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl border border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800 disabled:opacity-50">
            {previewing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
            Preview
          </button>
          <button onClick={apply} disabled={!hasOps || applying}
            className="btn-primary flex items-center gap-2 text-sm px-4 py-2 disabled:opacity-50">
            {applying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Apply
          </button>
          {result?.cleanedFilePath && (
            <button onClick={() => datasetsApi.downloadClean(selectedDataset.id)}
              className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600">
              <Download className="w-4 h-4" /> Download
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* General operations */}
        <Card className="p-5">
          <h2 className="font-semibold text-sm mb-4">General Operations</h2>
          <div className="space-y-3">
            <label className="flex items-center justify-between p-3 rounded-xl bg-surface-50 dark:bg-surface-800 cursor-pointer hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors">
              <div>
                <p className="text-sm font-medium">Remove Duplicate Rows</p>
                <p className="text-xs text-surface-400">Delete exact duplicate records</p>
              </div>
              <input type="checkbox" checked={ops.removeDuplicates || false}
                onChange={e => setOps(p => ({ ...p, removeDuplicates: e.target.checked }))}
                className="rounded" />
            </label>
            <label className="flex items-center justify-between p-3 rounded-xl bg-surface-50 dark:bg-surface-800 cursor-pointer hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors">
              <div>
                <p className="text-sm font-medium">Drop Empty Columns</p>
                <p className="text-xs text-surface-400">Remove columns with all null values</p>
              </div>
              <input type="checkbox" checked={ops.dropEmptyColumns || false}
                onChange={e => setOps(p => ({ ...p, dropEmptyColumns: e.target.checked }))}
                className="rounded" />
            </label>
          </div>
        </Card>

        {/* Fill missing values */}
        {colsWithMissing.length > 0 && (
          <Card className="p-5">
            <h2 className="font-semibold text-sm mb-4">Fill Missing Values</h2>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {colsWithMissing.map(col => (
                <div key={col.name} className="flex items-center gap-2 p-2 rounded-lg bg-surface-50 dark:bg-surface-800">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{col.name}</p>
                    <p className="text-xs text-surface-400">{col.nullPercent.toFixed(1)}% missing</p>
                  </div>
                  <select value={ops.fillMissing?.[col.name] || ''} onChange={e => setFillMethod(col.name, e.target.value)}
                    className="text-xs px-2 py-1 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900">
                    <option value="">None</option>
                    {col.type === 'numeric' && <><option value="mean">Mean</option><option value="median">Median</option></>}
                    <option value="mode">Mode</option>
                    <option value="drop">Drop rows</option>
                  </select>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Outlier handling */}
        {numericCols.length > 0 && (
          <Card className="p-5">
            <h2 className="font-semibold text-sm mb-4">Outlier Handling</h2>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {numericCols.map(col => (
                <div key={col.name} className="flex items-center gap-2 p-2 rounded-lg bg-surface-50 dark:bg-surface-800">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{col.name}</p>
                    <p className="text-xs text-surface-400">numeric</p>
                  </div>
                  <select value={ops.outliers?.[col.name] || ''} onChange={e => setOutlierMethod(col.name, e.target.value)}
                    className="text-xs px-2 py-1 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900">
                    <option value="">None</option>
                    <option value="remove">Remove</option>
                    <option value="cap">Cap (IQR)</option>
                    <option value="winsorize">Winsorize (5-95%)</option>
                  </select>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Text normalization */}
        {catCols.length > 0 && (
          <Card className="p-5">
            <h2 className="font-semibold text-sm mb-4">Text Normalization</h2>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {catCols.map(col => (
                <div key={col.name} className="p-2 rounded-lg bg-surface-50 dark:bg-surface-800">
                  <p className="text-xs font-medium mb-2">{col.name}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {['trim', 'lowercase', 'uppercase', 'titlecase'].map(op => {
                      const selected = ((ops.text?.[col.name] as string[]) || []).includes(op);
                      return (
                        <button key={op} onClick={() => toggleTextOp(col.name, op)}
                          className={`text-xs px-2 py-0.5 rounded-md transition-colors ${selected ? 'bg-brand-500 text-white' : 'bg-surface-200 dark:bg-surface-700 hover:bg-brand-100 dark:hover:bg-brand-900'}`}>
                          {op}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Results */}
      {result && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <h2 className="font-semibold text-sm">{(result as {previewMode?:boolean}).previewMode ? 'Preview Results' : 'Cleaning Applied Successfully'}</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              {[
                ['Rows Before', result.rowsBefore?.toLocaleString()],
                ['Rows After', result.rowsAfter?.toLocaleString()],
                ['Rows Removed', result.rowsRemoved?.toLocaleString()],
                ['Operations', result.applied?.length],
              ].map(([label, value]) => (
                <div key={label} className="text-center p-3 rounded-xl bg-surface-50 dark:bg-surface-800">
                  <p className="text-xl font-bold font-display">{value}</p>
                  <p className="text-xs text-surface-400 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
            {result.applied?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-surface-500 mb-2">Operations Applied:</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.applied.map((op, i) => (
                    <Badge key={i} variant="green">{op.op.replace('.', ': ')}</Badge>
                  ))}
                </div>
              </div>
            )}
            {result.preview?.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-medium text-surface-500 mb-2">Preview (first {result.preview.length} rows):</p>
                <div className="overflow-x-auto rounded-xl border border-surface-200 dark:border-surface-800">
                  <table className="text-xs w-full">
                    <thead>
                      <tr className="bg-surface-50 dark:bg-surface-800">
                        {Object.keys(result.preview[0]).slice(0, 6).map(k => (
                          <th key={k} className="px-3 py-2 text-left font-medium text-surface-500 whitespace-nowrap">{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.preview.slice(0, 5).map((row, i) => (
                        <tr key={i} className="border-t border-surface-100 dark:border-surface-800">
                          {Object.values(row).slice(0, 6).map((v, j) => (
                            <td key={j} className="px-3 py-2 text-surface-600 dark:text-surface-400">{String(v ?? '')}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Card>
        </motion.div>
      )}
    </div>
  );
};
