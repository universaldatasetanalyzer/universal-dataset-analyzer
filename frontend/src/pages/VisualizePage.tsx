import React, { useState, useEffect } from 'react';
import { RefreshCw, Database, BarChart3 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, Cell, LineChart, Line, PieChart, Pie, Legend,
  ComposedChart,
} from 'recharts';
import { Card } from '../components/ui';
import { datasetsApi, type VizData } from '../services/api';
import { useStore } from '../store';

const COLORS = ['#0ea5e9','#d946ef','#10b981','#f59e0b','#6366f1','#ec4899','#14b8a6','#f97316','#8b5cf6','#06b6d4'];

// ── Custom Tooltip ────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; fill?: string; color?: string }[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl border border-surface-700">
      {label && <p className="font-semibold mb-1 text-surface-200">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.fill || p.color || '#fff' }}>
          {p.name}: <span className="font-mono font-bold">{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</span>
        </p>
      ))}
    </div>
  );
};

// ── Box Plot Stats Badge ──────────────────────────────────────────────────────
const StatBadge = ({ label, value }: { label: string; value: number }) => (
  <div className="flex flex-col items-center bg-surface-100 dark:bg-surface-800 rounded-lg px-3 py-2">
    <span className="text-[10px] text-surface-400 uppercase tracking-wide">{label}</span>
    <span className="text-sm font-mono font-bold text-surface-800 dark:text-surface-100">{value.toLocaleString()}</span>
  </div>
);

export const VisualizePage: React.FC = () => {
  const { selectedDataset } = useStore();
  const [viz, setViz] = useState<VizData | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (selectedDataset) load(); }, [selectedDataset?.id]);

  async function load() {
    if (!selectedDataset) return;
    setLoading(true); setError('');
    try {
      const data = await datasetsApi.getVisualization(selectedDataset.id);
      if ((data as { status?: string }).status === 'processing') {
        setProcessing(true);
        setTimeout(load, 3000);
        return;
      }
      setViz(data as VizData);
      setProcessing(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load visualization data');
    } finally {
      setLoading(false);
    }
  }

  // ── Empty States ─────────────────────────────────────────────────────────
  if (!selectedDataset) return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <Database className="w-12 h-12 text-surface-300 mb-3" />
      <h2 className="font-semibold mb-1">No dataset selected</h2>
      <p className="text-sm text-surface-500">Upload a dataset to visualize its data.</p>
    </div>
  );

  if (processing || (loading && !viz)) return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <RefreshCw className="w-10 h-10 text-brand-500 animate-spin mb-3" />
      <h2 className="font-semibold">Generating visualizations...</h2>
      <p className="text-sm text-surface-400 mt-1">Analyzing your dataset, this may take a moment.</p>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <p className="text-red-500 font-medium">{error}</p>
      <button onClick={load} className="btn-primary mt-3 text-sm px-4 py-2">Retry</button>
    </div>
  );

  if (!viz || viz.charts.length === 0) return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <BarChart3 className="w-12 h-12 text-surface-300 mb-3" />
      <p className="text-surface-500">No visualization data available for this dataset.</p>
    </div>
  );

  // ── Chart Renderers ───────────────────────────────────────────────────────
  const renderChart = (chart: VizData['charts'][number], idx: number) => {

    // ── 1 & 2. Histogram & Bar ─────────────────────────────────────────────
    if (chart.type === 'histogram' || chart.type === 'bar') {
      const dataKey = chart.type === 'histogram' ? 'count' : 'value';
      const nameKey = chart.type === 'histogram' ? 'bin' : 'name';
      const label   = chart.type === 'histogram' ? 'Distribution' : 'Bar Chart';
      return (
        <Card key={idx} className="p-5">
          <h3 className="font-semibold text-sm mb-0.5 truncate">{chart.column}</h3>
          <p className="text-xs text-surface-400 mb-4">{label}</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chart.data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-surface-200 dark:stroke-surface-800" />
              <XAxis
                dataKey={nameKey}
                tick={{ fontSize: 10 }}
                tickFormatter={v => String(v).length > 9 ? String(v).slice(0, 9) + '…' : String(v)}
              />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey={dataKey} radius={[4, 4, 0, 0]}>
                {chart.data.map((entry, i) => (
                  <Cell key={i} fill={(entry as { color?: string }).color || COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      );
    }

    // ── 3. Scatter Plot ────────────────────────────────────────────────────
    if (chart.type === 'scatter' && chart.columns) {
      return (
        <Card key={idx} className="p-5">
          <h3 className="font-semibold text-sm mb-0.5">{chart.columns[0]} vs {chart.columns[1]}</h3>
          <p className="text-xs text-surface-400 mb-4">Scatter Plot — Bivariate Analysis</p>
          <ResponsiveContainer width="100%" height={220}>
            <ScatterChart margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-surface-200 dark:stroke-surface-800" />
              <XAxis dataKey="x" name={chart.columns[0]} tick={{ fontSize: 10 }} type="number" />
              <YAxis dataKey="y" name={chart.columns[1]} tick={{ fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
              <Scatter data={chart.data} fill="#0ea5e9" opacity={0.65} />
            </ScatterChart>
          </ResponsiveContainer>
        </Card>
      );
    }

    // ── 4. Box Plot ────────────────────────────────────────────────────────
    if (chart.type === 'boxplot') {
      type BoxData = { min: number; q1: number; median: number; q3: number; max: number; mean?: number; outlierCount?: number };
      const d = chart.data as unknown as BoxData;
      const barData = [
        { name: 'Min',    value: d.min },
        { name: 'Q1',     value: d.q1 },
        { name: 'Median', value: d.median },
        { name: 'Mean',   value: d.mean ?? d.median },
        { name: 'Q3',     value: d.q3 },
        { name: 'Max',    value: d.max },
      ];
      return (
        <Card key={idx} className="p-5">
          <h3 className="font-semibold text-sm mb-0.5 truncate">{chart.column}</h3>
          <p className="text-xs text-surface-400 mb-3">Box Plot — Statistical Distribution</p>
          {/* Stats badges row */}
          <div className="flex gap-2 mb-4 flex-wrap">
            <StatBadge label="Min"    value={d.min} />
            <StatBadge label="Q1"     value={d.q1} />
            <StatBadge label="Median" value={d.median} />
            <StatBadge label="Q3"     value={d.q3} />
            <StatBadge label="Max"    value={d.max} />
            {d.outlierCount !== undefined && d.outlierCount > 0 && (
              <div className="flex flex-col items-center bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                <span className="text-[10px] text-red-400 uppercase tracking-wide">Outliers</span>
                <span className="text-sm font-mono font-bold text-red-500">{d.outlierCount}</span>
              </div>
            )}
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={barData} margin={{ top: 0, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-surface-200 dark:stroke-surface-800" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {barData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      );
    }

    // ── 5. Line Chart — Time Series ────────────────────────────────────────
    if (chart.type === 'line') {
      return (
        <Card key={idx} className="p-5">
          <h3 className="font-semibold text-sm mb-0.5 truncate">{chart.column}</h3>
          <p className="text-xs text-surface-400 mb-4">Monthly Trend</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chart.data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-surface-200 dark:stroke-surface-800" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 9 }}
                tickFormatter={v => String(v).slice(0, 7)}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="records"
                stroke="#0ea5e9"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#0ea5e9' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      );
    }

    // ── 6. Pie / Donut Chart ───────────────────────────────────────────────
    if (chart.type === 'pie') {
      const title = (chart as unknown as { title?: string }).title || 'Overview';
      return (
        <Card key={idx} className="p-5">
          <h3 className="font-semibold text-sm mb-0.5">{title}</h3>
          <p className="text-xs text-surface-400 mb-2">Pie Chart</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={chart.data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={78}
                innerRadius={42}
                paddingAngle={3}
                strokeWidth={0}
              >
                {chart.data.map((entry, i) => (
                  <Cell key={i} fill={(entry as { fill?: string }).fill || COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      );
    }

    // ── 8. Cumulative Distribution ─────────────────────────────────────────
    // chart type جديد من main.py — بيوضح top categories وتراكمها
    if (chart.type === 'cumulative') {
      return (
        <Card key={idx} className="p-5">
          <h3 className="font-semibold text-sm mb-0.5 truncate">{chart.column}</h3>
          <p className="text-xs text-surface-400 mb-4">Cumulative Distribution (Pareto)</p>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={chart.data} margin={{ top: 4, right: 24, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-surface-200 dark:stroke-surface-800" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10 }}
                tickFormatter={v => String(v).length > 8 ? String(v).slice(0, 8) + '…' : String(v)}
              />
              <YAxis yAxisId="left"  tick={{ fontSize: 10 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} unit="%" domain={[0, 100]} />
              <Tooltip content={<CustomTooltip />} />
              <Bar yAxisId="left" dataKey="count" radius={[4, 4, 0, 0]} fill="#0ea5e9" opacity={0.85} name="Count" />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cumulative"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ r: 3, fill: '#f59e0b' }}
                name="Cumulative %"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
      );
    }

    return null;
  };

  // ── Separate chart groups for layout ─────────────────────────────────────
  const normalCharts = viz.charts.filter(c => c.type !== 'cumulative');
  const cumulativeCharts = viz.charts.filter(c => c.type === 'cumulative');

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Visualizations</h1>
          <p className="text-surface-500 text-sm mt-1">
            {selectedDataset.name} — {viz.charts.length} charts generated
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border border-surface-200 dark:border-surface-700 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Main charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {normalCharts.map((chart, idx) => renderChart(chart, idx))}
      </div>

      {/* Cumulative charts — full-width row */}
      {cumulativeCharts.length > 0 && (
        <>
          <div>
            <h2 className="text-base font-semibold mb-1">Cumulative Distributions</h2>
            <p className="text-xs text-surface-400">Shows how top categories accumulate — useful for Pareto analysis (80/20 rule).</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {cumulativeCharts.map((chart, idx) => renderChart(chart, idx))}
          </div>
        </>
      )}

      {/* Correlation Heatmap — always full width */}
      {viz.correlation && viz.correlation.columns.length >= 2 && (
        <Card className="p-5">
          <h3 className="font-semibold text-sm mb-0.5">Correlation Heatmap</h3>
          <p className="text-xs text-surface-400 mb-5">
            Pearson correlation between numeric columns — blue = positive, red = negative (−1 to 1)
          </p>
          <div className="overflow-x-auto">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `90px repeat(${viz.correlation.columns.length}, minmax(48px, 1fr))`,
                gap: 3,
              }}
            >
              {/* Header row */}
              <div />
              {viz.correlation.columns.map(c => (
                <div key={c} className="text-center text-[10px] text-surface-400 truncate px-1 pb-1 font-medium">
                  {c}
                </div>
              ))}

              {/* Data rows */}
              {viz.correlation.columns.map(row => (
                <React.Fragment key={row}>
                  <div className="text-[10px] text-surface-400 truncate text-right pr-2 self-center font-medium">
                    {row}
                  </div>
                  {viz.correlation!.columns.map(col => {
                    const cell = viz.correlation!.data.find(d => d.x === col && d.y === row);
                    const v    = cell?.value ?? 0;
                    const abs  = Math.abs(v);
                    const isDiagonal = row === col;
                    const bg = isDiagonal
                      ? 'rgba(99,102,241,0.35)'
                      : v >= 0
                        ? `rgba(14,165,233,${Math.min(abs, 0.9)})`
                        : `rgba(239,68,68,${Math.min(abs, 0.9)})`;
                    return (
                      <div
                        key={col}
                        className="aspect-square rounded-md flex items-center justify-center text-[10px] font-mono font-bold transition-transform hover:scale-105 cursor-default"
                        style={{
                          background: bg,
                          color: abs > 0.45 || isDiagonal ? '#fff' : 'var(--color-surface-700)',
                        }}
                        title={`${row} × ${col}: ${v.toFixed(3)}`}
                      >
                        {v.toFixed(2)}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};