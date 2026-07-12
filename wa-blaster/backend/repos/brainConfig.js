const db = require('../db');

const DEFAULTS = { persona_name: 'Zia', ai_model: 'claude-sonnet-4-6' };

async function getByDeviceId(deviceId) {
  const [rows] = await db.query('SELECT * FROM bot_brain_config WHERE device_id = ? LIMIT 1', [deviceId]);
  return rows[0] || null;
}

async function ensureForDevice(deviceId) {
  const existing = await getByDeviceId(deviceId);
  if (existing) return existing;
  await db.query(
    'INSERT INTO bot_brain_config (device_id, persona_name, ai_model) VALUES (?, ?, ?)',
    [deviceId, DEFAULTS.persona_name, DEFAULTS.ai_model]
  );
  return getByDeviceId(deviceId);
}

async function update(deviceId, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return ensureForDevice(deviceId);
  await ensureForDevice(deviceId);
  const sets = keys.map(k => `${k} = ?`).join(', ');
  const values = [...keys.map(k => fields[k]), deviceId];
  await db.query(`UPDATE bot_brain_config SET ${sets} WHERE device_id = ?`, values);
  return getByDeviceId(deviceId);
}

module.exports = { getByDeviceId, ensureForDevice, update };
