const db = require('../db');

function parseKeywords(k) {
  if (Array.isArray(k)) return k;
  try { return JSON.parse(k); } catch { return []; }
}

function toRow(r) {
  return { angleKey: r.angle_key, label: r.label, keywords: parseKeywords(r.keywords) };
}

async function getAllForDevice(deviceId) {
  const [rows] = await db.query(
    'SELECT * FROM bot_angles WHERE device_id = ? ORDER BY sort_order, id',
    [deviceId]
  );
  return rows.map(toRow);
}

async function replaceAllForDevice(deviceId, angles) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM bot_angles WHERE device_id = ?', [deviceId]);
    for (let i = 0; i < angles.length; i++) {
      const a = angles[i];
      await conn.query(
        'INSERT INTO bot_angles (device_id, angle_key, label, keywords, sort_order) VALUES (?, ?, ?, ?, ?)',
        [deviceId, a.angleKey, a.label, JSON.stringify(a.keywords || []), i]
      );
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  return getAllForDevice(deviceId);
}

module.exports = { getAllForDevice, replaceAllForDevice };
