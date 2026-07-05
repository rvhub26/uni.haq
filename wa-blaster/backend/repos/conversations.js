const db = require('../db');

async function save(prospectId, deviceId, direction, message, type = 'text', imageKey = null, waMessageId = null) {
  await db.query(
    `INSERT INTO conversations (prospect_id, device_id, direction, message, message_type, image_key, wa_message_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [prospectId, deviceId, direction, message, type, imageKey, waMessageId]
  );
}

async function getHistory(prospectId, limit = 20) {
  const [rows] = await db.query(
    `SELECT * FROM conversations
     WHERE prospect_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [prospectId, limit]
  );
  return rows.reverse();
}

module.exports = { save, getHistory };
