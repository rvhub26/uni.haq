const db = require('../db');

async function getForUser(userId) {
  const [rows] = await db.query('SELECT * FROM devices WHERE user_id = ? ORDER BY created_at ASC', [userId]);
  return rows;
}

async function getById(deviceId) {
  const [rows] = await db.query('SELECT * FROM devices WHERE id = ? LIMIT 1', [deviceId]);
  return rows[0] || null;
}

async function countForUser(userId) {
  const [rows] = await db.query('SELECT COUNT(*) AS c FROM devices WHERE user_id = ?', [userId]);
  return rows[0].c;
}

async function create({ id, userId, name, type = 'baileys' }) {
  await db.query('INSERT INTO devices (id, user_id, name, type) VALUES (?, ?, ?, ?)', [id, userId, name, type]);
  return getById(id);
}

async function rename(deviceId, name) {
  await db.query('UPDATE devices SET name = ? WHERE id = ?', [name, deviceId]);
  return getById(deviceId);
}

async function remove(deviceId) {
  await db.query('DELETE FROM devices WHERE id = ?', [deviceId]);
}

async function setClosingBotEnabled(deviceId, enabled) {
  await db.query('UPDATE devices SET closing_bot_enabled = ? WHERE id = ?', [enabled ? 1 : 0, deviceId]);
  return getById(deviceId);
}

async function isClosingBotEnabled(deviceId) {
  const device = await getById(deviceId);
  return !!device?.closing_bot_enabled;
}

// Untuk loop cron/reconnect merentas semua user (macam restoreAllJobs/connectAllDevices)
async function getAllWithUser() {
  const [rows] = await db.query(
    `SELECT d.*, u.id AS owner_user_id FROM devices d JOIN users u ON u.id = d.user_id ORDER BY d.created_at ASC`
  );
  return rows;
}

module.exports = {
  getForUser, getById, countForUser, create, rename, remove,
  setClosingBotEnabled, isClosingBotEnabled, getAllWithUser,
};
