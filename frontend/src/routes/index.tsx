import React from 'react';
import { createBrowserRouter, RouterProvider, Navigate, useLocation } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { LandingPage } from '../pages/LandingPage';
import { LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage, GoogleCallbackPage } from '../pages/AuthPages';
import { AcceptInvitePage } from '../pages/AcceptInvitePage';
import { PrivacyPage, TermsPage, SupportPage } from '../pages/LegalPages';
import { DashboardPage } from '../pages/DashboardPage';
import { UploadPage } from '../pages/UploadPage';
import { SummaryPage } from '../pages/SummaryPage';
import { QualityPage } from '../pages/QualityPage';
import { CleaningPage } from '../pages/CleaningPage';
import { VisualizePage } from '../pages/VisualizePage';
import { InsightsPage } from '../pages/InsightsPage';
import { ChatPage } from '../pages/ChatPage';
import { ReportsPage } from '../pages/ReportsPage';
import { BillingPage } from '../pages/BillingPage';
import { TeamPage } from '../pages/TeamPage';
import { SettingsPage } from '../pages/SettingsPage';
import { AdminPage } from '../pages/AdminPage';
import { authApi } from '../services/api';
import { useStore } from '../store';

// ── Role permissions map ──────────────────────────────────────────────────────
const ROLE_PERMISSIONS: Record<string, string[]> = {
  owner:   ['dashboard','upload','summary','quality','cleaning','visualize','insights','chat','reports','billing','team','settings'],
  admin:   ['dashboard','upload','summary','quality','cleaning','visualize','insights','chat','reports','team','settings'],
  analyst: ['dashboard','upload','summary','quality','cleaning','visualize','insights','chat','reports','settings'],
  viewer:  ['dashboard','summary','quality','visualize','insights','chat','settings'],
};

// ── Guards ────────────────────────────────────────────────────────────────────
const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const token    = authApi.getToken();
  if (!token) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
};

const RequireRole: React.FC<{ permKey: string; children: React.ReactNode }> = ({ permKey, children }) => {
  const { authUser } = useStore();
  const role         = (authUser as { plan?: string; role?: string } | null)?.role || 'viewer';
  const allowed      = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.viewer;
  if (!allowed.includes(permKey)) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center mb-4">
          <span className="text-2xl">🔒</span>
        </div>
        <h2 className="text-lg font-semibold mb-1">Access Restricted</h2>
        <p className="text-surface-500 text-sm">Your role <strong className="capitalize">{role}</strong> doesn't have permission to access this page.</p>
      </div>
    );
  }
  return <>{children}</>;
};

const router = createBrowserRouter([
  { path: '/',                element: <LandingPage /> },
  { path: '/login',           element: <LoginPage /> },
  { path: '/register',        element: <RegisterPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password',  element: <ResetPasswordPage /> },
  { path: '/accept-invite',         element: <AcceptInvitePage /> },
  { path: '/auth/google/callback', element: <GoogleCallbackPage /> },
  { path: '/privacy',           element: <PrivacyPage /> },
  { path: '/terms',             element: <TermsPage /> },
  { path: '/support',           element: <SupportPage /> },
  {
    element: <RequireAuth><AppLayout /></RequireAuth>,
    children: [
      { path: '/dashboard',  element: <RequireRole permKey="dashboard"><DashboardPage /></RequireRole> },
      { path: '/upload',     element: <RequireRole permKey="upload"><UploadPage /></RequireRole> },
      { path: '/summary',    element: <RequireRole permKey="summary"><SummaryPage /></RequireRole> },
      { path: '/quality',    element: <RequireRole permKey="quality"><QualityPage /></RequireRole> },
      { path: '/cleaning',   element: <RequireRole permKey="cleaning"><CleaningPage /></RequireRole> },
      { path: '/visualize',  element: <RequireRole permKey="visualize"><VisualizePage /></RequireRole> },
      { path: '/insights',   element: <RequireRole permKey="insights"><InsightsPage /></RequireRole> },
      { path: '/chat',       element: <RequireRole permKey="chat"><ChatPage /></RequireRole> },
      { path: '/reports',    element: <RequireRole permKey="reports"><ReportsPage /></RequireRole> },
      { path: '/billing',    element: <RequireRole permKey="billing"><BillingPage /></RequireRole> },
      { path: '/team',       element: <RequireRole permKey="team"><TeamPage /></RequireRole> },
      { path: '/settings',   element: <RequireRole permKey="settings"><SettingsPage /></RequireRole> },
      { path: '/admin',      element: <AdminPage /> },
      { path: '/app',        element: <Navigate to="/dashboard" replace /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);

export const AppRouter: React.FC = () => <RouterProvider router={router} />;