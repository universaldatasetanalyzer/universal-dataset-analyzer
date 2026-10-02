import React, { useEffect, useState } from 'react';
import { Users, Database, Crown, TrendingUp, Trash2, RefreshCw, ShieldCheck, Search, CheckCircle, XCircle, Lock } from 'lucide-react';
import { Card, Badge } from '../components/ui';
import { formatDate } from '../services/api';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

function getToken() { return localStorage.getItem('uda_token'); }

function getAdminAuth() { return sessionStorage.getItem('admin_auth') || ''; }
function setAdminAuth(user: string, pass: string) {
  sessionStorage.setItem('admin_auth', btoa(`${user}:${pass}`));
}

async function adminFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const adminAuth = getAdminAuth();

  console.log(`%c[Admin Debug] Request to ${path}`, 'color: #3b82f6; font-weight: bold;', {
    hasJwtToken: !!token,
    hasAdminAuthHeader: !!adminAuth,
  });

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'x-admin-auth': adminAuth,
      ...(options.headers || {}),
    },
  });

  const data = await res.json().catch(() => ({}));

  console.log(`%c[Admin Debug] Response (${res.status}) from ${path}:`, res.ok ? 'color: #10b981;' : 'color: #ef4444;', data);

  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data;
}

interface User {
  id: string; name: string; email: string; role: string;
  is_admin: boolean; created_at: string; plan: string;
  sub_status: string; dataset_count: number;
}

interface Stats {
  totalUsers: number; totalDatasets: number; proUsers: number; newUsersWeek: number;
}

// ── Login Gate ────────────────────────────────────────────────────────────────
const AdminLogin: React.FC<{ onLogin: (u: string, p: string) => void; error: string }> = ({ onLogin, error }) => {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50 dark:bg-surface-950 p-4">
      <div className="w-full max-w-sm bg-white dark:bg-surface-900 rounded-2xl shadow-xl border border-surface-200 dark:border-surface-800 p-8">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center">
            <Lock className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-display font-bold">Admin Access</p>
            <p className="text-xs text-surface-400">Restricted area</p>
          </div>
        </div>
        {error && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 text-xs mb-4 leading-relaxed whitespace-pre-wrap">
            {error}
          </div>
        )}
        <div className="space-y-3">
          <input value={user} onChange={e => setUser(e.target.value)}
            placeholder="Admin username" className="input w-full text-sm py-2.5" />
          <input type="password" value={pass} onChange={e => setPass(e.target.value)}
            placeholder="Admin password" className="input w-full text-sm py-2.5"
            onKeyDown={e => e.key === 'Enter' && onLogin(user, pass)} />
          <button onClick={() => onLogin(user, pass)} className="btn-primary w-full py-2.5 justify-center">
            Enter Admin Panel
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Admin Panel ───────────────────────────────────────────────────────────────
export const AdminPage: React.FC = () => {
  const [authed, setAuthed]         = useState(!!getAdminAuth());
  const [loginError, setLoginError] = useState('');
  const [users, setUsers]           = useState<User[]>([]);
  const [stats, setStats]           = useState<Stats | null>(null);
  const [loading, setLoading]       = useState(false);
  const [search, setSearch]         = useState('');
  const [toast, setToast]           = useState('');
  const [updating, setUpdating]     = useState<string | null>(null);

  async function handleLogin(user: string, pass: string) {
    console.log('[Admin Page] Attempting login with user:', user);
    setAdminAuth(user, pass);
    try {
      await adminFetch('/admin/stats');
      console.log('[Admin Page] Login successful!');
      setAuthed(true);
      setLoginError('');
    } catch (err: unknown) {
      console.error('[Admin Page] Login error:', err);
      sessionStorage.removeItem('admin_auth');
      setLoginError(err instanceof Error ? err.message : 'Invalid username or password');
    }
  }

  async function load() {
    setLoading(true);
    try {
      const [usersRes, statsRes] = await Promise.all([
        adminFetch('/admin/users'),
        adminFetch('/admin/stats'),
      ]);
      setUsers(usersRes.users);
      setStats(statsRes);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to load');
    } finally { setLoading(false); }
  }

  useEffect(() => {
    if (authed) queueMicrotask(() => { void load(); });
  }, [authed]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function setPlan(userId: string, plan: string) {
    setUpdating(userId + plan);
    try {
      const res = await adminFetch(`/admin/users/${userId}/plan`, {
        method: 'PATCH', body: JSON.stringify({ plan }),
      });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, plan } : u));
      if (stats) setStats({ ...stats, proUsers: plan === 'pro' ? stats.proUsers + 1 : Math.max(0, stats.proUsers - 1) });
      showToast(res.message);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to update plan');
    } finally { setUpdating(null); }
  }

  async function deleteUser(userId: string, name: string) {
    if (!confirm(`Delete ${name}? This is permanent.`)) return;
    try {
      await adminFetch(`/admin/users/${userId}`, { method: 'DELETE' });
      setUsers(prev => prev.filter(u => u.id !== userId));
      showToast(`${name} deleted`);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to delete');
    }
  }

  async function toggleAdmin(userId: string) {
    try {
      const res = await adminFetch(`/admin/users/${userId}/toggle-admin`, { method: 'PATCH' });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_admin: !u.is_admin } : u));
      showToast(res.message);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed');
    }
  }

  if (!authed) return <AdminLogin onLogin={handleLogin} error={loginError} />;

  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-surface-900 text-white text-sm px-4 py-3 rounded-xl shadow-xl animate-fade-in">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-brand-500" /> Admin Panel
          </h1>
          <p className="text-surface-500 text-sm mt-1">Manage users and subscriptions</p>
        </div>
        <button
          onClick={() => { sessionStorage.removeItem('admin_auth'); setAuthed(false); }}
          className="text-xs text-red-500 hover:text-red-600 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800 transition-colors"
        >
          Lock Panel
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Users',    value: stats.totalUsers,    icon: Users,      color: 'text-brand-500' },
            { label: 'Total Datasets', value: stats.totalDatasets, icon: Database,   color: 'text-emerald-500' },
            { label: 'Pro Users',      value: stats.proUsers,      icon: Crown,      color: 'text-amber-500' },
            { label: 'New This Week',  value: stats.newUsersWeek,  icon: TrendingUp, color: 'text-purple-500' },
          ].map(s => (
            <Card key={s.label} className="p-5">
              <div className="flex items-center gap-3">
                <s.icon className={`w-5 h-5 ${s.color}`} />
                <div>
                  <p className="text-2xl font-display font-bold">{s.value}</p>
                  <p className="text-xs text-surface-500">{s.label}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="flex items-center gap-4 p-5 border-b border-surface-100 dark:border-surface-800">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or email…" className="input w-full pl-9 text-sm py-2" />
          </div>
          <button onClick={load} className="p-2 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-surface-100 dark:bg-surface-800 rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-100 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-800/30">
                  {['User', 'Plan', 'Datasets', 'Admin', 'Joined', 'Actions'].map(h => (
                    <th key={h} className="text-left py-3 px-4 font-medium text-surface-500 text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id} className="border-b border-surface-100 dark:border-surface-800/50 hover:bg-surface-50 dark:hover:bg-surface-800/20">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {(u.name || u.email || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-xs">{u.name}</p>
                          <p className="text-[11px] text-surface-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Badge variant={u.plan === 'pro' ? 'purple' : 'gray'}>
                          {u.plan === 'pro' ? '⭐ Pro' : 'Free'}
                        </Badge>
                        {u.plan !== 'pro' ? (
                          <button onClick={() => setPlan(u.id, 'pro')} disabled={updating === u.id + 'pro'}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/30 text-purple-600 hover:bg-purple-200 transition-colors disabled:opacity-50">
                            {updating === u.id + 'pro' ? '...' : '→ Pro'}
                          </button>
                        ) : (
                          <button onClick={() => setPlan(u.id, 'free')} disabled={updating === u.id + 'free'}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-surface-100 dark:bg-surface-800 text-surface-500 hover:bg-surface-200 transition-colors disabled:opacity-50">
                            {updating === u.id + 'free' ? '...' : '→ Free'}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-surface-500">{u.dataset_count || 0}</td>
                    <td className="py-3 px-4">
                      <button onClick={() => toggleAdmin(u.id)} className="transition-colors">
                        {u.is_admin
                          ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                          : <XCircle    className="w-4 h-4 text-surface-300 hover:text-surface-500" />}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-xs text-surface-400">{formatDate(u.created_at)}</td>
                    <td className="py-3 px-4">
                      <button onClick={() => deleteUser(u.id, u.name)}
                        className="text-surface-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-10 text-surface-400 text-sm">No users found</div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};