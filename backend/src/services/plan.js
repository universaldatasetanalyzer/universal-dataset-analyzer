const { query } = require('../db');

/**
 * Returns the user's current effective plan: 'free' or 'pro'.
 * A user is only 'pro' if their latest subscription row says plan='pro'
 * AND its status is active/trialing (Paddle keeps status in sync via webhooks).
 */
async function getUserPlan(userId) {
  try {
    const r = await query(
      `SELECT plan, status FROM subscriptions WHERE user_id = $1 ORDER BY updated_at DESC NULLS LAST, created_at DESC LIMIT 1`,
      [userId]
    );
    const sub = r.rows[0];
    if (!sub) return 'free';
    const activeStatuses = ['active', 'trialing'];
    if (sub.plan === 'pro' && activeStatuses.includes(sub.status)) return 'pro';
    return 'free';
  } catch {
    return 'free';
  }
}

function isPaidPlan(plan) {
  return plan === 'pro';
}

module.exports = { getUserPlan, isPaidPlan };
