const db = require('../db');

async function getForDevice(deviceId) {
  const [rows] = await db.query('SELECT * FROM sales WHERE device_id = ? ORDER BY created_at DESC', [deviceId]);
  return rows;
}

async function create(deviceId, { id, telefon, nama, amount, notes }) {
  await db.query(
    'INSERT INTO sales (id, device_id, telefon, nama, amount, notes) VALUES (?, ?, ?, ?, ?, ?)',
    [id, deviceId, telefon, nama, amount, notes || null]
  );
}

async function remove(id) {
  await db.query('DELETE FROM sales WHERE id = ?', [id]);
}

module.exports = { getForDevice, create, remove };
