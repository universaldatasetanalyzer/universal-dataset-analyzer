import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, TrendingUp, TrendingDown, Minus, AlertCircle, RefreshCw, Database, RotateCcw, Zap, Target, Clock, DollarSign, CheckCircle2 } from 'lucide-react';
import { Card, Badge } from '../components/ui';
import { insightsApi, type InsightsData } from '../services/api';
import { useStore } from '../store';

const dirIcon = (d: string) => d === 'up' ? <TrendingUp className="w-4 h-4 text-emerald-500" />
  : d === 'down' ? <TrendingDown className="w-4 h-4 text-red-500" />
  : <Minus className="w-4 h-4 text-surface-400" />;

const impactColor = (i: string) => i === 'high' ? 'red' : i === 'medium' ? 'yellow' : 'blue';

export const InsightsPage: React.FC = () => {
  const { selectedDataset, language } = useStore();
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (selectedDataset) load(); }, [selectedDataset?.id, language]);

  async function load() {
    if (!selectedDataset) return;
    setLoading(true); setError('');
    try {
      const data = await insightsApi.get(selectedDataset.id, language);
      setInsights(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load insights');
    } finally {
      setLoading(false);
    }
  }

  async function regenerate() {
    if (!selectedDataset) return;
    setRegenerating(true);
    try {
      const data = await insightsApi.regenerate(selectedDataset.id, language);
      setInsights(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Regeneration failed');
    } finally {
      setRegenerating(false);
    }
  }

  if (!selectedDataset) return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <Database className="w-12 h-12 text-surface-300 mb-3" />
      <h2 className="font-semibold mb-1">{language === 'ar' ? 'لم يتم اختيار مجموعة بيانات' : 'No dataset selected'}</h2>
      <p className="text-sm text-surface-500">{language === 'ar' ? 'اختر مجموعة بيانات لإنشاء رؤى بالذكاء الاصطناعي.' : 'Select a dataset to generate AI insights.'}</p>
    </div>
  );

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <Sparkles className="w-10 h-10 text-brand-500 animate-pulse mb-3" />
      <h2 className="font-semibold">{language === 'ar' ? 'جارٍ إنشاء الرؤى...' : 'Generating AI insights...'}</h2>
      <p className="text-sm text-surface-500 mt-1">{language === 'ar' ? 'نحلل الأنماط والاتجاهات والقيم الشاذة' : 'Analyzing patterns, trends, and anomalies'}</p>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
      <p className="text-red-500">{error}</p>
      <button onClick={load} className="btn-primary mt-3 text-sm px-4 py-2">{language === 'ar' ? 'إعادة المحاولة' : 'Retry'}</button>
    </div>
  );

  if (!insights) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-brand-500" /> {language === 'ar' ? 'رؤى الذكاء الاصطناعي' : 'AI Insights'}
          </h1>
          <p className="text-surface-500 text-sm mt-1">{selectedDataset.name}</p>
        </div>
        <button onClick={regenerate} disabled={regenerating}
          className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl border border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors disabled:opacity-50">
          {regenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
          {language === 'ar' ? 'إعادة الإنشاء' : 'Regenerate'}
        </button>
      </div>

      {/* Decision Brief */}
      {(insights.decisionBrief?.length ?? 0) > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-5 h-5 text-brand-500" />
            <div>
              <h2 className="font-display font-semibold text-base">{language === 'ar' ? 'القرارات المقترحة' : 'Recommended Decisions'}</h2>
              <p className="text-xs text-surface-500">{language === 'ar' ? 'إجراءات اكتُشفت من مجموعة البيانات مرتبة حسب التأثير المتوقع' : 'Actions discovered from this dataset, ranked by likely impact'}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {insights.decisionBrief?.map((d, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                <Card className="p-5 h-full border-l-4 border-brand-500">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="font-semibold text-sm">{d.title}</h3>
                    <Badge variant={impactColor(d.impact) as 'red' | 'yellow' | 'blue'}>{language === 'ar' ? `${d.impact === 'high' ? 'تأثير مرتفع' : d.impact === 'medium' ? 'تأثير متوسط' : 'تأثير منخفض'}` : `${d.impact} impact`}</Badge>
                  </div>
                  <p className="text-sm font-medium text-surface-700 dark:text-surface-200 mb-3">{d.decision}</p>
                  <div className="space-y-2 text-xs text-surface-500">
                    <p><span className="font-semibold text-surface-700 dark:text-surface-300">{language === 'ar' ? 'الإجراء:' : 'Action:'}</span> {d.action}</p>
                    <p className="flex gap-1.5"><Clock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />{d.when}</p>
                    <p className="flex gap-1.5"><DollarSign className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />{d.value}</p>
                    <p><span className="font-semibold text-surface-700 dark:text-surface-300">{language === 'ar' ? 'الدليل:' : 'Evidence:'}</span> {d.evidence}</p>
                    <p className="flex gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-emerald-500" />{language === 'ar' ? 'التحقق:' : 'Validate:'} {d.validation}</p>
                  </div>
                  <div className="mt-3 text-[11px] text-brand-600 dark:text-brand-400">{language === 'ar' ? 'درجة الثقة:' : 'Confidence:'} {Math.round(Math.max(0, Math.min(1, d.confidence)) * 100)}%</div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Executive Summary */}
      {insights.executiveSummary && (
        <Card className="p-6 border-l-4 border-brand-500 bg-gradient-to-r from-brand-50/50 dark:from-brand-950/20 to-transparent">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-brand-500" />
            <h2 className="font-display font-semibold">{language === 'ar' ? 'الملخص التنفيذي' : 'Executive Summary'}</h2>
          </div>
          <p className="text-sm text-surface-600 dark:text-surface-300 leading-relaxed">{insights.executiveSummary}</p>
        </Card>
      )}

      {/* Key Findings */}
      {insights.keyFindings?.length > 0 && (
        <div>
          <h2 className="font-display font-semibold text-base mb-3">{language === 'ar' ? 'أهم النتائج' : 'Key Findings'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insights.keyFindings.map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-sm">{f.title}</h3>
                    <Badge variant={impactColor(f.impact) as 'red' | 'yellow' | 'blue'}>{language === 'ar' ? `${f.impact === 'high' ? 'تأثير مرتفع' : f.impact === 'medium' ? 'تأثير متوسط' : 'تأثير منخفض'}` : `${f.impact} impact`}</Badge>
                  </div>
                  <p className="text-sm text-surface-500 mb-3">{f.description}</p>
                  {f.metric && <div className="text-xs font-mono px-2 py-1 rounded-lg bg-surface-100 dark:bg-surface-800 inline-block">{f.metric}</div>}
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trends */}
        {insights.trends?.length > 0 && (
          <div>
            <h2 className="font-display font-semibold text-base mb-3">{language === 'ar' ? 'الاتجاهات' : 'Trends'}</h2>
            <Card className="divide-y divide-surface-100 dark:divide-surface-800">
              {insights.trends.map((t, i) => (
                <div key={i} className="flex items-start gap-3 p-4">
                  {dirIcon(t.direction)}
                  <div>
                    <p className="text-sm font-medium">{t.title}</p>
                    <p className="text-xs text-surface-500 mt-0.5">{t.description}</p>
                  </div>
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* Anomalies */}
        {insights.anomalies?.length > 0 && (
          <div>
            <h2 className="font-display font-semibold text-base mb-3">{language === 'ar' ? 'القيم الشاذة' : 'Anomalies'}</h2>
            <Card className="divide-y divide-surface-100 dark:divide-surface-800">
              {insights.anomalies.map((a, i) => (
                <div key={i} className="flex items-start gap-3 p-4">
                  <AlertCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${a.severity === 'error' ? 'text-red-500' : a.severity === 'warning' ? 'text-amber-500' : 'text-blue-500'}`} />
                  <div>
                    <p className="text-sm font-medium">{a.title}</p>
                    <p className="text-xs text-surface-500 mt-0.5">{a.description}</p>
                  </div>
                </div>
              ))}
            </Card>
          </div>
        )}
      </div>

      {/* Correlations */}
      {insights.correlations?.length > 0 && (
        <div>
          <h2 className="font-display font-semibold text-base mb-3">{language === 'ar' ? 'الارتباطات' : 'Correlations'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insights.correlations.map((c, i) => (
              <Card key={i} className="p-4 flex items-center gap-4">
                <div className="text-center">
                  <div className={`text-2xl font-bold font-display ${c.strength > 0.7 ? 'text-emerald-500' : c.strength > 0.4 ? 'text-amber-500' : 'text-surface-400'}`}>
                    {c.strength.toFixed(2)}
                  </div>
                  <p className="text-xs text-surface-400">{language === 'ar' ? 'قيمة الارتباط' : 'r-value'}</p>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{c.col1} ↔ {c.col2}</p>
                  <p className="text-xs text-surface-500 mt-0.5">{c.description}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {(insights.recommendations?.length ?? 0) > 0 && (
        <Card className="p-5">
          <h2 className="font-display font-semibold text-base mb-3">{language === 'ar' ? 'التوصيات' : 'Recommendations'}</h2>
          <ul className="space-y-2">
            {(insights.recommendations ?? []).map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="w-5 h-5 rounded-full bg-brand-100 dark:bg-brand-950/30 text-brand-600 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">{i+1}</span>
                <span className="text-surface-600 dark:text-surface-300">{r}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
};
