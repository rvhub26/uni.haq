const db = require('../db');

async function record(deviceId, phone) {
  await db.query(
    'INSERT IGNORE INTO chat_threads (device_id, phone_number) VALUES (?, ?)',
    [deviceId, phone]
  );
}

async function getPhoneSet(deviceId) {
  const [rows] = await db.query('SELECT phone_number FROM chat_threads WHERE device_id = ?', [deviceId]);
  return new Set(rows.map(r => r.phone_number));
}

module.exports = { record, getPhoneSet };
