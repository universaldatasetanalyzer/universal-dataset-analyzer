// Centralized API client for the backend

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

function getToken(): string | null {
  return localStorage.getItem('uda_token');
}

function setToken(token: string) {
  localStorage.setItem('uda_token', token);
}

function clearToken() {
  localStorage.removeItem('uda_token');
  localStorage.removeItem('uda_user');
}

function setUser(user: object) {
  localStorage.setItem('uda_user', JSON.stringify(user));
}

function getUser() {
  try {
    const u = localStorage.getItem('uda_user');
    return u ? JSON.parse(u) : null;
  } catch {
    return null;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401) {
    clearToken();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Request failed: ${res.status}`);
  }

  return data as T;
}

async function uploadFile(path: string, file: File, onProgress?: (pct: number) => void): Promise<unknown> {
  const token = getToken();
  const formData = new FormData();
  formData.append('file', file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE_URL}${path}`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data);
        } else {
          reject(new Error(data.error || 'Upload failed'));
        }
      } catch {
        reject(new Error('Invalid server response'));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(formData);
  });
}

async function downloadFile(path: string, fallbackName: string) {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (res.status === 401) {
    clearToken();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Download failed: ${res.status}`);
  }

  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition');
  const fileName = disposition?.match(/filename="?([^";]+)"?/i)?.[1] || fallbackName;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// ── User type مع plan ──────────────────────────────────────────────────────────
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  plan?: string;
}

// ─── Auth ──────────────────────────────────────────────────────────────────────

export const authApi = {
  register: (data: { name: string; email: string; password: string }) =>
    request<{ token: string; user: AuthUser }>('/auth/register', { method: 'POST', body: data }),

  login: (data: { email: string; password: string }) =>
    request<{ token: string; user: AuthUser }>('/auth/login', { method: 'POST', body: data }),

  me: () => request<{ user: AuthUser }>('/auth/me'),

  forgotPassword: (email: string) =>
    request('/auth/forgot-password', { method: 'POST', body: { email } }),

  resetPassword: (token: string, password: string) =>
    request('/auth/reset-password', { method: 'POST', body: { token, password } }),

  setToken,
  setUser,
  getToken,
  getUser,
  clearToken,
  logout: () => {
    clearToken();
    window.location.href = '/login';
  },
};

// ─── Datasets ─────────────────────────────────────────────────────────────────

export const datasetsApi = {
  list: () => request<{ datasets: Dataset[]; sharedDatasets: Dataset[] }>('/datasets'),

  get: (id: string) => request<{ dataset: Dataset }>(`/datasets/${id}`),

  upload: (file: File, onProgress?: (pct: number) => void) =>
    uploadFile('/datasets/upload', file, onProgress) as Promise<{ dataset: Dataset }>,

  delete: (id: string) => request(`/datasets/${id}`, { method: 'DELETE' }),

  getSummary: (id: string) => request<SummaryData>(`/datasets/${id}/summary`),

  getQuality: (id: string) => request<QualityData>(`/datasets/${id}/quality`),

  getVisualization: (id: string) => request<VizData>(`/datasets/${id}/visualization`),

  downloadClean: (id: string) => downloadFile(`/datasets/${id}/download-clean`, 'cleaned_dataset.csv'),
};

// ─── Cleaning ─────────────────────────────────────────────────────────────────

export const cleaningApi = {
  preview: (id: string, operations: CleanOperations) =>
    request<CleanResult>(`/datasets/${id}/clean/preview`, { method: 'POST', body: { operations } }),

  apply: (id: string, operations: CleanOperations) =>
    request<CleanResult>(`/datasets/${id}/clean/apply`, { method: 'POST', body: { operations } }),
};

// ─── Chat ─────────────────────────────────────────────────────────────────────

export const chatApi = {
  getSessions: () => request<{ sessions: ChatSession[] }>('/chat/sessions'),

  getSession: (id: string) => request<{ session: ChatSession }>(`/chat/sessions/${id}`),

  createSession: (datasetId?: string, title?: string) =>
    request<{ session: ChatSession }>('/chat/sessions', { method: 'POST', body: { datasetId, title } }),

  sendMessage: (sessionId: string, message: string) =>
    request<{ message: Message }>(`/chat/sessions/${sessionId}/messages`, {
      method: 'POST', body: { message },
    }),

  deleteSession: (id: string) => request(`/chat/sessions/${id}`, { method: 'DELETE' }),
};

// ─── Insights ─────────────────────────────────────────────────────────────────

export const insightsApi = {
  get: (datasetId: string) => request<InsightsData>(`/insights/${datasetId}`),

  regenerate: (datasetId: string) =>
    request<InsightsData>(`/insights/${datasetId}/regenerate`, { method: 'POST' }),
};

// ─── Reports ──────────────────────────────────────────────────────────────────

export const reportsApi = {
  list: () => request<{ reports: Report[] }>('/reports'),

  generate: (datasetId: string, reportType: string, name?: string) =>
    request<{ report: Report }>('/reports', { method: 'POST', body: { datasetId, reportType, name } }),

  download: (id: string) => downloadFile(`/reports/${id}/download`, 'report.html'),

  delete: (id: string) => request(`/reports/${id}`, { method: 'DELETE' }),
};

// ─── Team ─────────────────────────────────────────────────────────────────────

export const teamApi = {
  get: () => request<{ org: Org; members: TeamMember[] }>('/team'),

  invite: (email: string, role: string) =>
    request('/team/invite', { method: 'POST', body: { email, role } }),

  updateMember: (memberId: string, role: string) =>
    request(`/team/members/${memberId}`, { method: 'PATCH', body: { role } }),

  removeMember: (memberId: string) =>
    request(`/team/members/${memberId}`, { method: 'DELETE' }),
};

// ─── Billing ──────────────────────────────────────────────────────────────────

export const billingApi = {
  get: () => request<BillingData>('/billing'),

  getCheckoutConfig: () => request<{ countryCode?: string }>('/billing/checkout-config'),

  cancel: () => request<{ message: string }>('/billing/cancel', { method: 'POST' }),
};

export const notificationsApi = {
  list: () => request<{ notifications: Notification[] }>('/notifications'),
  markRead: (id: string) => request<{ ok: true }>(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () => request<{ ok: true }>('/notifications/read-all', { method: 'POST' }),
};

// ─── Settings ─────────────────────────────────────────────────────────────────

export const settingsApi = {
  get: () => request<{ user: User; org: Org }>('/settings'),

  openPortal: () => request<{ url: string }>('/billing/portal-session', { method: 'POST' }),

  updateProfile: (data: { name?: string; email?: string }) =>
    request('/settings/profile', { method: 'PATCH', body: data }),

  changePassword: (currentPassword: string, newPassword: string) =>
    request('/settings/change-password', { method: 'POST', body: { currentPassword, newPassword } }),

  deleteAccount: (password: string) =>
    request('/settings/account', { method: 'DELETE', body: { password } }),
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const dashboardApi = {
  getStats: () => request<{
    totalDatasets: number;
    avgHealthScore: number;
    reportsGenerated: number;
    chatSessions: number;
  }>('/dashboard/stats'),
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Dataset {
  id: string;
  name: string;
  size: number;
  rows: number;
  columns: number;
  uploadedAt: string;
  status: 'processing' | 'ready' | 'error';
  healthScore: number;
  format: string;
  isDemo?: boolean;
  source?: 'own' | 'shared';
  sharedByName?: string;
  sharedByEmail?: string;
  orgName?: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: string;
}

export interface Column {
  name: string;
  type: string;
  nullCount: number;
  nullPercent: number;
  uniqueCount: number;
  sample: string[];
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  std?: number;
}

export interface SummaryData {
  rowCount: number;
  columnCount: number;
  columns: Column[];
  typeDistribution: Record<string, number>;
  format: string;
}

export interface QualityIssue {
  type: string;
  column?: string;
  count: number;
  severity: string;
  description: string;
}

export interface QualityData {
  healthScore: number;
  issues: QualityIssue[];
  totalMissing: number;
  totalDuplicates: number;
  totalOutliers: number;
  missingByColumn: { name: string; pct: number; count: number }[];
  issueDistribution: { name: string; value: number; fill: string }[];
}

export interface VizData {
  charts: {
    type: string;
    column?: string;
    columns?: string[];
    data: Record<string, unknown>[];
  }[];
  correlation?: {
    columns: string[];
    data: { x: string; y: string; value: number }[];
  };
}

export interface CleanOperations {
  fillMissing?: Record<string, string>;
  removeDuplicates?: boolean;
  outliers?: Record<string, string>;
  text?: Record<string, string | string[]>;
  dropEmptyColumns?: boolean;
}

export interface CleanResult {
  applied: { op: string; before?: number; after?: number; changed?: number }[];
  rowsBefore: number;
  rowsAfter: number;
  colsBefore: number;
  colsAfter: number;
  rowsRemoved: number;
  preview: Record<string, unknown>[];
  cleanedFilePath?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatSession {
  id: string;
  title: string;
  datasetId?: string;
  datasetName?: string;
  messageCount?: number;
  messages?: Message[];
  createdAt: string;
}

export interface InsightsData {
  executiveSummary: string;
  keyFindings: { title: string; description: string; impact: string; metric: string }[];
  trends: { title: string; description: string; direction: string }[];
  correlations: { col1: string; col2: string; strength: number; description: string }[];
  anomalies: { title: string; description: string; severity: string }[];
  recommendations?: string[];
  decisionBrief?: {
    title: string;
    decision: string;
    action: string;
    when: string;
    value: string;
    evidence: string;
    impact: string;
    confidence: number;
    validation: string;
  }[];
}

export interface Report {
  id: string;
  name: string;
  datasetId: string;
  datasetName?: string;
  type: string;
  status: string;
  size?: string;
  createdAt: string;
}

export interface TeamMember {
  id: string;
  userId?: string;
  name: string;
  email: string;
  role: string;
  status: string;
  joinedAt: string;
}

export interface Org {
  id: string;
  name: string;
  plan: string;
}

export interface BillingData {
  subscription: {
    plan: 'free' | 'pro';
    status: string;
    interval?: 'month' | 'year' | null;
    currentPeriodEnd?: string;
    planDetails: {
      name: string;
      price: number | null;
      datasets: number;
      rows: number;
      aiInsights: boolean;
      reports: boolean;
    };
  };
  usage: { datasets: number; datasetsLimit: number };
  pricing: {
    monthly: { priceId: string; price: number; interval: 'month' };
    yearly: { priceId: string; price: number; interval: 'year' };
  };
}

export interface CheckoutConfig {
  clientToken: string;
  environment: string;
  prices: {
    monthly: { priceId: string; price: number; interval: 'month' };
    yearly: { priceId: string; price: number; interval: 'year' };
  };
  customer: { email: string; userId: string };
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar_url?: string;
  created_at?: string;
}

export const formatBytes = (bytes: number): string => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

export const formatDate = (dateStr: string): string => {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

export const formatNumber = (n: number): string =>
  n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` :
  n >= 1000 ? `${(n / 1000).toFixed(1)}K` :
  (n || 0).toString();