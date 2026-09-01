import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, CheckCircle2, AlertCircle, Clock, Database, ArrowRight, Trash2, Lock, Sparkles } from 'lucide-react';
import { Card, Badge, Progress } from '../components/ui';
import { datasetsApi, formatBytes, formatDate, type Dataset } from '../services/api';
import { useStore } from '../store';
import { useNavigate } from 'react-router-dom';

interface UploadFile {
  id: string;
  file: File;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  error?: string;
  datasetId?: string;
}

const ACCEPTED = ['.csv', '.xlsx', '.xls', '.tsv', '.json'];

export const UploadPage: React.FC = () => {
  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState<UploadFile[]>([]);
  const { datasets, setDatasets, setSelectedDataset, authUser } = useStore();
  const [loadingHistory, setLoadingHistory] = useState(true);
  const navigate = useNavigate();
  const isPro = authUser?.plan === 'pro';

  const refreshHistory = useCallback(async () => {
    try {
      const res = await datasetsApi.list();
      setDatasets(res.datasets);
    } catch {
      // Keep the current view if the refresh fails; the next poll can recover.
    } finally {
      setLoadingHistory(false);
    }
  }, [setDatasets]);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  useEffect(() => {
    if (!datasets.some(ds => ds.status === 'processing')) return;

    const interval = window.setInterval(refreshHistory, 4000);
    return () => window.clearInterval(interval);
  }, [datasets, refreshHistory]);

  const startUpload = useCallback((rawFiles: File[]) => {
    const newFiles: UploadFile[] = rawFiles.map(f => ({
      id: Math.random().toString(36).slice(2),
      file: f,
      progress: 0,
      status: 'uploading',
    }));
    setFiles(prev => [...newFiles, ...prev]);

    newFiles.forEach(uf => {
      datasetsApi.upload(uf.file, (pct) => {
        setFiles(prev => prev.map(f => f.id === uf.id ? { ...f, progress: pct } : f));
      }).then((res: { dataset: Dataset }) => {
        setFiles(prev => prev.map(f => f.id === uf.id
          ? { ...f, progress: 100, status: 'success', datasetId: res.dataset.id } : f));
        setSelectedDataset(res.dataset);
        refreshHistory();
      }).catch((err: Error) => {
        setFiles(prev => prev.map(f => f.id === uf.id
          ? { ...f, progress: 100, status: 'error', error: err.message } : f));
      });
    });
  }, [refreshHistory, setSelectedDataset]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length) startUpload(dropped);
  }, [startUpload]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) startUpload(Array.from(e.target.files));
  };

  const removeFile = (id: string) => setFiles(prev => prev.filter(f => f.id !== id));

  const deleteDataset = async (id: string) => {
    const dataset = datasets.find(ds => ds.id === id);
    if (!dataset || !window.confirm(`Delete ${dataset.name}? This removes the uploaded file, analysis results, and cleaned copy.`)) return;
    try {
      await datasetsApi.delete(id);
      setDatasets(datasets.filter(ds => ds.id !== id));
      if (useStore.getState().selectedDataset?.id === id) setSelectedDataset(null);
      await refreshHistory();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const fileIcon = (status: string) => {
    if (status === 'success') return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
    if (status === 'error') return <AlertCircle className="w-5 h-5 text-red-500" />;
    return <Clock className="w-5 h-5 text-brand-500 animate-pulse" />;
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Upload Dataset</h1>
        <p className="text-surface-500 text-sm mt-1">Upload CSV, Excel, JSON, or TSV files for analysis.</p>
      </div>

      <div
        onDragOver={e => { if (!isPro) return; e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={isPro ? handleDrop : (e) => e.preventDefault()}
        className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 group
          ${!isPro
            ? 'border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-800/30 cursor-default'
            : dragging
              ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/20 scale-[1.01] cursor-pointer'
              : 'border-surface-300 dark:border-surface-700 hover:border-brand-400 dark:hover:border-brand-600 hover:bg-surface-50 dark:hover:bg-surface-800/30 cursor-pointer'
          }`}
      >
        {isPro && (
          <input type="file" multiple accept={ACCEPTED.join(',')} onChange={handleInput}
            className="absolute inset-0 opacity-0 cursor-pointer" />
        )}
        {isPro ? (
          <motion.div animate={{ scale: dragging ? 1.1 : 1 }} transition={{ duration: 0.2 }}>
            <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4 transition-colors ${dragging ? 'bg-brand-100 dark:bg-brand-900' : 'bg-surface-100 dark:bg-surface-800 group-hover:bg-brand-50 dark:group-hover:bg-brand-950/30'}`}>
              <Upload className={`w-7 h-7 transition-colors ${dragging ? 'text-brand-600' : 'text-surface-400 group-hover:text-brand-500'}`} />
            </div>
            <h3 className="text-base font-semibold mb-1">{dragging ? 'Drop your files here' : 'Drag & drop your files'}</h3>
            <p className="text-sm text-surface-500 mb-4">or <span className="text-brand-500 font-medium">browse from your computer</span></p>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {ACCEPTED.map(ext => (
                <span key={ext} className="px-2.5 py-1 bg-surface-100 dark:bg-surface-800 rounded-lg text-xs font-mono text-surface-500">{ext}</span>
              ))}
            </div>
            <p className="text-xs text-surface-400 mt-3">Max file size: 500 MB</p>
          </motion.div>
        ) : (
          <div>
            <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4 bg-surface-100 dark:bg-surface-800">
              <Lock className="w-7 h-7 text-surface-400" />
            </div>
            <h3 className="text-base font-semibold mb-1">Uploading your own data needs Pro</h3>
            <p className="text-sm text-surface-500 mb-5 max-w-sm mx-auto">
              Your free plan comes with a demo dataset you can fully explore below — clean it, chat with it,
              see every analysis. Upgrade to upload CSV, Excel, JSON, or TSV files of your own.
            </p>
            <button
              onClick={() => navigate('/billing')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              Upgrade to Pro
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {files.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className="overflow-hidden">
              <div className="p-4 border-b border-surface-200 dark:border-surface-800 flex items-center justify-between">
                <h3 className="font-semibold text-sm">Upload Queue ({files.length})</h3>
                <span className="text-xs text-surface-400">{files.filter(f => f.status === 'success').length}/{files.length} complete</span>
              </div>
              <div className="divide-y divide-surface-100 dark:divide-surface-800">
                {files.map(f => (
                  <motion.div key={f.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-4 p-4">
                    {fileIcon(f.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{f.file.name}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <Progress value={f.progress} className="flex-1"
                          color={f.status === 'error' ? 'bg-red-500' : f.status === 'success' ? 'bg-emerald-500' : 'bg-brand-500'} />
                        <span className="text-xs text-surface-400 flex-shrink-0">
                          {f.status === 'uploading' ? `${Math.round(f.progress)}%` : formatBytes(f.file.size)}
                        </span>
                      </div>
                      {f.status === 'error' && <p className="text-xs text-red-500 mt-1">{f.error}</p>}
                      {f.status === 'success' && f.datasetId && (
                        <button
                          onClick={() => {
                            const uploadedDataset = useStore.getState().datasets.find(ds => ds.id === f.datasetId);
                            if (uploadedDataset) setSelectedDataset(uploadedDataset);
                            navigate('/summary');
                          }}
                          className="text-xs text-brand-500 mt-1 flex items-center gap-1 hover:text-brand-600"
                        >
                          View analysis <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <button onClick={() => removeFile(f.id)} className="text-surface-400 hover:text-surface-600 transition-colors ml-2">
                      <X className="w-4 h-4" />
                    </button>
                  </motion.div>
                ))}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div>
        <h2 className="font-display font-semibold text-base mb-4">Upload History</h2>
        <Card className="overflow-hidden">
          {loadingHistory ? (
            <div className="p-6 space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-14 bg-surface-100 dark:bg-surface-800 rounded-xl animate-pulse" />)}
            </div>
          ) : datasets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Database className="w-10 h-10 text-surface-300 mb-3" />
              <p className="text-surface-500 text-sm">No datasets uploaded yet</p>
            </div>
          ) : (
            <div className="divide-y divide-surface-100 dark:divide-surface-800">
              {datasets.map((ds: Dataset) => (
                <div key={ds.id} className="flex items-center gap-4 p-4 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors group">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 dark:from-brand-950 dark:to-brand-900 flex items-center justify-center flex-shrink-0">
                    <Database className="w-5 h-5 text-brand-500" />
                  </div>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { setSelectedDataset(ds); navigate('/summary'); }}>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{ds.name}</p>
                      {ds.isDemo && <Badge variant="purple">Demo</Badge>}
                    </div>
                    <p className="text-xs text-surface-400">{formatBytes(ds.size)} · {(ds.rows || 0).toLocaleString()} rows · {formatDate(ds.uploadedAt)}</p>
                  </div>
                  <Badge variant={ds.status === 'ready' ? 'green' : ds.status === 'processing' ? 'yellow' : 'red'}>
                    {ds.status}
                  </Badge>
                  <button onClick={() => deleteDataset(ds.id)}
                    className="text-surface-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 ml-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <ArrowRight className="w-4 h-4 text-surface-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    onClick={() => { setSelectedDataset(ds); navigate('/summary'); }} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
