import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Upload, FileText, ShieldCheck, Wand2, BarChart3,
  Sparkles, MessageSquare, FileOutput, CreditCard, Users, Settings,
  Database, ChevronLeft,
} from 'lucide-react';
import { useStore } from '../../store';

const NAV_ITEMS = [
  { group: 'Main', items: [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/upload', icon: Upload, label: 'Upload Dataset' },
  ]},
  { group: 'Analysis', items: [
    { to: '/summary', icon: FileText, label: 'Dataset Summary' },
    { to: '/quality', icon: ShieldCheck, label: 'Data Quality' },
    { to: '/cleaning', icon: Wand2, label: 'Cleaning Wizard' },
    { to: '/visualize', icon: BarChart3, label: 'Visualizations' },
    { to: '/insights', icon: Sparkles, label: 'AI Insights' },
    { to: '/chat', icon: MessageSquare, label: 'Chat with Data' },
  ]},
  { group: 'Workspace', items: [
    { to: '/reports', icon: FileOutput, label: 'Reports' },
    { to: '/billing', icon: CreditCard, label: 'Billing' },
    { to: '/team', icon: Users, label: 'Team' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ]},
];

const ARABIC_NAV_ITEMS = [
  { group: 'الرئيسية', items: [{ to: '/dashboard', label: 'لوحة التحكم' }, { to: '/upload', label: 'رفع البيانات' }] },
  { group: 'التحليل', items: [{ to: '/summary', label: 'ملخص البيانات' }, { to: '/quality', label: 'جودة البيانات' }, { to: '/cleaning', label: 'تنظيف البيانات' }, { to: '/visualize', label: 'الرسوم البيانية' }, { to: '/insights', label: 'رؤى الذكاء الاصطناعي' }, { to: '/chat', label: 'محادثة مع البيانات' }] },
  { group: 'مساحة العمل', items: [{ to: '/reports', label: 'التقارير' }, { to: '/billing', label: 'الفوترة' }, { to: '/team', label: 'الفريق' }, { to: '/settings', label: 'الإعدادات' }] },
];

export const Sidebar: React.FC = () => {
  const { sidebarCollapsed, toggleSidebar, language } = useStore();
  const location = useLocation();
  const navItems = language === 'ar'
    ? NAV_ITEMS.map((group, groupIndex) => ({ ...group, group: ARABIC_NAV_ITEMS[groupIndex].group, items: group.items.map((item, itemIndex) => ({ ...item, label: ARABIC_NAV_ITEMS[groupIndex].items[itemIndex].label })) }))
    : NAV_ITEMS;

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarCollapsed ? 68 : 240 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="fixed left-0 top-0 h-full z-30 bg-white dark:bg-surface-900 border-r border-surface-200 dark:border-surface-800 flex flex-col overflow-hidden"
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-surface-200 dark:border-surface-800 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center flex-shrink-0 shadow-lg">
            <Database className="w-4 h-4 text-white" />
          </div>
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.2 }}>
                <span className="font-display font-bold text-sm text-surface-900 dark:text-surface-100 whitespace-nowrap">Universal</span>
                <span className="font-display font-bold text-sm text-brand-500 whitespace-nowrap ml-1">Analyzer</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {navItems.map(group => (
          <div key={group.group}>
            <AnimatePresence>
              {!sidebarCollapsed && (
                <motion.p
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="text-xs font-semibold text-surface-400 dark:text-surface-600 uppercase tracking-wider mb-2 px-3"
                >
                  {group.group}
                </motion.p>
              )}
            </AnimatePresence>
            <div className="space-y-0.5">
              {group.items.map(item => {
                const active = location.pathname === item.to;
                return (
                  <NavLink key={item.to} to={item.to} className={`sidebar-link ${active ? 'active' : ''}`}>
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    <AnimatePresence>
                      {!sidebarCollapsed && (
                        <motion.span
                          initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                          className="truncate"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse Toggle */}
      <button
        onClick={toggleSidebar}
        className="flex items-center justify-center h-10 border-t border-surface-200 dark:border-surface-800 text-surface-400 hover:text-surface-700 dark:hover:text-surface-300 transition-colors flex-shrink-0"
      >
        <motion.div animate={{ rotate: sidebarCollapsed ? 180 : 0 }} transition={{ duration: 0.25 }}>
          <ChevronLeft className="w-4 h-4" />
        </motion.div>
      </button>
    </motion.aside>
  );
};