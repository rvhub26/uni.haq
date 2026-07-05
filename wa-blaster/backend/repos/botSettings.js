const db = require('../db');

const DEFAULTS = { ai_brain_enabled: 0, bot_sleep_start: '00:00:00', bot_sleep_end: '07:00:00' };

async function getByDeviceId(deviceId) {
  const [rows] = await db.query('SELECT * FROM bot_settings WHERE device_id = ? LIMIT 1', [deviceId]);
  return rows[0] || null;
}

async function ensureForDevice(deviceId) {
  const existing = await getByDeviceId(deviceId);
  if (existing) return existing;
  await db.query(
    `INSERT INTO bot_settings (device_id, ai_brain_enabled, bot_sleep_start, bot_sleep_end)
     VALUES (?, ?, ?, ?)`,
    [deviceId, DEFAULTS.ai_brain_enabled, DEFAULTS.bot_sleep_start, DEFAULTS.bot_sleep_end]
  );
  return getByDeviceId(deviceId);
}

async function update(deviceId, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return getByDeviceId(deviceId);
  await ensureForDevice(deviceId);
  const sets = keys.map(k => `${k} = ?`).join(', ');
  const values = [...keys.map(k => fields[k]), deviceId];
  await db.query(`UPDATE bot_settings SET ${sets} WHERE device_id = ?`, values);
  return getByDeviceId(deviceId);
}

module.exports = { getByDeviceId, ensureForDevice, update };
