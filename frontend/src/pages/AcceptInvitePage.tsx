import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, CheckCircle, AlertCircle, RefreshCw, BarChart3 } from 'lucide-react';
import { authApi } from '../services/api';
import { useStore } from '../store';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const AcceptInvitePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token          = searchParams.get('token') || '';
  const navigate       = useNavigate();
  const { authUser } = useStore();

  const [status, setStatus]     = useState<'loading' | 'needsLogin' | 'success' | 'error'>(token ? 'loading' : 'error');
  const [message, setMessage]   = useState(token ? '' : 'Invalid invite link.');
  const [inviteInfo, setInviteInfo] = useState<{ email: string; role: string } | null>(null);

  async function checkInvite() {
    try {
      const res = await fetch(`${BASE_URL}/team/invite/${token}`);
      const data = await res.json();

      if (!res.ok) {
        setStatus('error');
        setMessage(data.error || 'Invalid or expired invite link.');
        return;
      }

      // لو المستخدم مسجل دخول، قبل الـ invite تلقائي
      if (authUser) {
        await acceptWithAuth();
        return;
      }

      // لو مش مسجل دخول، وضح المعلومات وخليه يسجل
      setInviteInfo({ email: data.email, role: data.role });
      setStatus('needsLogin');
    } catch {
      setStatus('error');
      setMessage('Something went wrong. Please try again.');
    }
  }

  async function acceptWithAuth() {
    try {
      const tkn = authApi.getToken();
      const res = await fetch(`${BASE_URL}/team/invite/${token}`, {
        headers: { Authorization: `Bearer ${tkn}` },
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('success');
        setTimeout(() => navigate('/dashboard'), 2000);
      } else {
        setStatus('error');
        setMessage(data.error || 'Failed to accept invite.');
      }
    } catch {
      setStatus('error');
      setMessage('Something went wrong.');
    }
  }

  useEffect(() => {
    if (token) queueMicrotask(() => { void checkInvite(); });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50 dark:bg-surface-950 px-4">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white dark:bg-surface-900 rounded-2xl shadow-xl border border-surface-200 dark:border-surface-800 p-8 text-center"
      >
        {/* Logo */}
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-white" />
          </div>
          <span className="font-display font-bold text-lg">Universal Analyzer</span>
        </div>

        {/* Loading */}
        {status === 'loading' && (
          <div className="py-6">
            <RefreshCw className="w-10 h-10 text-brand-500 animate-spin mx-auto mb-4" />
            <p className="text-surface-500 text-sm">Validating invite link…</p>
          </div>
        )}

        {/* Needs Login */}
        {status === 'needsLogin' && inviteInfo && (
          <div className="py-2">
            <div className="w-14 h-14 rounded-full bg-brand-100 dark:bg-brand-950/30 flex items-center justify-center mx-auto mb-4">
              <Users className="w-7 h-7 text-brand-500" />
            </div>
            <h2 className="text-xl font-display font-bold mb-2">You've been invited!</h2>
            <p className="text-surface-500 text-sm mb-1">
              Invited as <strong className="text-surface-700 dark:text-surface-300 capitalize">{inviteInfo.role}</strong>
            </p>
            {inviteInfo.email && (
              <p className="text-xs text-surface-400 mb-6">for <strong>{inviteInfo.email}</strong></p>
            )}
            <div className="space-y-3">
              <Link
                to={`/register?invite=${token}&email=${encodeURIComponent(inviteInfo.email)}`}
                className="btn-primary w-full block text-center py-2.5"
              >
                Create Account & Join
              </Link>
              <Link
                to={`/login?invite=${token}`}
                className="block w-full text-center py-2.5 rounded-xl border border-surface-200 dark:border-surface-700 text-sm font-medium hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
              >
                Sign In & Join
              </Link>
            </div>
          </div>
        )}

        {/* Success */}
        {status === 'success' && (
          <div className="py-6">
            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-7 h-7 text-emerald-500" />
            </div>
            <h2 className="text-xl font-display font-bold mb-2">Welcome to the team!</h2>
            <p className="text-surface-500 text-sm">Redirecting you to the dashboard…</p>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="py-6">
            <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-7 h-7 text-red-500" />
            </div>
            <h2 className="text-xl font-display font-bold mb-2">Invalid Invite</h2>
            <p className="text-surface-500 text-sm mb-6">{message}</p>
            <Link to="/login" className="btn-primary block text-center py-2.5">Go to Sign In</Link>
          </div>
        )}
      </motion.div>
    </div>
  );
};