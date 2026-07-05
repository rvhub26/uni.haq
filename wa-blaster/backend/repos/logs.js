const db = require('../db');

async function create({ id, deviceId, scheduleId = null, templateId = null, templateText, blastAt, sent, failed, details }) {
  await db.query(
    `INSERT INTO logs (id, device_id, schedule_id, template_id, template_text, blast_at, sent, failed, details)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, deviceId, scheduleId, templateId, templateText, blastAt, sent, failed, JSON.stringify(details || null)]
  );
}

async function getForDevice(deviceId) {
  const [rows] = await db.query('SELECT * FROM logs WHERE device_id = ? ORDER BY blast_at DESC', [deviceId]);
  return rows;
}

async function removeAllForDevice(deviceId) {
  await db.query('DELETE FROM logs WHERE device_id = ?', [deviceId]);
}

module.exports = { create, getForDevice, removeAllForDevice };
