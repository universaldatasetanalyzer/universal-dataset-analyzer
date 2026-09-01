export interface Dataset {
  id: string;
  name: string;
  size: number;
  rows: number;
  columns: number;
  uploadedAt: string;
  status: 'processing' | 'ready' | 'error';
  healthScore: number;
  format: 'csv' | 'xlsx' | 'json' | 'parquet';
}

export interface Column {
  name: string;
  type: 'numeric' | 'categorical' | 'datetime' | 'boolean' | 'text';
  nullCount: number;
  nullPercent: number;
  uniqueCount: number;
  sample: string[];
  min?: number;
  max?: number;
  mean?: number;
}

export interface QualityIssue {
  type: 'missing' | 'duplicate' | 'outlier' | 'invalid';
  column?: string;
  count: number;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

export interface Report {
  id: string;
  name: string;
  datasetId: string;
  type: 'quality' | 'summary' | 'insights' | 'full';
  createdAt: string;
  size: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'analyst' | 'viewer';
  status: 'active' | 'invited' | 'inactive';
  avatar?: string;
  joinedAt: string;
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
  datasetId: string;
  messages: Message[];
  createdAt: string;
}

export interface Plan {
  name: string;
  price: number;
  period: 'month' | 'year';
  features: string[];
  current?: boolean;
}

export interface Invoice {
  id: string;
  date: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed';
  description: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: string;
}
