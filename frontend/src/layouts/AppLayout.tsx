import React, { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { TopNav } from '../components/layout/TopNav';
import { useStore } from '../store';
import { authApi, notificationsApi } from '../services/api';

export const AppLayout: React.FC = () => {
  const { sidebarCollapsed, setAuthUser, setNotifications } = useStore();
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('uda_token');
    if (!token) {
      navigate('/login');
      return;
    }
    authApi.me()
      .then(res => setAuthUser(res.user))
      .catch(() => navigate('/login'));
    const loadNotifications = () => notificationsApi.list().then(res => setNotifications(res.notifications)).catch(() => {});
    loadNotifications();
    const interval = window.setInterval(loadNotifications, 15000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950">
      <Sidebar />
      <TopNav />
      <main
        className="pt-16 min-h-screen transition-all duration-[250ms]"
        style={{ marginLeft: sidebarCollapsed ? 68 : 240 }}
      >
        <div className="p-6 max-w-screen-2xl mx-auto animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
};