const db = require('../db');

async function insertMany(items) {
  for (const q of items) {
    await db.query(
      `INSERT INTO queue (id, device_id, schedule_id, nama, telefon, template_id, template_text, media_file, send_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [q.id, q.deviceId, q.scheduleId || null, q.nama, q.telefon, q.templateId || null, q.templateText, q.mediaFile || null, q.sendAt]
    );
  }
}

async function getDuePending(deviceId, now = new Date()) {
  const [rows] = await db.query(
    `SELECT * FROM queue WHERE device_id = ? AND status = 'pending' AND send_at <= ? ORDER BY send_at ASC`,
    [deviceId, now]
  );
  return rows;
}

async function markSent(id) {
  await db.query(`UPDATE queue SET status = 'sent', sent_at = NOW() WHERE id = ?`, [id]);
}

async function markFailed(id, error) {
  await db.query(`UPDATE queue SET status = 'failed', error = ? WHERE id = ?`, [error, id]);
}

async function markDeliveryStatus(deviceId, telefon, statusField) {
  // statusField: 'delivered' | 'read' | 'failed' — patch the most recent 'sent' item for that phone
  const column = statusField === 'delivered' ? 'delivered_at' : statusField === 'read' ? 'read_at' : null;
  if (column) {
    await db.query(
      `UPDATE queue SET ${column} = NOW() WHERE device_id = ? AND telefon = ? AND status = 'sent'
       ORDER BY sent_at DESC LIMIT 1`,
      [deviceId, telefon]
    );
  } else if (statusField === 'failed') {
    await db.query(
      `UPDATE queue SET status = 'failed', error = 'delivery_failed' WHERE device_id = ? AND telefon = ? AND status = 'sent'
       ORDER BY sent_at DESC LIMIT 1`,
      [deviceId, telefon]
    );
  }
}

async function getForDevice(deviceId) {
  const [rows] = await db.query('SELECT * FROM queue WHERE device_id = ? ORDER BY send_at DESC', [deviceId]);
  return rows;
}

async function getPendingForDevice(deviceId) {
  const [rows] = await db.query(`SELECT * FROM queue WHERE device_id = ? AND status = 'pending' ORDER BY send_at ASC`, [deviceId]);
  return rows;
}

async function deleteOldProcessed(deviceId, cutoffDate) {
  await db.query(
    `DELETE FROM queue WHERE device_id = ? AND status != 'pending' AND created_at < ?`,
    [deviceId, cutoffDate]
  );
}

async function removePendingForSchedule(deviceId, scheduleId) {
  await db.query(`DELETE FROM queue WHERE device_id = ? AND schedule_id = ? AND status = 'pending'`, [deviceId, scheduleId]);
}

module.exports = {
  insertMany, getDuePending, markSent, markFailed, markDeliveryStatus, getForDevice,
  getPendingForDevice, deleteOldProcessed, removePendingForSchedule,
};
