require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { pool } = require('./index');

const migrations = [
  // Users & Auth
  `CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255),
    role VARCHAR(50) DEFAULT 'owner',
    avatar_url TEXT,
    email_verified BOOLEAN DEFAULT false,
    verification_code_hash VARCHAR(255),
    verification_code_expires TIMESTAMPTZ,
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Organizations
  `CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    plan VARCHAR(50) DEFAULT 'free',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Organization members
  `CREATE TABLE IF NOT EXISTS org_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'viewer',
    status VARCHAR(50) DEFAULT 'active',
    invited_email VARCHAR(255),
    invite_token VARCHAR(255),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_id, user_id)
  )`,

  // Datasets
  `CREATE TABLE IF NOT EXISTS datasets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    storage_key TEXT,
    file_size BIGINT NOT NULL,
    format VARCHAR(20) NOT NULL,
    rows_count INTEGER,
    columns_count INTEGER,
    status VARCHAR(50) DEFAULT 'processing',
    health_score INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Analysis results
  `CREATE TABLE IF NOT EXISTS analysis_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id UUID REFERENCES datasets(id) ON DELETE CASCADE,
    result_type VARCHAR(50) NOT NULL,
    result_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Chat sessions
  `CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    dataset_id UUID REFERENCES datasets(id) ON DELETE CASCADE,
    title VARCHAR(255) DEFAULT 'New Conversation',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Chat messages
  `CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Reports
  `CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    dataset_id UUID REFERENCES datasets(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    report_type VARCHAR(50) NOT NULL,
    file_path TEXT,
    storage_key TEXT,
    file_size INTEGER,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Subscriptions
  `CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    plan VARCHAR(50) NOT NULL DEFAULT 'free',
    status VARCHAR(50) DEFAULT 'active',
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Usage tracking
  `CREATE TABLE IF NOT EXISTS usage_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    action_type VARCHAR(100) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Audit logs
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    resource_type VARCHAR(100),
    resource_id UUID,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Admin access and Google OAuth
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255)`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code_hash VARCHAR(255)`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code_expires TIMESTAMPTZ`,
  `ALTER TABLE datasets ADD COLUMN IF NOT EXISTS storage_key TEXT`,
  `ALTER TABLE reports ADD COLUMN IF NOT EXISTS storage_key TEXT`,
  `ALTER TABLE org_members ADD COLUMN IF NOT EXISTS invite_expires TIMESTAMPTZ`,
  `ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL`,

  // Paddle billing fields (added for payments integration)
  `ALTER TABLE datasets ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false`,
  `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS paddle_subscription_id VARCHAR(255)`,
  `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS paddle_customer_id VARCHAR(255)`,
  `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS paddle_price_id VARCHAR(255)`,
  `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_interval VARCHAR(20)`,
  `CREATE TABLE IF NOT EXISTS customers (
    customer_id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    last_event_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS paddle_product_id VARCHAR(255)`,
  `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS scheduled_change_action VARCHAR(50)`,
  `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS scheduled_change_at TIMESTAMPTZ`,
  `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS paddle_last_event_at TIMESTAMPTZ`,
  `CREATE TABLE IF NOT EXISTS paddle_transactions (
    transaction_id VARCHAR(255) PRIMARY KEY,
    customer_id VARCHAR(255),
    status VARCHAR(50),
    total_amount VARCHAR(50),
    currency_code VARCHAR(10),
    occurred_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'info',
    event_key VARCHAR(255) UNIQUE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Indexes
  `CREATE INDEX IF NOT EXISTS idx_datasets_user_id ON datasets(user_id)`,
  `DROP INDEX IF EXISTS idx_subscriptions_paddle_sub_id`,
  `DO $$
   BEGIN
     IF EXISTS (
       SELECT 1
       FROM pg_index i
       JOIN pg_class c ON c.oid = i.indexrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relname = 'idx_subscriptions_paddle_sub_unique'
         AND i.indpred IS NOT NULL
     ) THEN
       DROP INDEX public.idx_subscriptions_paddle_sub_unique;
     END IF;
   END
   $$`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_paddle_sub_unique ON subscriptions(paddle_subscription_id)`,
  `CREATE INDEX IF NOT EXISTS idx_subscriptions_paddle_customer_id ON subscriptions(paddle_customer_id)`,
  `CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email)`,
  `CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_datasets_status ON datasets(status)`,
  `CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id)`,
  `CREATE INDEX IF NOT EXISTS idx_analysis_results_dataset_id ON analysis_results(dataset_id)`,
  `CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_usage_user_id ON usage_tracking(user_id)`,
];

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🗄️  Running database migrations...');
    await client.query('BEGIN');
    for (const sql of migrations) {
      await client.query(sql);
    }
    await client.query('COMMIT');
    console.log('✅ Migrations complete');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => {
  console.error(err);
  process.exit(1);
});
