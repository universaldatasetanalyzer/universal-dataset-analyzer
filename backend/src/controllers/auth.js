const bcrypt     = require('bcryptjs');
const crypto     = require('crypto');
const jwt        = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');
const { v4: uuidv4 }   = require('uuid');
const { query, pool }  = require('../db');
const { analyzeDataset } = require('../services/analysis');
const { getUserPlan }  = require('../services/plan');
const { seedDemoDataset } = require('../services/demoData');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function generateToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function sendResetEmail(email, token, name) {
  const appUrl   = process.env.APP_URL || 'http://localhost:5173';
  const resetUrl = `${appUrl}/reset-password?token=${token}`;
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"Universal Analyzer" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Reset your password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
        <h2 style="color:#6366f1">Reset your password</h2>
        <p>Hi ${name || 'there'},</p>
        <p>Click the button below to reset your password. This link expires in <strong>1 hour</strong>.</p>
        <a href="${resetUrl}" style="display:inline-block;margin:24px 0;padding:12px 28px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Reset Password</a>
        <p style="color:#94a3b8;font-size:13px">If you didn't request this, ignore this email.</p>
      </div>`,
  });
}

// ── Password validation ───────────────────────────────────────────────────────
function validatePassword(password) {
  if (!password || password.length < 8)          return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(password))                   return 'Password must contain at least one uppercase letter';
  if (!/[a-z]/.test(password))                   return 'Password must contain at least one lowercase letter';
  if (!/[0-9]/.test(password))                   return 'Password must contain at least one number';
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return 'Password must contain at least one special character';
  return null;
}

// ── Helper: create org for new user ──────────────────────────────────────────
async function createUserOrg(userId, name, db = { query }) {
  const slug = name.toLowerCase().replace(/\s+/g, '-') + '-' + uuidv4().slice(0, 6);
  const orgResult = await db.query(
    `INSERT INTO organizations (name, slug, owner_id, plan) VALUES ($1, $2, $3, 'free') RETURNING id`,
    [name + "'s Workspace", slug, userId]
  );
  const orgId = orgResult.rows[0].id;
  await db.query(`INSERT INTO org_members (org_id, user_id, role, status) VALUES ($1, $2, 'owner', 'active')`, [orgId, userId]);
  await db.query(`INSERT INTO subscriptions (user_id, org_id, plan, status) VALUES ($1, $2, 'free', 'active')`, [userId, orgId]);
  return orgId;
}

// ── Register ──────────────────────────────────────────────────────────────────
async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });

    const pwError = validatePassword(password);
    if (pwError) return res.status(400).json({ error: pwError });

    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 12);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'owner') RETURNING id, name, email, role`,
        [name, email.toLowerCase(), passwordHash]
      );
      const user = result.rows[0];
      await createUserOrg(user.id, name, client);
      const demo = await seedDemoDataset(user.id, client, { startAnalysis: false, throwOnError: true });
      await client.query('COMMIT');

      if (demo) {
        analyzeDataset(demo.datasetId, demo.filePath, demo.format).catch(err => {
          console.error('Demo dataset analysis failed for dataset', demo.datasetId, err.message);
        });
      }

      const token = generateToken(user.id);
      const plan  = await getUserPlan(user.id);
      res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, plan } });
    } catch (transactionError) {
      await client.query('ROLLBACK');
      throw transactionError;
    } finally {
      client.release();
    }
  } catch (err) { next(err); }
}

// ── Login ─────────────────────────────────────────────────────────────────────
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const result = await query('SELECT id, name, email, role, password_hash FROM users WHERE email = $1', [email.toLowerCase()]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid email or password' });

    const user  = result.rows[0];
    if (!user.password_hash) return res.status(401).json({ error: 'This account uses Google Sign-In. Please sign in with Google.' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const token = generateToken(user.id);
    const plan  = await getUserPlan(user.id);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, plan } });
  } catch (err) { next(err); }
}

// ── Google OAuth ──────────────────────────────────────────────────────────────
async function googleAuth(req, res) {
  const redirectUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${process.env.GOOGLE_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/api/auth/google/callback')}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent('openid email profile')}` +
    `&prompt=select_account` +
    `&access_type=offline`;
  res.redirect(redirectUrl);
}

async function googleCallback(req, res) {
  const appUrl = process.env.APP_URL || 'http://localhost:5173';
  try {
    const { code } = req.query;
    if (!code) return res.redirect(`${appUrl}/login?error=no_code`);

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri:  process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/api/auth/google/callback',
        grant_type:    'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.id_token) {
      const reason = tokenData.error_description || tokenData.error || 'no_token';
      console.error('Google token exchange failed:', reason);
      return res.redirect(`${appUrl}/login?error=${encodeURIComponent(reason)}`);
    }

    // Verify the ID token
    const ticket  = await googleClient.verifyIdToken({ idToken: tokenData.id_token, audience: process.env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    const { email, name, sub: googleId } = payload;

    // جيب أو اعمل المستخدم
    let userResult = await query('SELECT id, name, email, role FROM users WHERE email = $1', [email.toLowerCase()]);
    let user;

    if (userResult.rows.length > 0) {
      user = userResult.rows[0];
      // حدّث الـ google_id لو مش موجود
      await query('UPDATE users SET google_id = $1 WHERE id = $2 AND google_id IS NULL', [googleId, user.id]);
    } else {
      // اعمل user جديد
      const newUser = await query(
        `INSERT INTO users (name, email, google_id, role, password_hash)
         VALUES ($1, $2, $3, 'owner', NULL) RETURNING id, name, email, role`,
        [name, email.toLowerCase(), googleId]
      );
      user = newUser.rows[0];
      await createUserOrg(user.id, name);
      await seedDemoDataset(user.id);
    }

    const token = generateToken(user.id);
    res.redirect(`${appUrl}/auth/google/callback#token=${encodeURIComponent(token)}`);
  } catch (err) {
    console.error('Google OAuth error:', err.message);
    res.redirect(`${appUrl}/login?error=${encodeURIComponent(err.message || 'oauth_failed')}`);
  }
}

// ── Me ────────────────────────────────────────────────────────────────────────
async function me(req, res) {
  const plan = await getUserPlan(req.user.id);
  res.json({ user: { ...req.user, plan } });
}

// ── Forgot / Reset Password ───────────────────────────────────────────────────
async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const result = await query('SELECT id, name FROM users WHERE email = $1', [email.toLowerCase()]);
    if (result.rows.length > 0) {
      const user    = result.rows[0];
      const token   = uuidv4();
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const expires = new Date(Date.now() + 3600000);
      await query('UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3', [tokenHash, expires, user.id]);
      try { await sendResetEmail(email.toLowerCase(), token, user.name); }
      catch (emailErr) { console.error('Failed to send reset email:', emailErr.message); }
    }
    res.json({ message: 'If that email is registered, a reset link has been sent.' });
  } catch (err) { next(err); }
}

async function resetPassword(req, res, next) {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token and password are required' });

    const pwError = validatePassword(password);
    if (pwError) return res.status(400).json({ error: pwError });

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const result = await query('SELECT id FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()', [tokenHash]);
    if (result.rows.length === 0) return res.status(400).json({ error: 'Invalid or expired reset token' });

    const passwordHash = await bcrypt.hash(password, 12);
    await query('UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2', [passwordHash, result.rows[0].id]);
    res.json({ message: 'Password reset successfully' });
  } catch (err) { next(err); }
}

module.exports = { register, login, me, forgotPassword, resetPassword, googleAuth, googleCallback };