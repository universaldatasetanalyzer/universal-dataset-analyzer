import React, { useState, useEffect } from 'react';
import { User, Lock, Trash2, RefreshCw, Check, AlertCircle, CreditCard, ExternalLink } from 'lucide-react';
import { Card, Tabs } from '../components/ui';
import { settingsApi } from '../services/api';
import { useStore } from '../store';
import { authApi } from '../services/api';

export const SettingsPage: React.FC = () => {
  const [tab, setTab] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const { setAuthUser } = useStore();

  const [profileForm, setProfileForm] = useState({ name: '', email: '' });
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [deleteConfirm, setDeleteConfirm] = useState('');

  useEffect(() => {
    settingsApi.get().then(res => {
      setProfileForm({ name: res.user.name || '', email: res.user.email || '' });
      setLoading(false);
    });
  }, []);

  const notify = (msg: string, isError = false) => {
    if (isError) { setError(msg); setSuccess(''); }
    else { setSuccess(msg); setError(''); }
    setTimeout(() => { setSuccess(''); setError(''); }, 4000);
  };

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await settingsApi.updateProfile({ name: profileForm.name }) as unknown as { user: { id: string; name: string; email: string; role: string } };
      setAuthUser(res.user);
      authApi.setUser(res.user);
      notify('Profile updated successfully');
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Update failed', true);
    } finally { setSaving(false); }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwForm.newPw !== pwForm.confirm) { notify('Passwords do not match', true); return; }
    setSaving(true);
    try {
      await settingsApi.changePassword(pwForm.current, pwForm.newPw);
      setPwForm({ current: '', newPw: '', confirm: '' });
      notify('Password changed successfully');
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Failed', true);
    } finally { setSaving(false); }
  }

  async function deleteAccount(e: React.FormEvent) {
    e.preventDefault();
    try {
      await settingsApi.deleteAccount(deleteConfirm);
      authApi.logout();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Failed', true);
    }
  }

  async function openCustomerPortal() {
    setPortalLoading(true);
    try {
      const { url } = await settingsApi.openPortal();
      window.location.assign(url);
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Unable to open the customer portal.', true);
      setPortalLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-display font-bold">Settings</h1>

      {success && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 text-sm">
          <Check className="w-4 h-4" /> {success}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/20 text-red-600 text-sm">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      <Tabs tabs={[
        { id: 'profile', label: 'Profile' },
        { id: 'security', label: 'Security' },
        { id: 'danger', label: 'Danger Zone' },
      ]} active={tab} onChange={setTab} />

      {tab === 'profile' && (
        <Card className="p-6">
          <h2 className="font-semibold text-sm mb-4 flex items-center gap-2"><User className="w-4 h-4" /> Profile Information</h2>
          {loading ? (
            <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-10 bg-surface-100 dark:bg-surface-800 rounded-xl animate-pulse" />)}</div>
          ) : (
            <form onSubmit={saveProfile} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Full Name</label>
                <input value={profileForm.name} onChange={e => setProfileForm(p => ({ ...p, name: e.target.value }))}
                  className="input w-full" placeholder="Your name" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Email Address</label>
                <input type="email" value={profileForm.email} readOnly
                  className="input w-full cursor-not-allowed opacity-70" aria-describedby="email-help" />
                <p id="email-help" className="text-xs text-surface-500 mt-1.5">Email address cannot be changed.</p>
              </div>
              <button type="submit" disabled={saving} className="btn-primary text-sm px-5 py-2 disabled:opacity-50 flex items-center gap-2">
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Save Changes
              </button>
              <div className="border-t border-surface-200 dark:border-surface-800 pt-5 mt-5">
                <h3 className="font-semibold text-sm flex items-center gap-2"><CreditCard className="w-4 h-4" /> Manage billing</h3>
                <p className="text-sm text-surface-500 mt-1 mb-3">Update your payment method, cancel your subscription, or view invoices in Paddle.</p>
                <button type="button" onClick={() => void openCustomerPortal()} disabled={portalLoading} className="text-sm px-4 py-2 rounded-xl border border-surface-300 dark:border-surface-700 hover:bg-surface-100 dark:hover:bg-surface-800 disabled:opacity-50 flex items-center gap-2">
                  {portalLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                  Open customer portal
                </button>
              </div>
            </form>
          )}
        </Card>
      )}

      {tab === 'security' && (
        <Card className="p-6">
          <h2 className="font-semibold text-sm mb-4 flex items-center gap-2"><Lock className="w-4 h-4" /> Change Password</h2>
          <form onSubmit={changePassword} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Current Password</label>
              <input type="password" value={pwForm.current} onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))}
                className="input w-full" placeholder="••••••••" required />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">New Password</label>
              <input type="password" value={pwForm.newPw} onChange={e => setPwForm(p => ({ ...p, newPw: e.target.value }))}
                className="input w-full" placeholder="Min. 8 characters" required />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Confirm New Password</label>
              <input type="password" value={pwForm.confirm} onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))}
                className="input w-full" placeholder="Repeat new password" required />
            </div>
            <button type="submit" disabled={saving} className="btn-primary text-sm px-5 py-2 disabled:opacity-50 flex items-center gap-2">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              Update Password
            </button>
          </form>
        </Card>
      )}

      {tab === 'danger' && (
        <Card className="p-6 border border-red-200 dark:border-red-900">
          <h2 className="font-semibold text-sm mb-2 flex items-center gap-2 text-red-600"><Trash2 className="w-4 h-4" /> Delete Account</h2>
          <p className="text-sm text-surface-500 mb-4">This action is permanent and cannot be undone. All your data will be deleted.</p>
          <form onSubmit={deleteAccount} className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Enter your password to confirm</label>
              <input type="password" value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)}
                className="input w-full border-red-200 dark:border-red-900" placeholder="Your password" required />
            </div>
            <button type="submit"
              className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors">
              <Trash2 className="w-4 h-4" /> Delete My Account
            </button>
          </form>
        </Card>
      )}
    </div>
  );
};
