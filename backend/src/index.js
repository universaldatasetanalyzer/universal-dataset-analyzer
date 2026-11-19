require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const routes = require('./routes');
const { errorHandler, notFound } = require('./middleware/errors');
const { paddleWebhook } = require('./controllers/billing');
const { databaseInfo } = require('./db');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;

app.set('trust proxy', 1);
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('x-request-id', req.id);
  next();
});

function parseAllowedOrigins() {
  const configured = [
    process.env.FRONTEND_URL,
    process.env.APP_URL,
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
  ]
    .flatMap(value => typeof value === 'string' ? value.split(',') : [])
    .map(value => value.trim())
    .filter(Boolean);

  return [...new Set(configured)];
}

const allowedOrigins = parseAllowedOrigins();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-auth'],
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  skip: req => req.path.startsWith('/api/notifications'),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  message: { error: 'Too many auth attempts, please try again later.' },
});

app.use(limiter);
app.use('/api/auth', authLimiter);

// Paddle webhook — MUST be registered with a raw body parser and BEFORE
// express.json() below, otherwise Paddle's signature verification fails.
app.post('/api/billing/webhook', express.raw({ type: '*/*' }), paddleWebhook);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// API routes
app.use('/api', routes);

// Error handling
app.use(notFound);
app.use(errorHandler);

// Startup background wake-up for Python microservice on Render (Cold start handling)
async function wakePythonService() {
  const pythonUrl = (process.env.PYTHON_SERVICE_URL || 'https://uda-python-service.onrender.com').replace(/\/+$/, '');
  try {
    console.log(`[PythonService] Initiating startup wake-up call to ${pythonUrl}/docs ...`);
    const res = await fetch(`${pythonUrl}/docs`, {
      method: 'GET',
      signal: AbortSignal.timeout(60000),
    });
    console.log(`[PythonService] Startup wake-up response: ${res.status}`);
  } catch (err) {
    console.warn(`[PythonService] Startup wake-up ping finished/timed out: ${err.message}`);
  }
}

app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️  Database: ${databaseInfo.host}:${databaseInfo.port}/${databaseInfo.database}`);
  
  // Trigger non-blocking wake-up call in background
  wakePythonService();
});

module.exports = app;
