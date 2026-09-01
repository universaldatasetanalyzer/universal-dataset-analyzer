const { query } = require('../db');
const bcrypt    = require('bcryptjs');

// ── Admin Page Credentials ────────────────────────────────────────────────────
const ADMIN_PAGE_USER = process.env.ADMIN_PAGE_USER;
const ADMIN_PAGE_PASS = process.env.ADMIN_PAGE_PASS;

function decodeAdminHeader(authHeader) {
  if (!authHeader || typeof authHeader !== 'string') {
    return null;
  }

  const decoded = Buffer.from(authHeader, 'base64').toString('utf8');
  const [user, pass] = decoded.split(':');

  if (!user || !pass) {
    return null;
  }

  return { user, pass };
}

function validateAdminCredentials(authHeader) {
  if (!ADMIN_PAGE_USER || !ADMIN_PAGE_PASS) {
    return { ok: false, reason: 'missing-config' };
  }

  const decoded = decodeAdminHeader(authHeader);
  if (!decoded) {
    return { ok: false, reason: 'invalid-format' };
  }

  const isValid = decoded.user === ADMIN_PAGE_USER && decoded.pass === ADMIN_PAGE_PASS;
  return { ok: isValid, reason: isValid ? 'ok' : 'mismatch' };
}

async function checkAdminPageAuth(req, res, next) {
  const authHeader = req.headers['x-admin-auth'];

  if (!authHeader) {
    return res.status(401).json({ error: 'Admin credentials required (x-admin-auth header missing)' });
  }

  if (!ADMIN_PAGE_USER || !ADMIN_PAGE_PASS) {
    return res.status(500).json({ error: 'Admin credentials are not configured on the server' });
  }

  const result = validateAdminCredentials(authHeader);
  if (!result.ok) {
    return res.status(401).json({ error: 'Invalid admin username or password' });
  }

  next();
}

// ── Middleware: admin only ────────────────────────────────────────────────────
async function requireAdmin(req, res, next) {
  try {
    console.log('\n--- [REQUIRE ADMIN DB CHECK] ---');
    console.log('Checking is_admin in DB for user ID:', req.user?.id, `(${req.user?.email})`);

    const result = await query('SELECT id, email, is_admin FROM users WHERE id = $1', [req.user?.id]);
    const user = result.rows[0];

    console.log('DB query result:', user);

    if (!user?.is_admin) {
      console.warn(`[Require Admin] FAILED: User "${req.user?.email}" has is_admin=${user?.is_admin || false}`);
      return res.status(403).json({
        error: `Admin access required: User "${req.user?.email}" is not marked as is_admin=true in the database.`
      });
    }

    console.log('[Require Admin] SUCCESS: User is an admin in DB');
    next();
  } catch (err) {
    console.error('[Require Admin] Error in DB query:', err.message);
    next(err);
  }
}

// ── Get all users ─────────────────────────────────────────────────────────────
async function getUsers(req, res, next) {
  try {
    const result = await query(
      `SELECT u.id, u.name, u.email, u.role, u.is_admin, u.created_at,
              s.plan, s.status as sub_status,
              COUNT(DISTINCT d.id) as dataset_count
       FROM users u
       LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
       LEFT JOIN datasets d ON d.user_id = u.id
       GROUP BY u.id, u.name, u.email, u.role, u.is_admin, u.created_at, s.plan, s.status
       ORDER BY u.created_at DESC`,
      []
    );
    res.json({ users: result.rows });
  } catch (err) { next(err); }
}

// ── Get stats ─────────────────────────────────────────────────────────────────
async function getStats(req, res, next) {
  try {
    const [users, datasets, proUsers, recentUsers] = await Promise.all([
      query('SELECT COUNT(*) as count FROM users'),
      query('SELECT COUNT(*) as count FROM datasets'),
      query(`SELECT COUNT(*) as count FROM subscriptions WHERE plan = 'pro' AND status = 'active'`),
      query(`SELECT COUNT(*) as count FROM users WHERE created_at > NOW() - INTERVAL '7 days'`),
    ]);
    res.json({
      totalUsers:    parseInt(users.rows[0].count),
      totalDatasets: parseInt(datasets.rows[0].count),
      proUsers:      parseInt(proUsers.rows[0].count),
      newUsersWeek:  parseInt(recentUsers.rows[0].count),
    });
  } catch (err) { next(err); }
}

// ── Set user plan ─────────────────────────────────────────────────────────────
async function setUserPlan(req, res, next) {
  try {
    const { userId } = req.params;
    const { plan }   = req.body;

    if (!['free', 'pro'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan. Must be free or pro' });
    }

    // 1. تحقق إن المستخدم موجود
    const userResult = await query('SELECT id, name, email FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    // 2. حساب تاريخ الانتهاء مباشرة في JS لتفادي أخطاء الـ SQL types
    const currentPeriodEnd = plan === 'pro'
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // سنة من الآن
      : null;

    // 3. جيب الـ org بتاعة المستخدم
    const orgResult = await query(
      `SELECT id FROM organizations WHERE owner_id = $1 LIMIT 1`,
      [userId]
    );
    let orgId = orgResult.rows[0]?.id;

    if (orgId) {
      const existingSub = await query(
        `SELECT id FROM subscriptions WHERE user_id = $1 AND org_id = $2 LIMIT 1`,
        [userId, orgId]
      );

      if (existingSub.rows.length > 0) {
        await query(
          `UPDATE subscriptions 
           SET plan = $1, 
               status = 'active', 
               current_period_end = $2,
               updated_at = NOW() 
           WHERE user_id = $3 AND org_id = $4`,
          [plan, currentPeriodEnd, userId, orgId]
        );
      } else {
        await query(
          `INSERT INTO subscriptions (user_id, org_id, plan, status, current_period_end) 
           VALUES ($1, $2, $3, 'active', $4)`,
          [userId, orgId, plan, currentPeriodEnd]
        );
      }
    } else {
      const slug = 'ws-' + userId.slice(0, 8) + '-' + Date.now().toString(36);
      const newOrg = await query(
        `INSERT INTO organizations (name, slug, owner_id, plan) VALUES ($1, $2, $3, $4) RETURNING id`,
        [userResult.rows[0].name + "'s Workspace", slug, userId, plan]
      );
      orgId = newOrg.rows[0].id;

      await query(
        `INSERT INTO subscriptions (user_id, org_id, plan, status, current_period_end) 
         VALUES ($1, $2, $3, 'active', $4)`,
        [userId, orgId, plan, currentPeriodEnd]
      );
    }

    // 4. تحديث خطة الـ organization
    await query(
      `UPDATE organizations SET plan = $1, updated_at = NOW() WHERE owner_id = $2`,
      [plan, userId]
    );

    res.json({
      message: `Plan updated to ${plan} for ${userResult.rows[0].name}`,
      user:    { ...userResult.rows[0], plan },
    });
  } catch (err) { next(err); }
}

// ── Delete user ───────────────────────────────────────────────────────────────
async function deleteUser(req, res, next) {
  try {
    const { userId } = req.params;
    if (userId === req.user.id) return res.status(400).json({ error: 'Cannot delete your own account' });

    await query('DELETE FROM users WHERE id = $1', [userId]);
    res.json({ message: 'User deleted successfully' });
  } catch (err) { next(err); }
}

// ── Toggle admin ──────────────────────────────────────────────────────────────
async function toggleAdmin(req, res, next) {
  try {
    const { userId } = req.params;
    if (userId === req.user.id) return res.status(400).json({ error: 'Cannot modify your own admin status' });

    const result = await query(
      'UPDATE users SET is_admin = NOT is_admin WHERE id = $1 RETURNING is_admin, name',
      [userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    res.json({ message: `${result.rows[0].name} is now ${result.rows[0].is_admin ? 'an admin' : 'a regular user'}` });
  } catch (err) { next(err); }
}

module.exports = { checkAdminPageAuth, requireAdmin, getUsers, getStats, setUserPlan, deleteUser, toggleAdmin };