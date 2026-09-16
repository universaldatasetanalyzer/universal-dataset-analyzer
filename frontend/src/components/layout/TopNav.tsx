import React, { useState, useRef, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Bell, Sun, Moon, ChevronRight, User, LogOut, CreditCard, Settings, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../store';
import { formatDate } from '../../services/mockData';
import { notificationsApi } from '../../services/api';

const BREADCRUMB_MAP: Record<string, string> = {
  dashboard: 'Dashboard', upload: 'Upload Dataset', summary: 'Dataset Summary',
  quality: 'Data Quality', cleaning: 'Cleaning Wizard', visualize: 'Visualizations',
  insights: 'AI Insights', chat: 'Chat with Data', reports: 'Reports',
  billing: 'Billing', team: 'Team', settings: 'Settings',
};

const ARABIC_BREADCRUMBS: Record<string, string> = {
  dashboard: 'لوحة التحكم', upload: 'رفع البيانات', summary: 'ملخص البيانات',
  quality: 'جودة البيانات', cleaning: 'تنظيف البيانات', visualize: 'الرسوم البيانية',
  insights: 'رؤى الذكاء الاصطناعي', chat: 'محادثة مع البيانات', reports: 'التقارير',
  billing: 'الفوترة', team: 'الفريق', settings: 'الإعدادات',
};

export const TopNav: React.FC = () => {
  const { theme, toggleTheme, language, toggleLanguage, notifications, markNotificationRead, markAllNotificationsRead, unreadCount, sidebarCollapsed, authUser } = useStore();
  const [showNotifs, setShowNotifs] = useState(false);
  const [showUser, setShowUser] = useState(false);
  const location = useLocation();
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  const segments = location.pathname.split('/').filter(Boolean);

  // ── User display helpers ──
  const displayName = authUser?.name || 'User';
  const initials    = displayName.slice(0, 1).toUpperCase();
  const planRaw     = (authUser as { plan?: string } | null)?.plan || 'free';
  const planLabel   = planRaw.charAt(0).toUpperCase() + planRaw.slice(1) + ' Plan';

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifs(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setShowUser(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header
      className="fixed top-0 right-0 h-16 z-20 bg-white/80 dark:bg-surface-900/80 backdrop-blur-xl border-b border-surface-200 dark:border-surface-800 flex items-center px-6 gap-4"
      style={{ left: sidebarCollapsed ? 68 : 240, transition: 'left 0.25s ease' }}
    >
      {/* Breadcrumbs */}
      <div className="flex items-center gap-1.5 text-sm flex-1 min-w-0">
        <Link to="/dashboard" className="text-surface-400 hover:text-surface-700 dark:hover:text-surface-300 transition-colors">{language === 'ar' ? 'الرئيسية' : 'Home'}</Link>
        {segments.map((seg, i) => (
          <React.Fragment key={seg}>
            <ChevronRight className="w-3.5 h-3.5 text-surface-400" />
            <span className={i === segments.length - 1 ? 'font-medium text-surface-900 dark:text-surface-100 truncate' : 'text-surface-400 hover:text-surface-700 dark:hover:text-surface-300'}>
              {(language === 'ar' ? ARABIC_BREADCRUMBS : BREADCRUMB_MAP)[seg] || seg}
            </span>
          </React.Fragment>
        ))}
      </div>

      {/* Theme */}
      <button
        onClick={toggleLanguage}
        className="h-9 px-3 rounded-xl text-xs font-semibold text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
        aria-label={language === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
      >
        {language === 'ar' ? 'English' : 'العربية'}
      </button>
      <button
        onClick={toggleTheme}
        className="w-9 h-9 rounded-xl flex items-center justify-center text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
      >
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      {/* Notifications */}
      <div ref={notifRef} className="relative">
        <button
          onClick={() => { setShowNotifs(!showNotifs); setShowUser(false); }}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors relative"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-brand-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>
        <AnimatePresence>
          {showNotifs && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.96 }}
              className="absolute right-0 top-12 w-80 card shadow-xl z-50 overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-surface-200 dark:border-surface-800">
                <h3 className="font-semibold text-sm">{language === 'ar' ? 'الإشعارات' : 'Notifications'}</h3>
                <button onClick={() => { markAllNotificationsRead(); void notificationsApi.markAllRead(); }} className="text-xs text-brand-500 hover:text-brand-600 flex items-center gap-1">
                  <Check className="w-3 h-3" /> {language === 'ar' ? 'تحديد الكل كمقروء' : 'Mark all read'}
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 && <p className="p-6 text-center text-sm text-surface-500">{language === 'ar' ? 'لا توجد إشعارات.' : 'No notifications yet.'}</p>}
                {notifications.map(n => (
                  <div
                    key={n.id}
                    onClick={() => { markNotificationRead(n.id); void notificationsApi.markRead(n.id); }}
                    className={`p-4 border-b border-surface-100 dark:border-surface-800 cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors ${!n.read ? 'bg-brand-50/30 dark:bg-brand-950/20' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${!n.read ? 'bg-brand-500' : 'bg-transparent'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-surface-800 dark:text-surface-200">{n.title}</p>
                        <p className="text-xs text-surface-500 mt-0.5">{n.message}</p>
                        <p className="text-xs text-surface-400 mt-1">{formatDate(n.createdAt)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* User Menu */}
      <div ref={userRef} className="relative">
        <button
          onClick={() => { setShowUser(!showUser); setShowNotifs(false); }}
          className="flex items-center gap-2 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-xl p-1.5 transition-colors"
        >
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center text-white text-xs font-bold">
            {initials}
          </div>
          <div className="hidden md:block text-left">
            <p className="text-xs font-semibold leading-tight">{displayName}</p>
            <p className="text-xs text-surface-500 leading-tight">{planLabel}</p>
          </div>
        </button>
        <AnimatePresence>
          {showUser && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.96 }}
              className="absolute right-0 top-12 w-52 card shadow-xl z-50 p-1.5"
            >
              <div className="px-3 py-2 mb-1">
                <p className="text-sm font-semibold">{displayName}</p>
                <p className="text-xs text-surface-500">{authUser?.email}</p>
              </div>
              {[
                { icon: User, label: language === 'ar' ? 'الملف الشخصي' : 'Profile', to: '/settings' },
                { icon: CreditCard, label: language === 'ar' ? 'الفوترة' : 'Billing', to: '/billing' },
                { icon: Settings, label: language === 'ar' ? 'الإعدادات' : 'Settings', to: '/settings' },
              ].map(item => (
                <Link key={item.label} to={item.to} onClick={() => setShowUser(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                >
                  <item.icon className="w-4 h-4" />{item.label}
                </Link>
              ))}
              <div className="border-t border-surface-200 dark:border-surface-800 mt-1 pt-1">
                <Link to="/login" className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                  <LogOut className="w-4 h-4" />{language === 'ar' ? 'تسجيل الخروج' : 'Log out'}
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
};