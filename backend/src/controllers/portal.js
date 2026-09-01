const { query } = require('../db');
const { createCustomerPortalSession } = require('../services/paddle');

async function createPortalSession(req, res, next) {
  try {
    const result = await query(
      `SELECT c.customer_id,
              ARRAY_REMOVE(ARRAY_AGG(s.paddle_subscription_id), NULL) AS subscription_ids
       FROM users u
       LEFT JOIN customers c ON LOWER(c.email) = LOWER(u.email)
       LEFT JOIN subscriptions s ON s.user_id = u.id OR s.paddle_customer_id = c.customer_id
       WHERE u.id = $1
       GROUP BY c.customer_id`,
      [req.user.id]
    );

    const customer = result.rows[0];
    if (!customer?.customer_id) {
      return res.status(404).json({ error: 'No Paddle customer has been linked to this account yet.' });
    }

    const subscriptionIds = [...new Set(customer.subscription_ids || [])];
    if (subscriptionIds.length === 0) {
      return res.status(404).json({ error: 'No Paddle subscription has been linked to this account yet.' });
    }

    const session = await createCustomerPortalSession(customer.customer_id, subscriptionIds);
    const url = session.urls?.general?.overview;
    if (!url) throw new Error('Paddle returned no customer portal URL');
    res.json({ url });
  } catch (err) {
    next(err);
  }
}

module.exports = { createPortalSession };
