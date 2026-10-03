import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BarChart3, Eye, EyeOff, AlertCircle, CheckCircle, Check, X } from 'lucide-react';
import { authApi } from '../services/api';
import { useStore } from '../store';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// ── Password strength checker ─────────────────────────────────────────────────
const RULES = [
  { id: 'length',  label: 'At least 8 characters',          test: (p: string) => p.length >= 8 },
  { id: 'upper',   label: 'At least one uppercase letter',   test: (p: string) => /[A-Z]/.test(p) },
  { id: 'lower',   label: 'At least one lowercase letter',   test: (p: string) => /[a-z]/.test(p) },
  { id: 'number',  label: 'At least one number',             test: (p: string) => /[0-9]/.test(p) },
  { id: 'special', label: 'At least one special character',  test: (p: string) => /[^A-Za-z0-9\s]/.test(p) },
];

function getStrength(password: string) {
  const passed = RULES.filter(r => r.test(password)).length;
  if (passed <= 1) return { level: 0, label: 'Very Weak',  color: '#ef4444' };
  if (passed === 2) return { level: 1, label: 'Weak',       color: '#f97316' };
  if (passed === 3) return { level: 2, label: 'Fair',       color: '#f59e0b' };
  if (passed === 4) return { level: 3, label: 'Strong',     color: '#10b981' };
  return              { level: 4, label: 'Very Strong', color: '#0ea5e9' };
}

function validatePassword(password: string): string | null {
  for (const rule of RULES) {
    if (!rule.test(password)) return rule.label + ' is required';
  }
  return null;
}

const PasswordStrength: React.FC<{ password: string }> = ({ password }) => {
  if (!password) return null;
  const strength = getStrength(password);
  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1">
        {[0,1,2,3,4].map(i => (
          <div key={i} className="flex-1 h-1 rounded-full transition-all duration-300"
            style={{ background: i <= strength.level ? strength.color : '#e2e8f0' }} />
        ))}
      </div>
      <p className="text-xs font-medium" style={{ color: strength.color }}>{strength.label}</p>
      <div className="space-y-1">
        {RULES.map(rule => {
          const ok = rule.test(password);
          return (
            <div key={rule.id} className="flex items-center gap-1.5 text-xs">
              {ok
                ? <Check className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                : <X    className="w-3 h-3 text-surface-400 flex-shrink-0" />}
              <span className={ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-surface-400'}>{rule.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Google Sign In Button ─────────────────────────────────────────────────────
const GoogleButton: React.FC<{ label: string }> = ({ label }) => (
  <a
    href={`${BASE_URL}/auth/google`}
    className="flex items-center justify-center gap-3 w-full py-2.5 px-4 rounded-xl border border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors text-sm font-medium"
  >
    <svg className="w-4 h-4" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
    {label}
  </a>
);

const Divider = () => (
  <div className="flex items-center gap-3 my-4">
    <div className="flex-1 h-px bg-surface-200 dark:bg-surface-700" />
    <span className="text-xs text-surface-400">or</span>
    <div className="flex-1 h-px bg-surface-200 dark:bg-surface-700" />
  </div>
);

// ── Auth Card ─────────────────────────────────────────────────────────────────
const AuthCard: React.FC<{ title: string; subtitle: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <div className="min-h-screen flex items-center justify-center bg-surface-50 dark:bg-surface-950 px-4">
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md bg-white dark:bg-surface-900 rounded-2xl shadow-xl border border-surface-200 dark:border-surface-800 p-8"
    >
      <div className="flex items-center gap-2 mb-8">
        <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
          <BarChart3 className="w-4 h-4 text-white" />
        </div>
        <span className="font-display font-bold text-lg">Universal Analyzer</span>
      </div>
      <h1 className="text-2xl font-display font-bold mb-1">{title}</h1>
      <p className="text-surface-500 text-sm mb-6">{subtitle}</p>
      {children}
    </motion.div>
  </div>
);

const ErrorBox: React.FC<{ msg: string }> = ({ msg }) => (
  <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm mb-3">
    <AlertCircle className="w-4 h-4 flex-shrink-0" />{msg}
  </div>
);

// ── Login ─────────────────────────────────────────────────────────────────────
export const LoginPage: React.FC = () => {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [searchParams]          = useSearchParams();
  const oauthError              = searchParams.get('error');
  const [error, setError]       = useState(() => oauthError ? `Google sign-in failed: ${oauthError.replace(/_/g, ' ')}` : '');
  const navigate = useNavigate();
  const { setAuthUser } = useStore();
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res = await authApi.login({ email, password });
      authApi.setToken(res.token); authApi.setUser(res.user); setAuthUser(res.user);
      navigate('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally { setLoading(false); }
  };

  return (
    <AuthCard title="Welcome back" subtitle="Sign in to your account">
      <GoogleButton label="Sign in with Google" />
      <Divider />
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorBox msg={error} />}
        <div>
          <label className="text-sm font-medium mb-1.5 block">Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="you@company.com" required className="input w-full" />
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Password</label>
          <div className="relative">
            <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required className="input w-full pr-10" />
            <button type="button" onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600">
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <Link to="/forgot-password" className="text-xs text-brand-500 hover:text-brand-600 mt-1 block text-right">Forgot password?</Link>
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5 disabled:opacity-50">
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
        <p className="text-center text-sm text-surface-500">
          Don't have an account?{' '}
          <Link to="/register" className="text-brand-500 hover:text-brand-600 font-medium">Sign up</Link>
        </p>
      </form>
    </AuthCard>
  );
};

// ── Register ──────────────────────────────────────────────────────────────────
export const RegisterPage: React.FC = () => {
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    const pwError = validatePassword(password);
    if (pwError) { setError(pwError); return; }
    setLoading(true);
    try {
      await authApi.register({ name, email, password });
      navigate('/confirm-email?email=' + encodeURIComponent(email));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally { setLoading(false); }
  };

  const allRulesPassed = RULES.every(r => r.test(password));

  return (
    <AuthCard title="Create account" subtitle="Start analyzing your datasets today">
      <GoogleButton label="Sign up with Google" />
      <Divider />
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorBox msg={error} />}
        <div>
          <label className="text-sm font-medium mb-1.5 block">Full Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="John Smith" required className="input w-full" />
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required className="input w-full" />
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Password</label>
          <div className="relative">
            <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Create a strong password" required className="input w-full pr-10" />
            <button type="button" onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600">
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <PasswordStrength password={password} />
        </div>
        <button type="submit" disabled={loading || !allRulesPassed} className="btn-primary w-full justify-center py-2.5 disabled:opacity-50">
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
        <p className="text-center text-sm text-surface-500">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-500 hover:text-brand-600 font-medium">Sign in</Link>
        </p>
      </form>
    </AuthCard>
  );
};

// ── Confirm Email ────────────────────────────────────────────────────────────
export const ConfirmEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [seconds, setSeconds] = useState(60);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!seconds) return undefined;
    const timer = window.setInterval(() => setSeconds(value => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [seconds]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit verification code.');
      return;
    }
    setLoading(true);
    try {
      await authApi.verifyEmail(email, code);
      setDone(true);
      window.setTimeout(() => navigate('/login'), 1800);
    } catch (err: unknown) {
      setCode('');
      setError(err instanceof Error ? err.message : 'Invalid or expired verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setResending(true);
    try {
      await authApi.resendVerification(email);
      setCode('');
      setSeconds(60);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to resend verification code');
    } finally {
      setResending(false);
    }
  };

  if (!email) {
    return (
      <AuthCard title="Confirm your email" subtitle="The verification email link is missing an address.">
        <Link to="/register" className="btn-primary w-full text-center py-2.5 block">Create an account</Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Confirm your email" subtitle={`Enter the 6-digit code sent to ${email}`}>
      {done ? (
        <div className="text-center py-4">
          <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-7 h-7 text-emerald-500" />
          </div>
          <p className="text-sm font-medium mb-1">Email verified!</p>
          <p className="text-sm text-surface-500">Redirecting you to sign in…</p>
        </div>
      ) : (
        <form onSubmit={handleVerify} className="space-y-4">
          {error && <ErrorBox msg={error} />}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Verification code</label>
            <input
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              required
              autoFocus
              className="input w-full text-center tracking-[0.5em] text-lg"
            />
          </div>
          <button type="submit" disabled={loading || code.length !== 6} className="btn-primary w-full justify-center py-2.5 disabled:opacity-50">
            {loading ? 'Verifying...' : 'Verify email'}
          </button>
          <div className="text-center text-sm text-surface-500">
            Didn’t receive a code?{' '}
            <button type="button" onClick={handleResend} disabled={resending || seconds > 0}
              className="text-brand-500 hover:text-brand-600 font-medium disabled:text-surface-400">
              {resending ? 'Sending...' : seconds > 0 ? `Resend in ${seconds}s` : 'Resend code'}
            </button>
          </div>
          <Link to="/login" className="text-center text-sm text-brand-500 hover:text-brand-600 block">Back to sign in</Link>
        </form>
      )}
    </AuthCard>
  );
};

// ── Forgot Password ───────────────────────────────────────────────────────────
export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try { await authApi.forgotPassword(email); setSent(true); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to send reset email'); }
    finally { setLoading(false); }
  };

  return (
    <AuthCard title="Reset password" subtitle="We'll send a reset link to your email">
      {sent ? (
        <div className="text-center py-4">
          <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-7 h-7 text-emerald-500" />
          </div>
          <p className="text-sm font-medium mb-1">Check your email</p>
          <p className="text-sm text-surface-500 mb-5">If <strong>{email}</strong> is registered, a reset link has been sent.</p>
          <Link to="/login" className="text-brand-500 text-sm font-medium hover:text-brand-600">Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <ErrorBox msg={error} />}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required className="input w-full" />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5 disabled:opacity-50">
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
          <Link to="/login" className="text-center text-sm text-brand-500 hover:text-brand-600 block">Back to sign in</Link>
        </form>
      )}
    </AuthCard>
  );
};

// ── Reset Password ────────────────────────────────────────────────────────────
export const ResetPasswordPage: React.FC = () => {
  const [searchParams]          = useSearchParams();
  const token                   = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(false);
  const [error, setError]       = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    const pwError = validatePassword(password);
    if (pwError)           { setError(pwError); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (!token)               { setError('Invalid or missing reset token'); return; }
    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally { setLoading(false); }
  };

  if (!token) return (
    <AuthCard title="Invalid link" subtitle="This reset link is invalid or has expired.">
      <Link to="/forgot-password" className="btn-primary w-full text-center py-2.5 block">Request a new link</Link>
    </AuthCard>
  );

  return (
    <AuthCard title="New password" subtitle="Choose a strong password for your account">
      {done ? (
        <div className="text-center py-4">
          <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-7 h-7 text-emerald-500" />
          </div>
          <p className="text-sm font-medium mb-1">Password updated!</p>
          <p className="text-sm text-surface-500">Redirecting you to sign in…</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <ErrorBox msg={error} />}
          <div>
            <label className="text-sm font-medium mb-1.5 block">New Password</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Create a strong password" required className="input w-full pr-10" />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <PasswordStrength password={password} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Confirm Password</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" required className="input w-full" />
          </div>
          <button type="submit" disabled={loading || !RULES.every(r => r.test(password))} className="btn-primary w-full justify-center py-2.5 disabled:opacity-50">
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      )}
    </AuthCard>
  );
};

// ── Google OAuth Callback ─────────────────────────────────────────────────────
export const GoogleCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();
  const { setAuthUser } = useStore();

  React.useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const token = hashParams.get('token');
    const error = searchParams.get('error');

    if (error) { navigate('/login?error=' + error); return; }
    if (token) {
      authApi.setToken(token);
      authApi.me().then(res => {
        authApi.setUser(res.user);
        setAuthUser(res.user);
        navigate('/dashboard');
      }).catch(() => navigate('/login'));
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-surface-500 text-sm">Signing you in...</p>
      </div>
    </div>
  );
};