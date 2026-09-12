const { Paddle, Environment } = require('@paddle/paddle-node-sdk');
const fetch = require('node-fetch');

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

async function createCheckoutTransaction({ priceId, userId, email }) {
  const apiBase = process.env.PADDLE_ENVIRONMENT === 'production'
    ? 'https://api.paddle.com'
    : 'https://sandbox-api.paddle.com';
  const response = await fetch(`${apiBase}/transactions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.PADDLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      items: [{ price_id: priceId, quantity: 1 }],
      custom_data: { userId, email },
    }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.data?.id) {
    throw new Error(payload.error?.detail || 'Paddle checkout transaction could not be created');
  }
  return payload.data;
}

async function createCustomerPortalSession(customerId, subscriptionIds) {
  return paddle.customerPortalSessions.create(customerId, subscriptionIds);
}

module.exports = { paddle, verifyAndParseWebhook, cancelSubscription, createCheckoutTransaction, createCustomerPortalSession };
