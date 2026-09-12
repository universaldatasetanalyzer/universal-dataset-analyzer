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

async function createCheckoutSession(req, res, next) {
  try {
    const { priceId } = req.body || {};
    const configuredPriceIds = [PRO_PRICE.monthly.priceId, PRO_PRICE.yearly.priceId].filter(Boolean);
    if (!priceId || !configuredPriceIds.includes(priceId)) {
      return res.status(400).json({ error: 'Invalid Paddle price ID' });
    }

    const transaction = await paddleService.createCheckoutTransaction({
      priceId,
      userId: req.user.id,
      email: req.user.email,
    });

    res.json({ transactionId: transaction.id });
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
  res.status(403).json({ error: 'Manual plan changes are disabled. Plans are updated from verified Paddle webhooks.' });
}

module.exports = { getBilling, getCheckoutConfig, createCheckoutSession, paddleWebhook, cancelSubscription, changePlan };
