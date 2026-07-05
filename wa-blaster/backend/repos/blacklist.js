const db = require('../db');

async function getForDevice(deviceId) {
  const [rows] = await db.query('SELECT * FROM blacklist WHERE device_id = ? ORDER BY added_at DESC', [deviceId]);
  return rows;
}

async function getPhoneSet(deviceId) {
  const rows = await getForDevice(deviceId);
  return new Set(rows.map(r => r.telefon));
}

async function add(deviceId, { telefon, nama = null, sebab = null }) {
  await db.query(
    `INSERT INTO blacklist (device_id, telefon, nama, sebab) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE nama = VALUES(nama), sebab = VALUES(sebab)`,
    [deviceId, telefon, nama, sebab]
  );
}

async function remove(deviceId, telefon) {
  await db.query('DELETE FROM blacklist WHERE device_id = ? AND telefon = ?', [deviceId, telefon]);
}

module.exports = { getForDevice, getPhoneSet, add, remove };
