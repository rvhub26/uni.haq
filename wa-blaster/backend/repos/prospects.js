const db = require('../db');

async function getByPhone(deviceId, phone) {
  const [rows] = await db.query(
    'SELECT * FROM prospects WHERE device_id = ? AND phone_number = ? LIMIT 1',
    [deviceId, phone]
  );
  return rows[0] || null;
}

async function create(deviceId, phone, contactId = null) {
  await db.query(
    `INSERT IGNORE INTO prospects (device_id, phone_number, contact_id, last_message_at)
     VALUES (?, ?, ?, NOW())`,
    [deviceId, phone, contactId]
  );
  return getByPhone(deviceId, phone);
}

async function updateStep(deviceId, phone, step) {
  await db.query(
    'UPDATE prospects SET current_step = ?, updated_at = NOW() WHERE device_id = ? AND phone_number = ?',
    [step, deviceId, phone]
  );
}

async function updateFields(deviceId, phone, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const sets = keys.map(k => `${k} = ?`).join(', ');
  const values = [...keys.map(k => fields[k]), deviceId, phone];
  await db.query(
    `UPDATE prospects SET ${sets}, updated_at = NOW() WHERE device_id = ? AND phone_number = ?`,
    values
  );
}

async function updateLastMessage(deviceId, phone) {
  await db.query(
    'UPDATE prospects SET last_message_at = NOW() WHERE device_id = ? AND phone_number = ?',
    [deviceId, phone]
  );
}

async function updateStatus(deviceId, phone, status) {
  await db.query(
    'UPDATE prospects SET status = ?, updated_at = NOW() WHERE device_id = ? AND phone_number = ?',
    [status, deviceId, phone]
  );
}

async function incrementColdAttempts(deviceId, phone) {
  await db.query(
    'UPDATE prospects SET cold_attempts = cold_attempts + 1 WHERE device_id = ? AND phone_number = ?',
    [deviceId, phone]
  );
}

// Prospect senyap untuk follow up (skop 1 device — dipanggil per device dalam cron loop)
async function getForFollowUp(deviceId, hoursAgo, followUpField) {
  const [rows] = await db.query(
    `SELECT * FROM prospects
     WHERE device_id = ? AND status = 'active'
     AND ${followUpField} = 0
     AND last_message_at <= NOW() - INTERVAL ? HOUR`,
    [deviceId, hoursAgo]
  );
  return rows;
}

async function markFollowUpSent(deviceId, phone, followUpField) {
  await db.query(
    `UPDATE prospects SET ${followUpField} = 1 WHERE device_id = ? AND phone_number = ?`,
    [deviceId, phone]
  );
}

async function getAllForDevice(deviceId) {
  const [rows] = await db.query(
    'SELECT * FROM prospects WHERE device_id = ? ORDER BY created_at DESC',
    [deviceId]
  );
  return rows;
}

async function getById(prospectId) {
  const [rows] = await db.query('SELECT * FROM prospects WHERE id = ? LIMIT 1', [prospectId]);
  return rows[0] || null;
}

async function getDailyStats(deviceId) {
  const [rows] = await db.query(
    `SELECT
       COUNT(*) AS total,
       SUM(p.status = 'closed') AS close,
       SUM(p.status = 'warm') AS warm,
       SUM(p.status = 'cold') AS cold,
       COALESCE(SUM(o.total_price), 0) AS total_sales
     FROM prospects p
     LEFT JOIN orders o ON o.prospect_id = p.id AND o.status = 'confirmed'
     WHERE p.device_id = ? AND DATE(p.created_at) = CURDATE()`,
    [deviceId]
  );
  return rows[0];
}

module.exports = {
  getDailyStats,
  getByPhone,
  create,
  updateStep,
  updateFields,
  updateLastMessage,
  updateStatus,
  incrementColdAttempts,
  getForFollowUp,
  markFollowUpSent,
  getAllForDevice,
  getById,
};
