const { query } = require('../db');
const paddleService = require('../services/paddle');
const { getUserPlan } = require('../services/plan');
const { routePaddleEvent } = require('../services/paddleWebhookHandlers');

const PRO_PRICE = {
  monthly: { priceId: process.env.PADDLE_PRICE_MONTHLY, price: 10, interval: 'month' },
  yearly: { priceId: process.env.PADDLE_PRICE_YEARLY, price: 96, interval: 'year' },
};

const PLAN_DETAILS = {
  free: { name: 'Free (Demo)', price: 0, datasets: 0, rows: 0, aiInsights: true, reports: false },
  pro: { name: 'Pro', price: null, datasets: -1, rows: -1, aiInsights: true, reports: true },
};

async function getBilling(req, res, next) {
  try {
    const subResult = await query(
      `SELECT s.*, o.name as org_name
       FROM subscriptions s
       LEFT JOIN organizations o ON o.id = s.org_id
       WHERE s.user_id = $1 ORDER BY s.updated_at DESC NULLS LAST, s.created_at DESC LIMIT 1`,
      [req.user.id]
    );

    const subscription = subResult.rows[0] || { plan: 'free', status: 'active' };
    const plan = await getUserPlan(req.user.id);
    const datasetCount = await query(
      'SELECT COUNT(*) as count FROM datasets WHERE user_id = $1 AND is_demo = false',
      [req.user.id]
    );

    res.json({
      subscription: {
        plan,
        status: subscription.status,
        interval: subscription.billing_interval || null,
        currentPeriodEnd: subscription.current_period_end,
        planDetails: {
          ...PLAN_DETAILS[plan],
          price: plan === 'pro'
            ? (subscription.billing_interval === 'year' ? PRO_PRICE.yearly.price : PRO_PRICE.monthly.price)
            : 0,
        },
      },
      usage: {
        datasets: parseInt(datasetCount.rows[0].count),
        datasetsLimit: plan === 'pro' ? -1 : 0,
      },
      pricing: PRO_PRICE,
    });
  } catch (err) {
    next(err);
  }
}

async function getCheckoutConfig(req, res, next) {
  try {
    const headerCountry = req.headers['x-vercel-ip-country'] || req.headers['cf-ipcountry'] || req.headers['x-country-code'];
    const countryCode = typeof headerCountry === 'string' && /^[A-Za-z]{2}$/.test(headerCountry)
      ? headerCountry.toUpperCase()
      : undefined;
    res.json({ countryCode });
  } catch (err) {
    next(err);
  }
}

async function paddleWebhook(req, res) {
  try {
    const signature = req.headers['paddle-signature'];
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : req.body;
    if (typeof rawBody !== 'string') throw new Error('Webhook body must be raw text');
    const event = await paddleService.verifyAndParseWebhook(rawBody, signature);
    await routePaddleEvent(event);
    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Paddle webhook error:', err.message);
    res.status(400).json({ error: 'Webhook verification failed' });
  }
}

async function cancelSubscription(req, res, next) {
  try {
    const subResult = await query(
      `SELECT paddle_subscription_id FROM subscriptions
       WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [req.user.id]
    );
    const paddleSubId = subResult.rows[0]?.paddle_subscription_id;
    if (!paddleSubId) {
      return res.status(400).json({ error: 'No active Paddle subscription found for this account.' });
    }
    await paddleService.cancelSubscription(paddleSubId);
    res.json({ message: 'Your subscription will be canceled at the end of the current billing period.' });
  } catch (err) {
    next(err);
  }
}

async function changePlan(req, res, next) {
  try {
    const { plan } = req.body;
    if (!['free', 'pro'].includes(plan)) {
      return res.status(400).json({ error: 'Plan must be free or pro' });
    }

    const orgResult = await query(
      `SELECT o.id
       FROM organizations o
       JOIN org_members om ON om.org_id = o.id
       WHERE om.user_id = $1 AND om.role IN ('owner', 'admin')
       LIMIT 1`,
      [req.user.id]
    );

    if (orgResult.rows.length === 0) {
      return res.status(403).json({ error: 'You must be an owner or admin to change the plan' });
    }

    const orgId = orgResult.rows[0].id;
    const currentPlan = await getUserPlan(req.user.id);

    await query(
      `INSERT INTO subscriptions (user_id, org_id, plan, status, updated_at)
       VALUES ($1, $2, $3, 'active', NOW())
       ON CONFLICT (user_id, org_id) DO UPDATE
       SET plan = EXCLUDED.plan,
           status = 'active',
           updated_at = NOW()`,
      [req.user.id, orgId, plan]
    );

    res.json({
      message: `Plan updated from ${currentPlan} to ${plan}`,
      plan,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getBilling, getCheckoutConfig, paddleWebhook, cancelSubscription, changePlan };
