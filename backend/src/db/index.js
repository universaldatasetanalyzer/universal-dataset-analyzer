const { Pool } = require('pg');

const databaseUrl = process.env.DATABASE_URL || process.env.DATABASE_URL_POOLED;
const databaseInfo = databaseUrl
  ? (() => {
      const url = new URL(databaseUrl);
      return {
        host: url.hostname,
        port: url.port || '5432',
        database: url.pathname.replace(/^\//, ''),
      };
    })()
  : {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || '5432',
      database: process.env.DB_NAME || 'uda_db',
    };
const poolConfig = databaseUrl
  ? {
      connectionString: databaseUrl,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'uda_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
    };

const pool = new Pool({
  ...poolConfig,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle DB client', err);
});

async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development' && duration > 1000) {
      console.warn('Slow query detected', { text, duration });
    }
    return res;
  } catch (err) {
    console.error('Database query error:', err.message);
    throw err;
  }
}

async function getClient() {
  const client = await pool.connect();
  const release = client.release;
  client.release = () => {
    client.release = release;
    return client.release();
  };
  return client;
}

module.exports = { query, getClient, pool, databaseInfo };
