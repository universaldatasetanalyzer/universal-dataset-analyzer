import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Database, ShieldCheck, Upload, FileText, Sparkles, ArrowRight, Clock, Users, ChevronRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { StatCard, Card, Badge } from '../components/ui';
import { datasetsApi, dashboardApi, formatBytes, formatDate, type Dataset } from '../services/api';
import { useStore } from '../store';

const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { variant: 'green' | 'yellow' | 'red'; label: string }> = {
    ready:      { variant: 'green',  label: 'Ready' },
    processing: { variant: 'yellow', label: 'Processing' },
    error:      { variant: 'red',    label: 'Error' },
  };
  const m = map[status] || { variant: 'gray' as const, label: status };
  return <Badge variant={m.variant}>{m.label}</Badge>;
};

export const DashboardPage: React.FC = () => {
  const { datasets, setDatasets, setSelectedDataset, authUser } = useStore();
  const navigate = useNavigate();
  const [sharedDatasets, setSharedDatasets] = useState<Dataset[]>([]);
  const [stats, setStats]   = useState({ totalDatasets: 0, avgHealthScore: 0, reportsGenerated: 0, chatSessions: 0 });
  const [loading, setLoading] = useState(true);

  const monthLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const activityData = monthLabels.map((month, i) => ({
    month,
    uploads: datasets.filter(d => new Date(d.uploadedAt).getMonth() === i).length,
  }));

  useEffect(() => {
    async function load() {
      try {
        const [dsRes, statsRes] = await Promise.all([
          datasetsApi.list(),
          dashboardApi.getStats(),
        ]);
        setDatasets(dsRes.datasets);
        setSharedDatasets((dsRes as unknown as { sharedDatasets: Dataset[] }).sharedDatasets || []);
        setStats(statsRes);
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const displayName = authUser?.name?.split(' ')[0] || 'there';

  const openDataset = (ds: Dataset) => {
    setSelectedDataset(ds);
    navigate('/summary');
  };

  const DatasetRow = ({ ds, shared }: { ds: Dataset; shared?: boolean }) => (
    <tr
      onClick={() => openDataset(ds)}
      className="border-b border-surface-100 dark:border-surface-800/50 hover:bg-surface-50 dark:hover:bg-surface-800/30 transition-colors cursor-pointer"
    >
      <td className="py-3 px-4">
        <div className="flex items-center gap-2.5">
          <Database className={`w-3.5 h-3.5 flex-shrink-0 ${shared ? 'text-purple-500' : 'text-brand-500'}`} />
          <div>
            <span className="font-medium text-xs">{ds.name}</span>
            {shared && ds.sharedByName && (
              <p className="text-[10px] text-purple-400 mt-0.5">Shared by {ds.sharedByName}</p>
            )}
          </div>
        </div>
      </td>
      <td className="py-3 px-4"><Badge variant={shared ? 'purple' : 'blue'}>{shared ? 'Shared' : ds.format?.toUpperCase()}</Badge></td>
      <td className="py-3 px-4 text-xs text-surface-600 dark:text-surface-400">{formatBytes(ds.size)}</td>
      <td className="py-3 px-4 text-xs text-surface-600 dark:text-surface-400">{(ds.rows || 0).toLocaleString()}</td>
      <td className="py-3 px-4 text-xs text-surface-600 dark:text-surface-400">{ds.columns || 0}</td>
      <td className="py-3 px-4">
        {ds.status === 'ready' ? (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-16 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${ds.healthScore > 80 ? 'bg-emerald-500' : ds.healthScore > 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                style={{ width: `${ds.healthScore}%` }}
              />
            </div>
            <span className="text-xs font-medium">{ds.healthScore}%</span>
          </div>
        ) : <span className="text-xs text-surface-400">—</span>}
      </td>
      <td className="py-3 px-4"><StatusBadge status={ds.status} /></td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-1.5 text-xs text-surface-400">
          <Clock className="w-3 h-3" />{formatDate(ds.uploadedAt)}
        </div>
      </td>
      <td className="py-3 px-4 text-right">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            openDataset(ds);
          }}
          className="inline-flex items-center justify-center h-8 w-8 rounded-full text-surface-400 hover:text-brand-500 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
          aria-label={`Open ${ds.name} analysis`}
          title="Open analysis"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">

      {/* Header */}
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Good morning, {displayName} 👋</h1>
          <p className="text-surface-500 text-sm mt-1">Here's what's happening with your datasets today.</p>
        </div>
        <Link to="/upload">
          <button className="btn-primary flex items-center gap-2 text-sm px-5 py-2.5">
            <Upload className="w-4 h-4" /> Upload Dataset
          </button>
        </Link>
      </motion.div>

      {/* Stats */}
      <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Datasets"     value={stats.totalDatasets}       change="from your account"   positive icon={<Database className="w-5 h-5" />}    color="brand"   />
        <StatCard title="Avg Health Score"   value={`${stats.avgHealthScore}%`} change="across all datasets" positive icon={<ShieldCheck className="w-5 h-5" />}  color="green"   />
        <StatCard title="Reports Generated"  value={stats.reportsGenerated}     change="total"               positive icon={<FileText className="w-5 h-5" />}     color="purple"  />
        <StatCard title="Chat Sessions"      value={stats.chatSessions}         change="total"               positive icon={<Sparkles className="w-5 h-5" />}     color="amber"   />
      </motion.div>

      {/* Charts + Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div variants={item} className="lg:col-span-2">
          <Card className="p-6">
            <div className="mb-6">
              <h2 className="font-display font-semibold text-base">Upload Activity</h2>
              <p className="text-xs text-surface-500 mt-0.5">Datasets uploaded per month</p>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={activityData}>
                <defs>
                  <linearGradient id="colorUploads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#0ea5e9" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-surface-200 dark:stroke-surface-800" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }} />
                <Area type="monotone" dataKey="uploads" name="Datasets" stroke="#0ea5e9" fill="url(#colorUploads)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="p-6 h-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-base">Recent Uploads</h2>
              <Link to="/upload" className="text-xs text-brand-500 hover:text-brand-600 flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {loading ? (
              <div className="space-y-3">
                {[1,2,3,4].map(i => <div key={i} className="h-12 bg-surface-100 dark:bg-surface-800 rounded-xl animate-pulse" />)}
              </div>
            ) : datasets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <Database className="w-8 h-8 text-surface-300 mb-2" />
                <p className="text-sm text-surface-500">No datasets yet</p>
                <Link to="/upload" className="text-xs text-brand-500 mt-1">Upload your first dataset</Link>
              </div>
            ) : (
              <div className="space-y-3">
                {datasets.slice(0, 4).map((ds: Dataset) => (
                  <button key={ds.id} onClick={() => setSelectedDataset(ds)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-50 to-brand-100 dark:from-brand-950 dark:to-brand-900 flex items-center justify-center flex-shrink-0">
                      <Database className="w-4 h-4 text-brand-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{ds.name}</p>
                      <p className="text-xs text-surface-400">{formatBytes(ds.size)}</p>
                    </div>
                    <StatusBadge status={ds.status} />
                  </button>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
      </div>

      {/* My Datasets Table */}
      <motion.div variants={item}>
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between p-6 pb-4">
            <h2 className="font-display font-semibold text-base">My Datasets</h2>
            <Link to="/upload" className="text-xs text-brand-500 hover:text-brand-600 flex items-center gap-1">
              Upload new <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {loading ? (
            <div className="p-6 space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-10 bg-surface-100 dark:bg-surface-800 rounded animate-pulse" />)}
            </div>
          ) : datasets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Database className="w-10 h-10 text-surface-300 mb-3" />
              <p className="text-surface-500">No datasets uploaded yet</p>
              <Link to="/upload" className="btn-primary mt-4 text-sm px-4 py-2">Upload Dataset</Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-t border-b border-surface-100 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-800/30">
                    {['Name','Format','Size','Rows','Columns','Health','Status','Uploaded',''].map(h => (
                      <th key={h} className="text-left py-3 px-4 font-medium text-surface-500 text-xs whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {datasets.map((ds: Dataset) => <DatasetRow key={ds.id} ds={ds} />)}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </motion.div>

      {/* Shared Datasets Table */}
      {sharedDatasets.length > 0 && (
        <motion.div variants={item}>
          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 p-6 pb-4">
              <Users className="w-4 h-4 text-purple-500" />
              <h2 className="font-display font-semibold text-base">Shared with Me</h2>
              <span className="text-xs text-surface-400 ml-1">— datasets shared by your team owners</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-t border-b border-surface-100 dark:border-surface-800 bg-purple-50/30 dark:bg-purple-950/10">
                    {['Name','Type','Size','Rows','Columns','Health','Status','Uploaded',''].map(h => (
                      <th key={h} className="text-left py-3 px-4 font-medium text-surface-500 text-xs whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sharedDatasets.map((ds: Dataset) => <DatasetRow key={ds.id} ds={ds} shared />)}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>
      )}

    </motion.div>
  );
};