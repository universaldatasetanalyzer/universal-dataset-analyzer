import type { Dataset, Column, QualityIssue, Report, TeamMember, ChatSession, Invoice, Notification } from '../types';

export const mockDatasets: Dataset[] = [
  { id: '1', name: 'sales_data_2024.csv', size: 2450000, rows: 45230, columns: 18, uploadedAt: '2024-12-01T10:30:00Z', status: 'ready', healthScore: 87, format: 'csv' },
  { id: '2', name: 'customer_profiles.xlsx', size: 1200000, rows: 12500, columns: 24, uploadedAt: '2024-12-03T14:15:00Z', status: 'ready', healthScore: 92, format: 'xlsx' },
  { id: '3', name: 'product_inventory.json', size: 340000, rows: 3200, columns: 12, uploadedAt: '2024-12-05T09:00:00Z', status: 'processing', healthScore: 0, format: 'json' },
  { id: '4', name: 'marketing_campaigns.csv', size: 890000, rows: 8900, columns: 15, uploadedAt: '2024-12-06T11:45:00Z', status: 'ready', healthScore: 74, format: 'csv' },
  { id: '5', name: 'financial_records.parquet', size: 5600000, rows: 98000, columns: 32, uploadedAt: '2024-11-28T08:20:00Z', status: 'error', healthScore: 0, format: 'parquet' },
];

export const mockColumns: Column[] = [
  { name: 'customer_id', type: 'numeric', nullCount: 0, nullPercent: 0, uniqueCount: 45230, sample: ['10001', '10002', '10003'] },
  { name: 'order_date', type: 'datetime', nullCount: 12, nullPercent: 0.03, uniqueCount: 365, sample: ['2024-01-01', '2024-01-02', '2024-01-03'] },
  { name: 'revenue', type: 'numeric', nullCount: 234, nullPercent: 0.52, uniqueCount: 12450, sample: ['150.00', '299.99', '450.50'], min: 0.99, max: 9999.99, mean: 287.45 },
  { name: 'product_category', type: 'categorical', nullCount: 0, nullPercent: 0, uniqueCount: 8, sample: ['Electronics', 'Clothing', 'Books'] },
  { name: 'region', type: 'categorical', nullCount: 45, nullPercent: 0.10, uniqueCount: 12, sample: ['North', 'South', 'East'] },
  { name: 'customer_name', type: 'text', nullCount: 0, nullPercent: 0, uniqueCount: 44980, sample: ['John Doe', 'Jane Smith', 'Bob Johnson'] },
  { name: 'is_active', type: 'boolean', nullCount: 0, nullPercent: 0, uniqueCount: 2, sample: ['true', 'false', 'true'] },
  { name: 'age', type: 'numeric', nullCount: 890, nullPercent: 1.97, uniqueCount: 72, sample: ['28', '35', '42'], min: 18, max: 89, mean: 38.5 },
];

export const mockQualityIssues: QualityIssue[] = [
  { type: 'missing', column: 'revenue', count: 234, severity: 'medium', description: '0.52% of revenue values are missing' },
  { type: 'missing', column: 'age', count: 890, severity: 'high', description: '1.97% of age values are missing' },
  { type: 'missing', column: 'region', count: 45, severity: 'low', description: '0.10% of region values are missing' },
  { type: 'duplicate', count: 127, severity: 'medium', description: '127 exact duplicate rows found' },
  { type: 'outlier', column: 'revenue', count: 23, severity: 'low', description: '23 revenue values are statistical outliers (>3σ)' },
  { type: 'invalid', column: 'order_date', count: 12, severity: 'medium', description: '12 dates are in an unrecognized format' },
];

export const mockReports: Report[] = [
  { id: '1', name: 'Sales Data Full Report', datasetId: '1', type: 'full', createdAt: '2024-12-01T12:00:00Z', size: '2.4 MB' },
  { id: '2', name: 'Customer Profiles Quality Report', datasetId: '2', type: 'quality', createdAt: '2024-12-03T16:00:00Z', size: '890 KB' },
  { id: '3', name: 'Marketing Campaign Insights', datasetId: '4', type: 'insights', createdAt: '2024-12-06T14:00:00Z', size: '1.1 MB' },
  { id: '4', name: 'Sales Data Summary', datasetId: '1', type: 'summary', createdAt: '2024-12-02T09:00:00Z', size: '340 KB' },
];

export const mockTeamMembers: TeamMember[] = [
  { id: '1', name: 'Alex Johnson', email: 'alex@company.com', role: 'owner', status: 'active', joinedAt: '2024-01-01T00:00:00Z' },
  { id: '2', name: 'Sarah Chen', email: 'sarah@company.com', role: 'admin', status: 'active', joinedAt: '2024-02-15T00:00:00Z' },
  { id: '3', name: 'Marcus Williams', email: 'marcus@company.com', role: 'analyst', status: 'active', joinedAt: '2024-03-20T00:00:00Z' },
  { id: '4', name: 'Priya Patel', email: 'priya@company.com', role: 'analyst', status: 'active', joinedAt: '2024-04-10T00:00:00Z' },
  { id: '5', name: 'Tom Brown', email: 'tom@company.com', role: 'viewer', status: 'invited', joinedAt: '2024-12-06T00:00:00Z' },
];

export const mockChatSessions: ChatSession[] = [
  {
    id: '1', title: 'Sales Trend Analysis', datasetId: '1', createdAt: '2024-12-05T10:00:00Z',
    messages: [
      { id: '1', role: 'user', content: 'What are the top performing product categories?', timestamp: '2024-12-05T10:00:00Z' },
      { id: '2', role: 'assistant', content: 'Based on the sales data, **Electronics** leads with $2.3M in revenue (34% of total), followed by **Clothing** at $1.8M (27%). Electronics saw a 23% YoY growth, making it the fastest-growing category.\n\nKey insights:\n- Electronics: 15,234 orders, avg order value $151\n- Clothing: 18,900 orders, avg order value $95\n- Books: 8,200 orders, avg order value $42', timestamp: '2024-12-05T10:00:05Z' },
    ]
  },
  {
    id: '2', title: 'Missing Data Investigation', datasetId: '1', createdAt: '2024-12-06T09:30:00Z',
    messages: [
      { id: '1', role: 'user', content: 'Which columns have the most missing data?', timestamp: '2024-12-06T09:30:00Z' },
      { id: '2', role: 'assistant', content: 'The **age** column has the highest missing rate at 1.97% (890 missing values), followed by **revenue** at 0.52% (234 missing). These are the only two columns with notable missingness above 0.1%.', timestamp: '2024-12-06T09:30:03Z' },
    ]
  },
];

export const mockInvoices: Invoice[] = [
  { id: 'INV-001', date: '2024-12-01', amount: 49, status: 'paid', description: 'Pro Plan - December 2024' },
  { id: 'INV-002', date: '2024-11-01', amount: 49, status: 'paid', description: 'Pro Plan - November 2024' },
  { id: 'INV-003', date: '2024-10-01', amount: 49, status: 'paid', description: 'Pro Plan - October 2024' },
  { id: 'INV-004', date: '2024-09-01', amount: 19, status: 'paid', description: 'Starter Plan - September 2024' },
];

export const mockNotifications: Notification[] = [
  { id: '1', title: 'Dataset Ready', message: 'customer_profiles.xlsx has been processed', type: 'success', read: false, createdAt: '2024-12-06T14:00:00Z' },
  { id: '2', title: 'Quality Alert', message: 'High missing rate detected in marketing_campaigns.csv', type: 'warning', read: false, createdAt: '2024-12-06T13:00:00Z' },
  { id: '3', title: 'Processing Error', message: 'financial_records.parquet failed to process', type: 'error', read: true, createdAt: '2024-12-05T10:00:00Z' },
  { id: '4', title: 'Report Generated', message: 'Sales Data Full Report is ready to download', type: 'info', read: true, createdAt: '2024-12-01T12:00:00Z' },
];

export const chartData = {
  histogram: Array.from({ length: 20 }, (_, i) => ({ bin: (i * 500).toString(), count: Math.floor(Math.random() * 800 + 50) })),
  bar: [
    { name: 'Electronics', value: 2300000, color: '#0ea5e9' },
    { name: 'Clothing', value: 1800000, color: '#d946ef' },
    { name: 'Books', value: 450000, color: '#10b981' },
    { name: 'Home', value: 1200000, color: '#f59e0b' },
    { name: 'Sports', value: 890000, color: '#6366f1' },
    { name: 'Beauty', value: 670000, color: '#ec4899' },
  ],
  pie: [
    { name: 'Electronics', value: 34, fill: '#0ea5e9' },
    { name: 'Clothing', value: 27, fill: '#d946ef' },
    { name: 'Home', value: 18, fill: '#10b981' },
    { name: 'Books', value: 7, fill: '#f59e0b' },
    { name: 'Other', value: 14, fill: '#6366f1' },
  ],
  scatter: Array.from({ length: 60 }, () => ({ x: Math.random() * 500 + 10, y: Math.random() * 9000 + 100, z: Math.random() * 100 })),
  monthly: Array.from({ length: 12 }, (_, i) => ({
    month: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i],
    revenue: Math.floor(Math.random() * 300000 + 400000),
    orders: Math.floor(Math.random() * 2000 + 3000),
  })),
};

export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

export const formatDate = (dateStr: string): string =>
  new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export const formatNumber = (n: number): string =>
  n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` :
  n >= 1000 ? `${(n / 1000).toFixed(1)}K` :
  n.toString();
