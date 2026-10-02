import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Database, BarChart3, Sparkles, ShieldCheck, Wand2, MessageSquare,
  Check, ChevronDown, ChevronUp, ArrowRight, Zap, Menu, X
} from 'lucide-react';
import { useStore } from '../store';

const fadeUp = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0 } };

const FEATURES = [
  { icon: <Database className="w-6 h-6" />, title: 'Smart Data Ingestion', desc: 'Upload CSV, Excel, or JSON files with automatic schema detection, type inference, and validation.', color: 'from-brand-500 to-brand-600' },
  { icon: <ShieldCheck className="w-6 h-6" />, title: 'Quality Analysis', desc: 'Detect missing values, outliers, duplicates, and format errors with a comprehensive health score.', color: 'from-emerald-500 to-emerald-600' },
  { icon: <Wand2 className="w-6 h-6" />, title: 'AI Cleaning Wizard', desc: 'Get intelligent recommendations and apply cleaning actions with a single click. Before/after preview.', color: 'from-accent-500 to-accent-600' },
  { icon: <BarChart3 className="w-6 h-6" />, title: 'Interactive Charts', desc: 'Histograms, scatter plots, heatmaps, box plots — all interactive with smart filters.', color: 'from-amber-500 to-amber-600' },
  { icon: <Sparkles className="w-6 h-6" />, title: 'AI-Powered Insights', desc: 'AI-assisted analysis that surfaces trends, anomalies, correlations, and executive summaries.', color: 'from-purple-500 to-purple-600' },
  { icon: <MessageSquare className="w-6 h-6" />, title: 'Chat with Your Data', desc: 'Ask questions in plain English and get instant answers, complete with charts and summaries.', color: 'from-rose-500 to-rose-600' },
];

const FAQS = [
  { q: 'What file formats are supported?', a: 'CSV, Excel (.xlsx and .xls), TSV, and JSON.' },
  { q: 'Is my data secure?', a: 'Datasets are private to your account or authorized workspace members. Review our privacy policy before uploading sensitive data.' },
  { q: 'Can I collaborate with my team?', a: 'Yes. The Pro plan includes team management with role-based permissions.' },
  { q: 'Is there an API available?', a: 'The beta currently provides the web application workflow; public API access is not included.' },
  { q: 'What\'s the maximum file size?', a: 'Uploads are subject to the current beta file, row, column, and storage limits.' },
];

const ARABIC_FEATURE_TEXT: Record<string, { title: string; desc: string }> = {
  'Smart Data Ingestion': { title: 'إدخال ذكي للبيانات', desc: 'ارفع ملفات CSV وExcel وJSON مع اكتشاف المخطط والتحقق من الأنواع تلقائيًا.' },
  'Quality Analysis': { title: 'تحليل الجودة', desc: 'اكتشف القيم المفقودة والقيم الشاذة والتكرارات وأخطاء التنسيق مع درجة صحة شاملة.' },
  'AI Cleaning Wizard': { title: 'مساعد التنظيف الذكي', desc: 'احصل على توصيات ذكية وطبّق إجراءات التنظيف بنقرة واحدة مع معاينة قبل وبعد.' },
  'Interactive Charts': { title: 'رسوم بيانية تفاعلية', desc: 'مخططات توزيع وتبعثر وخرائط حرارية ورسوم صندوقية مع فلاتر ذكية.' },
  'AI-Powered Insights': { title: 'رؤى بالذكاء الاصطناعي', desc: 'تحليل مدعوم بالذكاء الاصطناعي لاكتشاف الاتجاهات والحالات الشاذة والارتباطات.' },
  'Chat with Your Data': { title: 'تحدث مع بياناتك', desc: 'اطرح أسئلتك بلغة بسيطة واحصل على إجابات فورية مع الرسوم والملخصات.' },
};

export const LandingPage: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const { language, toggleLanguage } = useStore();
  const isArabic = language === 'ar';

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 text-surface-900 dark:text-surface-100 overflow-x-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 dark:bg-surface-900/80 backdrop-blur-xl border-b border-surface-200 dark:border-surface-800">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center shadow">
              <Database className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-bold text-sm">Universal<span className="text-brand-500">Analyzer</span></span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-surface-600 dark:text-surface-400">
            {(isArabic ? ['المزايا', 'الأسعار', 'الأسئلة الشائعة'] : ['Features', 'Pricing', 'FAQ']).map(item => (
              <a key={item} href={`#${item === 'المزايا' ? 'features' : item === 'الأسعار' ? 'pricing' : item === 'الأسئلة الشائعة' ? 'faq' : item.toLowerCase()}`} className="hover:text-surface-900 dark:hover:text-surface-100 transition-colors">{item}</a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={toggleLanguage} className="text-sm font-semibold text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100">
              {isArabic ? 'English' : 'العربية'}
            </button>
            <Link to="/login" className="hidden md:block text-sm font-medium text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100">{isArabic ? 'تسجيل الدخول' : 'Sign in'}</Link>
            <Link to="/register" className="btn-primary text-sm px-4 py-2">{isArabic ? 'ابدأ مجانًا' : 'Get Started Free'}</Link>
            <button className="md:hidden" onClick={() => setMobileMenu(!mobileMenu)}>
              {mobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {mobileMenu && (
          <div className="md:hidden px-6 pb-4 space-y-2 border-t border-surface-200 dark:border-surface-800 pt-4">
            {(isArabic ? ['المزايا', 'الأسعار', 'الأسئلة الشائعة'] : ['Features', 'Pricing', 'FAQ']).map(item => (
              <a key={item} href={`#${item === 'المزايا' ? 'features' : item === 'الأسعار' ? 'pricing' : item === 'الأسئلة الشائعة' ? 'faq' : item.toLowerCase()}`} onClick={() => setMobileMenu(false)} className="block text-sm py-2 text-surface-600 dark:text-surface-400">{item}</a>
            ))}
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-50" />
        <div className="absolute top-20 left-1/4 w-72 h-72 bg-brand-400/10 rounded-full blur-3xl" />
        <div className="absolute top-20 right-1/4 w-72 h-72 bg-accent-400/10 rounded-full blur-3xl" />
        <div className="max-w-4xl mx-auto text-center relative">
          <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.1 } } }}>
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-50 dark:bg-brand-950/50 border border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-400 text-sm font-medium mb-6">
              <Zap className="w-3.5 h-3.5" /> {isArabic ? 'الآن مع رؤى مدعومة بالذكاء الاصطناعي' : 'Now with AI-powered insights'}
            </motion.div>
            <motion.h1 variants={fadeUp} className="text-5xl md:text-7xl font-display font-bold leading-tight mb-6">
              {isArabic ? 'حلّل أي مجموعة بيانات' : 'Analyze Any Dataset'}
              <span className="block bg-gradient-to-r from-brand-500 to-accent-500 bg-clip-text text-transparent">
                {isArabic ? 'خلال دقائق' : 'in Minutes'}
              </span>
            </motion.h1>
            <motion.p variants={fadeUp} className="text-lg text-surface-500 dark:text-surface-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              {isArabic ? 'ارفع ملفات CSV أو Excel أو JSON واحصل فورًا على تقارير الجودة ورؤى الذكاء الاصطناعي ورسوم بيانية واضحة وواجهة محادثة للاستعلام عن بياناتك.' : 'Upload your CSV, Excel, or JSON files and instantly get quality reports, AI insights, beautiful visualizations, and a chat interface to query your data.'}
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/register" className="btn-primary text-base px-8 py-3.5 flex items-center gap-2">
                {isArabic ? 'ابدأ مجانًا' : 'Start for Free'} <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/register" className="btn-secondary text-base px-8 py-3.5">
                {isArabic ? 'جرّب باستخدام بياناتك' : 'Try with your data'}
              </Link>
            </motion.div>
          </motion.div>

          {/* Dashboard Preview */}
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.6 }}
            className="mt-16 rounded-2xl border border-surface-200 dark:border-surface-800 overflow-hidden shadow-2xl shadow-brand-500/10"
          >
            <div className="h-8 bg-surface-100 dark:bg-surface-800 flex items-center gap-1.5 px-4">
              {['bg-red-400', 'bg-amber-400', 'bg-emerald-400'].map((c, i) => <div key={i} className={`w-2.5 h-2.5 rounded-full ${c}`} />)}
              <div className="ml-4 h-4 w-48 bg-surface-200 dark:bg-surface-700 rounded" />
            </div>
            <div className="p-6 bg-white dark:bg-surface-900 text-left grid grid-cols-4 gap-4">
              {[['45,230', 'Total Rows', 'brand'], ['87%', 'Health Score', 'green'], ['18', 'Columns', 'purple'], ['$2.3M', 'Top Revenue', 'amber']].map(([v, l, c]) => (
                <div key={l} className="p-4 rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700">
                  <p className="text-xs text-surface-500">{l}</p>
                  <p className={`text-xl font-display font-bold mt-1 ${c === 'green' ? 'text-emerald-500' : c === 'purple' ? 'text-purple-500' : c === 'amber' ? 'text-amber-500' : 'text-brand-500'}`}>{v}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-brand-500 font-semibold text-sm mb-3 uppercase tracking-wider">{isArabic ? 'المزايا' : 'Features'}</p>
            <h2 className="text-4xl font-display font-bold mb-4">{isArabic ? 'كل ما تحتاجه لتحليل البيانات' : 'Everything you need to analyze data'}</h2>
            <p className="text-surface-500 max-w-xl mx-auto">{isArabic ? 'من الرفع إلى الرؤية خلال دقائق، دون الحاجة إلى SQL أو Python.' : 'From upload to insight in minutes. No SQL, no Python required.'}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <motion.div key={f.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}>
                <div className="card p-6 h-full hover:shadow-lg transition-shadow">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center text-white mb-4`}>
                    {f.icon}
                  </div>
                  <h3 className="font-display font-semibold text-base mb-2">{isArabic ? ARABIC_FEATURE_TEXT[f.title].title : f.title}</h3>
                  <p className="text-sm text-surface-500 leading-relaxed">{isArabic ? ARABIC_FEATURE_TEXT[f.title].desc : f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-6 bg-surface-100/50 dark:bg-surface-900/50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-brand-500 font-semibold text-sm mb-3 uppercase tracking-wider">{isArabic ? 'الأسعار' : 'Pricing'}</p>
            <h2 className="text-4xl font-display font-bold mb-4">{isArabic ? 'أسعار بسيطة وواضحة' : 'Simple, transparent pricing'}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {[
              { name: 'Free Demo', price: '$0', period: 'forever', features: ['Demo dataset', 'Quality reports', 'AI insights preview'], cta: 'Get Started Free', highlight: false },
              { name: 'Pro', price: '$10', period: '/month or $96/year', features: ['Dataset uploads within beta limits', 'Quality checks and cleaning', 'Visualizations and charts', 'AI insights and chat', 'HTML report generation'], cta: 'Subscribe', highlight: true },
            ].map((plan, i) => (
              <motion.div key={plan.name} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }}>
                <div className={`card p-6 relative ${plan.highlight ? 'border-2 border-brand-500 bg-gradient-to-b from-brand-50/60 dark:from-brand-950/30' : ''}`}>
                  {plan.highlight && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-600 text-white text-xs font-bold px-3 py-1 rounded-full">Most Popular</div>}
                  <h3 className="font-display font-bold text-lg">{plan.name}</h3>
                  <div className="my-3"><span className="text-4xl font-display font-bold">{plan.price}</span><span className="text-surface-500 text-sm">{plan.period}</span></div>
                  <div className="space-y-2 mb-6">
                    {plan.features.map(f => <div key={f} className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />{f}</div>)}
                  </div>
                  <Link to="/register" className={`block text-center py-2.5 rounded-xl text-sm font-medium transition-all ${plan.highlight ? 'bg-brand-600 hover:bg-brand-700 text-white' : 'border border-surface-300 dark:border-surface-700 hover:bg-surface-100 dark:hover:bg-surface-800'}`}>
                    {plan.cta}
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>



      {/* FAQ */}
      <section id="faq" className="py-24 px-6 bg-surface-100/50 dark:bg-surface-900/50">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-display font-bold mb-4">{isArabic ? 'الأسئلة الشائعة' : 'Frequently asked questions'}</h2>
          </div>
          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <div key={i} className="card overflow-hidden">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-left font-medium text-sm hover:bg-surface-50 dark:hover:bg-surface-800/30 transition-colors"
                >
                  {faq.q}
                  {openFaq === i ? <ChevronUp className="w-4 h-4 text-surface-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-surface-400 flex-shrink-0" />}
                </button>
                {openFaq === i && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} className="px-5 pb-5">
                    <p className="text-sm text-surface-500 leading-relaxed">{faq.a}</p>
                  </motion.div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="card p-12 bg-gradient-to-br from-brand-600 to-accent-600 border-0 text-white">
            <h2 className="text-4xl font-display font-bold mb-4">{isArabic ? 'ابدأ تحليل بياناتك اليوم' : 'Start analyzing your data today'}</h2>
            <p className="text-white/80 mb-8">{isArabic ? 'ابدأ بتحليل بياناتك واكتشف رؤى واضحة خلال دقائق.' : 'Start with your own data and turn it into clear, useful insights.'}</p>
            <Link to="/register" className="inline-flex items-center gap-2 bg-white text-brand-700 font-semibold px-8 py-3.5 rounded-xl hover:bg-brand-50 transition-colors">
              {isArabic ? 'ابدأ مجانًا' : 'Get Started Free'} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-surface-200 dark:border-surface-800 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col items-center gap-4 text-center">
              <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center">
              <Database className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-display font-bold text-sm">UniversalAnalyzer</span>
          </div>
          <div className="flex gap-4 text-xs text-surface-400">
            <Link to="/privacy" className="hover:text-surface-600">Privacy</Link>
            <Link to="/terms" className="hover:text-surface-600">Terms</Link>
            <Link to="/support" className="hover:text-surface-600">Support</Link>
          </div>
          <p className="text-xs text-surface-400">© 2026 Universal Analyzer. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};