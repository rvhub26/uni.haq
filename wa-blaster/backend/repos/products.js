const db = require('../db');

async function getByDeviceId(deviceId) {
  const [rows] = await db.query('SELECT * FROM products WHERE device_id = ? LIMIT 1', [deviceId]);
  return rows[0] || null;
}

async function getById(id) {
  const [rows] = await db.query('SELECT * FROM products WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function upsertForDevice(deviceId, fields) {
  const existing = await getByDeviceId(deviceId);
  if (existing) {
    const keys = Object.keys(fields);
    if (!keys.length) return existing;
    const sets = keys.map(k => `${k} = ?`).join(', ');
    const values = [...keys.map(k => fields[k]), deviceId];
    await db.query(`UPDATE products SET ${sets} WHERE device_id = ?`, values);
    return getByDeviceId(deviceId);
  }
  const keys = Object.keys(fields);
  const cols = ['device_id', ...keys].join(', ');
  const placeholders = ['?', ...keys.map(() => '?')].join(', ');
  const values = [deviceId, ...keys.map(k => fields[k])];
  await db.query(`INSERT INTO products (${cols}) VALUES (${placeholders})`, values);
  return getByDeviceId(deviceId);
}

module.exports = { getByDeviceId, getById, upsertForDevice };
