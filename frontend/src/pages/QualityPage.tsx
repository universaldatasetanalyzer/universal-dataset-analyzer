import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, AlertCircle, AlertTriangle, Info, RefreshCw, Database } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, StatCard, Badge } from '../components/ui';
import { datasetsApi, type QualityData } from '../services/api';
import { useStore } from '../store';

const severityIcon = (s: string) => {
  if (s === 'high') return <AlertCircle className="w-4 h-4 text-red-500" />;
  if (s === 'medium') return <AlertTriangle className="w-4 h-4 text-amber-500" />;
  return <Info className="w-4 h-4 text-blue-500" />;
};

const severityBadge = (s: string) => {
  if (s === 'high') return <Badge variant="red">High</Badge>;
  if (s === 'medium') return <Badge variant="yellow">Medium</Badge>;
  return <Badge variant="blue">Low</Badge>;
};

export const QualityPage: React.FC = () => {
  const { selectedDataset } = useStore();
  const [quality, setQuality] = useState<QualityData | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (selectedDataset) load(); }, [selectedDataset?.id]);

  async function load() {
    if (!selectedDataset) return;
    setLoading(true); setError('');
    try {
      const data = await datasetsApi.getQuality(selectedDataset.id);
      if ((data as { status?: string }).status === 'processing') {
        setProcessing(true);
        setTimeout(load, 3000);
        return;
      }
      setQuality(data as QualityData);
      setProcessing(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load quality data');
    } finally {
      setLoading(false);
    }
  }

  if (!selectedDataset) return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <Database className="w-12 h-12 text-surface-300 mb-3" />
      <h2 className="font-semibold mb-1">No dataset selected</h2>
      <p className="text-sm text-surface-500">Upload a dataset first to see quality metrics.</p>
    </div>
  );

  if (processing || (loading && !quality)) return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <RefreshCw className="w-10 h-10 text-brand-500 animate-spin mb-3" />
      <h2 className="font-semibold">Analyzing data quality...</h2>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
      <p className="text-red-500">{error}</p>
      <button onClick={load} className="btn-primary mt-3 text-sm px-4 py-2">Retry</button>
    </div>
  );

  if (!quality) return null;

  const issuesByType = quality.issues.reduce<Record<string, number>>((acc, i) => {
    acc[i.type] = (acc[i.type] || 0) + 1;
    return acc;
  }, {});

  const pieData = quality.issueDistribution?.filter(d => d.value > 0) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Data Quality Report</h1>
          <p className="text-surface-500 text-sm mt-1">{selectedDataset.name}</p>
        </div>
        <div className="flex flex-col items-center">
          <div className={`text-4xl font-bold font-display ${quality.healthScore > 80 ? 'text-emerald-500' : quality.healthScore > 60 ? 'text-amber-500' : 'text-red-500'}`}>
            {quality.healthScore}%
          </div>
          <p className="text-xs text-surface-500 mt-0.5">Health Score</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Issues" value={quality.issues.length} icon={<AlertTriangle className="w-5 h-5" />} color={quality.issues.length === 0 ? 'green' : 'amber'} />
        <StatCard title="Missing Values" value={quality.totalMissing?.toLocaleString() || 0} icon={<AlertCircle className="w-5 h-5" />} color="amber" />
        <StatCard title="Duplicate Rows" value={quality.totalDuplicates?.toLocaleString() || 0} icon={<AlertCircle className="w-5 h-5" />} color="red" />
        <StatCard title="Outliers" value={quality.totalOutliers?.toLocaleString() || 0} icon={<ShieldCheck className="w-5 h-5" />} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {pieData.length > 0 && (
          <Card className="p-6">
            <h2 className="font-display font-semibold text-base mb-4">Issue Distribution</h2>
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" stroke="none">
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2.5">
                {pieData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.fill }} />
                      <span className="text-sm">{item.name}</span>
                    </div>
                    <span className="font-semibold text-sm">{item.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

        {quality.missingByColumn && quality.missingByColumn.length > 0 && (
          <Card className="p-6">
            <h2 className="font-display font-semibold text-base mb-4">Missing Values by Column</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={quality.missingByColumn.slice(0, 8)} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-surface-200 dark:stroke-surface-800" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} tickFormatter={v => v.length > 8 ? v.slice(0, 8) + '…' : v} />
                <YAxis tick={{ fontSize: 10 }} unit="%" />
                <Tooltip formatter={(v: unknown) => [`${Number(v).toFixed(2)}%`, 'Missing']} />
                <Bar dataKey="pct" name="Missing %" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>

      <Card>
        <div className="p-5 border-b border-surface-100 dark:border-surface-800 flex items-center justify-between">
          <h2 className="font-display font-semibold text-base">Quality Issues ({quality.issues.length})</h2>
          <div className="flex gap-2">
            {Object.entries(issuesByType).map(([type, count]) => (
              <Badge key={type} variant="gray">{count} {type}</Badge>
            ))}
          </div>
        </div>
        {quality.issues.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ShieldCheck className="w-10 h-10 text-emerald-500 mb-3" />
            <p className="font-semibold text-emerald-600 dark:text-emerald-400">No issues found!</p>
            <p className="text-sm text-surface-500 mt-1">Your dataset is clean and ready for analysis.</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-100 dark:divide-surface-800">
            {quality.issues.map((issue, i) => (
              <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                className="flex items-start gap-4 p-4">
                {severityIcon(issue.severity)}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium capitalize">{issue.type} Issue</span>
                    {issue.column && <Badge variant="blue">{issue.column}</Badge>}
                    {severityBadge(issue.severity)}
                  </div>
                  <p className="text-sm text-surface-500">{issue.description}</p>
                  <p className="text-xs text-surface-400 mt-0.5">{issue.count.toLocaleString()} affected records</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
