const express = require('express');
const router  = express.Router();
const { authenticate, optionalAuth } = require('../middleware/auth');
const upload  = require('../middleware/upload');
const rateLimits = require('../middleware/rateLimits');
const { requirePaidPlan } = require('../middleware/billing');
const { query } = require('../db');

// ── Role check helper ─────────────────────────────────────────────────────────
async function getUserRole(userId) {
  // owner في الـ org بتاعته
  const own = await query(
    `SELECT om.role FROM org_members om
     JOIN organizations o ON o.id = om.org_id
     WHERE om.user_id = $1 AND o.owner_id = $1 AND om.status = 'active' LIMIT 1`,
    [userId]
  );
  if (own.rows.length > 0) return own.rows[0].role;

  // member في org تانية
  const member = await query(
    `SELECT om.role FROM org_members om
     WHERE om.user_id = $1 AND om.status = 'active'
     ORDER BY CASE om.role WHEN 'admin' THEN 1 WHEN 'analyst' THEN 2 ELSE 3 END LIMIT 1`,
    [userId]
  );
  return member.rows[0]?.role || 'viewer';
}

function requirePermission(permKey) {
  const PERMS = {
    owner:   ['upload','delete','view','clean','reports','billing','team'],
    admin:   ['upload','delete','view','clean','reports','team'],
    analyst: ['upload','view','clean','reports'],
    viewer:  ['view'],
  };
  return async (req, res, next) => {
    try {
      const role    = await getUserRole(req.user.id);
      const allowed = PERMS[role] || PERMS.viewer;
      if (!allowed.includes(permKey)) {
        return res.status(403).json({ error: `Your role (${role}) doesn't have permission for this action.` });
      }
      req.userRole = role;
      next();
    } catch (err) { next(err); }
  };
}

// ── Auth ──────────────────────────────────────────────────────────────────────
const auth = require('../controllers/auth');
router.post('/auth/register',       auth.register);
router.post('/auth/login',          auth.login);
router.get('/auth/me',              authenticate, auth.me);
router.post('/auth/verify-email',   auth.verifyEmail);
router.post('/auth/resend-verification', auth.resendVerification);
router.post('/auth/forgot-password', rateLimits.passwordReset, auth.forgotPassword);
router.get('/auth/google',          auth.googleAuth);
router.get('/auth/google/callback', auth.googleCallback);
router.post('/auth/reset-password', rateLimits.passwordReset, auth.resetPassword);

// ── Datasets ──────────────────────────────────────────────────────────────────
const datasets = require('../controllers/datasets');
router.get('/datasets',                       authenticate, datasets.getDatasets);
router.post('/datasets/upload',               authenticate, requirePaidPlan, rateLimits.uploads, requirePermission('upload'), upload.single('file'), datasets.uploadDataset);
router.get('/datasets/:id',                   authenticate, datasets.getDataset);
router.delete('/datasets/:id',                authenticate, requirePermission('delete'), datasets.deleteDataset);
router.get('/datasets/:id/summary',           authenticate, datasets.getSummary);
router.get('/datasets/:id/quality',           authenticate, datasets.getQuality);
router.get('/datasets/:id/visualization',     authenticate, datasets.getVisualization);
router.get('/datasets/:id/download-clean',    authenticate, datasets.downloadClean);

// ── Cleaning ──────────────────────────────────────────────────────────────────
const cleaning = require('../controllers/cleaning');
router.post('/datasets/:id/clean/preview',    authenticate, requirePermission('clean'), cleaning.previewClean);
router.post('/datasets/:id/clean/apply',      authenticate, requirePermission('clean'), cleaning.applyClean);

// ── Chat ──────────────────────────────────────────────────────────────────────
const chat = require('../controllers/chat');
router.get('/chat/sessions',                  authenticate, chat.getSessions);
router.post('/chat/sessions',                 authenticate, chat.createSession);
router.get('/chat/sessions/:id',              authenticate, chat.getSession);
router.post('/chat/sessions/:id/messages',    authenticate, rateLimits.chat, chat.sendMessage);
router.delete('/chat/sessions/:id',           authenticate, chat.deleteSession);

// ── Insights ──────────────────────────────────────────────────────────────────
const insights = require('../controllers/insights');
router.get('/insights/:datasetId',            authenticate, insights.getInsights);
router.post('/insights/:datasetId/regenerate', authenticate, rateLimits.insights, insights.regenerateInsights);

// ── Notifications ────────────────────────────────────────────────────────────
const notifications = require('../controllers/notifications');
router.get('/notifications',                 authenticate, notifications.listNotifications);
router.patch('/notifications/:id/read',      authenticate, notifications.markRead);
router.patch('/notifications/read-all',      authenticate, notifications.markAllRead);

// ── Reports ───────────────────────────────────────────────────────────────────
const reports = require('../controllers/reports');
router.get('/reports',                        authenticate, reports.getReports);
router.post('/reports',                       authenticate, requirePaidPlan, rateLimits.reports, requirePermission('reports'), reports.generateReport);
router.get('/reports/:id/download',           authenticate, reports.downloadReport);
router.delete('/reports/:id',                 authenticate, requirePermission('delete'), reports.deleteReport);

// ── Team ──────────────────────────────────────────────────────────────────────
const team = require('../controllers/team');
router.get('/team',                           authenticate, team.getTeam);
router.post('/team/invite',                   authenticate, rateLimits.invites, requirePermission('team'), team.inviteMember);
router.get('/team/invite/:token',             optionalAuth, team.acceptInvite);
router.patch('/team/members/:memberId',       authenticate, requirePermission('team'), team.updateMember);
router.delete('/team/members/:memberId',      authenticate, requirePermission('team'), team.removeMember);

// ── Billing ───────────────────────────────────────────────────────────────────
const billing = require('../controllers/billing');
const portal = require('../controllers/portal');
router.get('/billing',                        authenticate, requirePermission('billing'), billing.getBilling);
router.get('/billing/checkout-config',       authenticate, billing.getCheckoutConfig);
router.post('/billing/create-checkout-session', authenticate, rateLimits.checkout, billing.createCheckoutSession);
router.post('/billing/change-plan',           authenticate, requirePermission('billing'), billing.changePlan);
router.post('/billing/cancel',                authenticate, billing.cancelSubscription);
router.post('/billing/portal-session',        authenticate, portal.createPortalSession);

// ── Settings ──────────────────────────────────────────────────────────────────
const settings = require('../controllers/settings');
router.get('/settings',                       authenticate, settings.getSettings);
router.patch('/settings/profile',             authenticate, settings.updateProfile);
router.post('/settings/change-password',      authenticate, settings.changePassword);
router.delete('/settings/account',            authenticate, settings.deleteAccount);

// ── Dashboard Stats ───────────────────────────────────────────────────────────
router.get('/dashboard/stats', authenticate, async (req, res, next) => {
  try {
    const [datasetsCount, reportsCount, chatCount] = await Promise.all([
      query('SELECT COUNT(*) as count, AVG(health_score) as avg_health FROM datasets WHERE user_id = $1', [req.user.id]),
      query('SELECT COUNT(*) as count FROM reports WHERE user_id = $1', [req.user.id]),
      query('SELECT COUNT(*) as count FROM chat_sessions WHERE user_id = $1', [req.user.id]),
    ]);
    res.json({
      totalDatasets:    parseInt(datasetsCount.rows[0].count),
      avgHealthScore:   Math.round(parseFloat(datasetsCount.rows[0].avg_health) || 0),
      reportsGenerated: parseInt(reportsCount.rows[0].count),
      chatSessions:     parseInt(chatCount.rows[0].count),
    });
  } catch (err) { next(err); }
});

// ── Admin ──────────────────────────────────────────────────────────────────────
// ── Admin ──────────────────────────────────────────────────────────────────────
const admin = require('../controllers/admin');
router.get('/admin/stats',                        authenticate, admin.checkAdminPageAuth, admin.requireAdmin, admin.getStats);
router.get('/admin/users',                        authenticate, admin.checkAdminPageAuth, admin.requireAdmin, admin.getUsers);
router.patch('/admin/users/:userId/plan',         authenticate, admin.checkAdminPageAuth, admin.requireAdmin, admin.setUserPlan);
router.patch('/admin/users/:userId/toggle-admin', authenticate, admin.checkAdminPageAuth, admin.requireAdmin, admin.toggleAdmin);
router.delete('/admin/users/:userId',             authenticate, admin.checkAdminPageAuth, admin.requireAdmin, admin.deleteUser);

module.exports = router;