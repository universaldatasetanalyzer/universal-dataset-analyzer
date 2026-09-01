const { query } = require('../db');

async function createNotification({ userId, title, message, type = 'info', eventKey = null }) {
  if (!userId) return;
  await query(
    `INSERT INTO notifications (user_id, title, message, type, event_key)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (event_key) DO NOTHING`,
    [userId, title, message, type, eventKey]
  );
}

module.exports = { createNotification };