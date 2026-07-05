const db = require('../db');

async function getForDevice(deviceId) {
  const [rows] = await db.query('SELECT * FROM contacts WHERE device_id = ? ORDER BY created_at ASC', [deviceId]);
  return rows;
}

async function getById(id) {
  const [rows] = await db.query('SELECT * FROM contacts WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function getByPhone(deviceId, telefon) {
  const [rows] = await db.query('SELECT * FROM contacts WHERE device_id = ? AND telefon = ? LIMIT 1', [deviceId, telefon]);
  return rows[0] || null;
}

async function upsertMany(deviceId, contacts) {
  for (const c of contacts) {
    await db.query(
      `INSERT INTO contacts (id, device_id, nama, telefon, kumpulan) VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE nama = VALUES(nama), kumpulan = VALUES(kumpulan)`,
      [c.id, deviceId, c.nama, c.telefon, c.kumpulan || 'Umum']
    );
  }
}

async function create(deviceId, { id, nama, telefon, kumpulan = 'Umum' }) {
  await db.query(
    'INSERT INTO contacts (id, device_id, nama, telefon, kumpulan) VALUES (?, ?, ?, ?, ?)',
    [id, deviceId, nama, telefon, kumpulan]
  );
  return getById(id);
}

async function update(id, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return getById(id);
  const sets = keys.map(k => `${k} = ?`).join(', ');
  await db.query(`UPDATE contacts SET ${sets} WHERE id = ?`, [...keys.map(k => fields[k]), id]);
  return getById(id);
}

async function remove(id) {
  await db.query('DELETE FROM contacts WHERE id = ?', [id]);
}

async function removeMany(ids) {
  if (!ids.length) return;
  await db.query(`DELETE FROM contacts WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
}

module.exports = { getForDevice, getById, getByPhone, upsertMany, create, update, remove, removeMany };
