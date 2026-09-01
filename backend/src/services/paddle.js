const { Paddle, Environment } = require('@paddle/paddle-node-sdk');

if (!process.env.PADDLE_ENVIRONMENT) throw new Error('PADDLE_ENVIRONMENT is required');
if (!['sandbox', 'production'].includes(process.env.PADDLE_ENVIRONMENT)) {
  throw new Error('PADDLE_ENVIRONMENT must be sandbox or production');
}

const paddle = new Paddle(process.env.PADDLE_API_KEY, {
  environment: process.env.PADDLE_ENVIRONMENT === 'production' ? Environment.production : Environment.sandbox,
});

/**
 * Verifies the `Paddle-Signature` header against the raw request body and
 * returns the parsed event. Throws if the signature is invalid/missing.
 * NOTE: requires the true raw (unparsed) request body — see index.js where
 * the /api/billing/webhook route is mounted with express.raw() BEFORE the
 * global express.json() middleware.
 */
async function verifyAndParseWebhook(rawBody, signature) {
  if (!rawBody || typeof rawBody !== 'string') throw new Error('Webhook body must be raw text');
  const secret = process.env.PADDLE_NOTIFICATION_SIGNING_SECRET;
  if (!secret) throw new Error('PADDLE_NOTIFICATION_SIGNING_SECRET is not configured');
  if (!signature) throw new Error('Missing Paddle-Signature header');
  return paddle.webhooks.unmarshal(rawBody, secret, signature);
}

async function cancelSubscription(paddleSubscriptionId) {
  return paddle.subscriptions.cancel(paddleSubscriptionId, {
    effectiveFrom: 'next_billing_period',
  });
}

async function createCustomerPortalSession(customerId, subscriptionIds) {
  return paddle.customerPortalSessions.create(customerId, subscriptionIds);
}

module.exports = { paddle, verifyAndParseWebhook, cancelSubscription, createCustomerPortalSession };
