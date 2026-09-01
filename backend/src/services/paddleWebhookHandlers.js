const { query } = require('../db');
const { createNotification } = require('./notifications');

function eventDate(event) {
  const value = event.occurredAt || event.occurred_at;
  return value ? new Date(value).toISOString() : null;
}

function customerEmail(data) {
  return data.email || data.contact?.email || data.customer?.email || null;
}

async function upsertCustomer(data, occurredAt) {
  if (!data.id || !customerEmail(data)) return;
  await query(
    `INSERT INTO customers (customer_id, email, last_event_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (customer_id) DO UPDATE SET
       email = EXCLUDED.email,
       last_event_at = COALESCE(EXCLUDED.last_event_at, customers.last_event_at),
       updated_at = NOW()
     WHERE customers.last_event_at IS NULL
        OR EXCLUDED.last_event_at IS NULL
        OR EXCLUDED.last_event_at >= customers.last_event_at`,
    [data.id, customerEmail(data), occurredAt]
  );
}

async function resolveUserId(data) {
  const customUserId = data.customData?.userId || data.custom_data?.userId;
  if (customUserId) {
    const result = await query('SELECT id FROM users WHERE id = $1', [customUserId]);
    if (result.rows[0]) return result.rows[0].id;
  }

  if (data.customerId) {
    const result = await query(
      `SELECT u.id FROM users u
       JOIN customers c ON LOWER(c.email) = LOWER(u.email)
       WHERE c.customer_id = $1 LIMIT 1`,
      [data.customerId]
    );
    if (result.rows[0]) return result.rows[0].id;
  }

  return null;
}

function subscriptionStatus(data) {
  return data.status || 'unknown';
}

function subscriptionPlan(status) {
  return ['active', 'trialing'].includes(status) ? 'pro' : 'free';
}

async function upsertSubscription(event) {
  const data = event.data || {};
  if (!data.id) return;

  const occurredAt = eventDate(event);
  const customerId = data.customerId || data.customer_id || null;
  const userId = await resolveUserId({ ...data, customerId });
  const organization = userId
    ? await query('SELECT id FROM organizations WHERE owner_id = $1 LIMIT 1', [userId])
    : { rows: [] };
  const item = data.items?.[0] || {};
  const price = item.price || {};
  const billingCycle = price.billingCycle || price.billing_cycle || {};
  const scheduledChange = data.scheduledChange || data.scheduled_change || {};
  const status = subscriptionStatus(data);
  const plan = subscriptionPlan(status);
  const billingPeriod = data.currentBillingPeriod || data.current_billing_period || {};

  await query(
    `INSERT INTO subscriptions (
       user_id, org_id, plan, status, current_period_start, current_period_end,
       paddle_subscription_id, paddle_customer_id, paddle_price_id, billing_interval,
       paddle_product_id, scheduled_change_action, scheduled_change_at, paddle_last_event_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     ON CONFLICT (paddle_subscription_id) DO UPDATE SET
       user_id = COALESCE(EXCLUDED.user_id, subscriptions.user_id),
       org_id = COALESCE(EXCLUDED.org_id, subscriptions.org_id),
       plan = EXCLUDED.plan,
       status = EXCLUDED.status,
       current_period_start = EXCLUDED.current_period_start,
       current_period_end = EXCLUDED.current_period_end,
       paddle_customer_id = COALESCE(EXCLUDED.paddle_customer_id, subscriptions.paddle_customer_id),
       paddle_price_id = EXCLUDED.paddle_price_id,
       billing_interval = EXCLUDED.billing_interval,
       paddle_product_id = EXCLUDED.paddle_product_id,
       scheduled_change_action = EXCLUDED.scheduled_change_action,
       scheduled_change_at = EXCLUDED.scheduled_change_at,
       paddle_last_event_at = COALESCE(EXCLUDED.paddle_last_event_at, subscriptions.paddle_last_event_at),
       updated_at = NOW()
     WHERE subscriptions.paddle_last_event_at IS NULL
        OR EXCLUDED.paddle_last_event_at IS NULL
        OR EXCLUDED.paddle_last_event_at >= subscriptions.paddle_last_event_at`,
    [
      userId,
      organization.rows[0]?.id || null,
      plan,
      status,
      billingPeriod.startsAt || billingPeriod.starts_at || null,
      billingPeriod.endsAt || billingPeriod.ends_at || null,
      data.id,
      customerId,
      price.id || null,
      billingCycle.interval || null,
      item.product?.id || item.productId || item.product_id || null,
      scheduledChange.action || null,
      scheduledChange.effectiveAt || scheduledChange.effective_at || null,
      occurredAt,
    ]
  );

  if (userId) {
    await query('UPDATE organizations SET plan = $1, updated_at = NOW() WHERE owner_id = $2', [plan, userId]);
    await createNotification({
      userId,
      title: event.eventType === 'subscription.canceled' ? 'Subscription canceled' : 'Subscription updated',
      message: event.eventType === 'subscription.canceled' ? 'Your Pro access has ended.' : `Your Pro subscription is ${status}.`,
      type: event.eventType === 'subscription.canceled' ? 'warning' : 'success',
      eventKey: `paddle:${event.eventType}:${data.id}:${occurredAt || 'unknown'}`,
    });
  }
}

async function handleCustomer(event) {
  await upsertCustomer(event.data || {}, eventDate(event));
}

async function handleSubscription(event) {
  const data = event.data || {};
  const customerId = data.customerId || data.customer_id;
  if (customerId && customerEmail(data.customer || {})) {
    await upsertCustomer({ id: customerId, email: customerEmail(data.customer) }, eventDate(event));
  }
  await upsertSubscription(event);
}

async function handleTransaction(event) {
  const data = event.data || {};
  const customerId = data.customerId || data.customer_id || null;
  const email = customerEmail(data.customer || {});
  if (customerId && email) await upsertCustomer({ id: customerId, email }, eventDate(event));

  const totals = data.details?.totals || data.details?.totals || {};
  const currencyCode = data.currencyCode || data.currency_code || totals.currencyCode || totals.currency_code || null;
  await query(
    `INSERT INTO paddle_transactions (transaction_id, customer_id, status, total_amount, currency_code, occurred_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (transaction_id) DO UPDATE SET
       customer_id = COALESCE(EXCLUDED.customer_id, paddle_transactions.customer_id),
       status = EXCLUDED.status,
       total_amount = EXCLUDED.total_amount,
       currency_code = EXCLUDED.currency_code,
       occurred_at = COALESCE(EXCLUDED.occurred_at, paddle_transactions.occurred_at),
       updated_at = NOW()`,
    [data.id, customerId, data.status || 'completed', totals.total || null, currencyCode, eventDate(event)]
  );
  const userResult = customerId ? await query(
    `SELECT u.id FROM users u JOIN customers c ON LOWER(c.email) = LOWER(u.email) WHERE c.customer_id = $1 LIMIT 1`,
    [customerId]
  ) : { rows: [] };
  await createNotification({
    userId: userResult.rows[0]?.id,
    title: 'Payment completed',
    message: 'Your Paddle payment was completed successfully. Your Pro access is being activated.',
    type: 'success',
    eventKey: `paddle:transaction.completed:${data.id}`,
  });
}

async function routePaddleEvent(event) {
  switch (event.eventType) {
    case 'customer.created':
    case 'customer.updated':
      return handleCustomer(event);
    case 'subscription.created':
    case 'subscription.updated':
    case 'subscription.canceled':
      return handleSubscription(event);
    case 'transaction.completed':
      return handleTransaction(event);
    default:
      return undefined;
  }
}

module.exports = { routePaddleEvent, handleCustomer, handleSubscription, handleTransaction };
