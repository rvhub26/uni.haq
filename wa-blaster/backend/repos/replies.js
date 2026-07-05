const db = require('../db');

async function has(deviceId, phone) {
  const [rows] = await db.query('SELECT 1 FROM replies WHERE device_id = ? AND phone_number = ? LIMIT 1', [deviceId, phone]);
  return rows.length > 0;
}

async function record(deviceId, phone, nama, manual = false) {
  await db.query(
    `INSERT IGNORE INTO replies (device_id, phone_number, nama, manual) VALUES (?, ?, ?, ?)`,
    [deviceId, phone, nama, manual ? 1 : 0]
  );
}

async function getForDevice(deviceId) {
  const [rows] = await db.query('SELECT * FROM replies WHERE device_id = ? ORDER BY replied_at DESC', [deviceId]);
  return rows;
}

module.exports = { has, record, getForDevice };
