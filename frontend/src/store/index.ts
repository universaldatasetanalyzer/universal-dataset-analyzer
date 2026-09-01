import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Dataset, Notification } from '../services/api';

interface AppState {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  selectedDataset: Dataset | null;
  setSelectedDataset: (dataset: Dataset | null) => void;
  datasets: Dataset[];
  setDatasets: (datasets: Dataset[]) => void;
  addDataset: (dataset: Dataset) => void;
  notifications: Notification[];
  setNotifications: (notifications: Notification[]) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  unreadCount: number;
  // Auth
  authUser: { id: string; name: string; email: string; role: string; plan?: string } | null;
  setAuthUser: (user: AppState['authUser']) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      toggleTheme: () => {
        const newTheme = get().theme === 'dark' ? 'light' : 'dark';
        set({ theme: newTheme });
        if (newTheme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      },
      sidebarCollapsed: false,
      toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      selectedDataset: null,
      setSelectedDataset: (dataset) => set({ selectedDataset: dataset }),
      datasets: [],
      setDatasets: (datasets) => set({ datasets }),
      addDataset: (dataset) => set(s => ({ datasets: [dataset, ...s.datasets] })),
      notifications: [],
      setNotifications: (notifications) => set({ notifications, unreadCount: notifications.filter(n => !n.read).length }),
      markNotificationRead: (id) =>
        set(s => ({
          notifications: s.notifications.map(n => n.id === id ? { ...n, read: true } : n),
          unreadCount: s.notifications.filter(n => !n.read && n.id !== id).length,
        })),
      markAllNotificationsRead: () =>
        set(s => ({ notifications: s.notifications.map(n => ({ ...n, read: true })), unreadCount: 0 })),
      unreadCount: 0,
      authUser: null,
      setAuthUser: (user) => set({ authUser: user }),
    }),
    { name: 'uda-store', partialize: (s) => ({ theme: s.theme, sidebarCollapsed: s.sidebarCollapsed, authUser: s.authUser }) }
  )
);