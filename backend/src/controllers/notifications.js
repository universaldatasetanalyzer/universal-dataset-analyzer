const { query } = require('../db');

async function listNotifications(req, res, next) {
  try {
    const result = await query(
      `SELECT id, title, message, type, (read_at IS NOT NULL) AS read, created_at AS "createdAt"
       FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );
    res.json({ notifications: result.rows });
  } catch (err) { next(err); }
}

async function markRead(req, res, next) {
  try {
    await query('UPDATE notifications SET read_at = COALESCE(read_at, NOW()) WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

async function markAllRead(req, res, next) {
  try {
    await query('UPDATE notifications SET read_at = COALESCE(read_at, NOW()) WHERE user_id = $1', [req.user.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

module.exports = { listNotifications, markRead, markAllRead };