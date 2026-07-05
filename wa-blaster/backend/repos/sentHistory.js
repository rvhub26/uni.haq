const db = require('../db');

async function getSentTemplateIdsForPhone(deviceId, phone) {
  const [rows] = await db.query(
    'SELECT template_id FROM sent_history WHERE device_id = ? AND phone_number = ?',
    [deviceId, phone]
  );
  return rows.map(r => r.template_id);
}

async function record(deviceId, phone, templateId) {
  await db.query(
    `INSERT IGNORE INTO sent_history (device_id, phone_number, template_id) VALUES (?, ?, ?)`,
    [deviceId, phone, templateId]
  );
}

// Group by phone_number → [templateId, ...] untuk laporan history per device
async function getGroupedForDevice(deviceId) {
  const [rows] = await db.query(
    'SELECT phone_number, template_id FROM sent_history WHERE device_id = ?',
    [deviceId]
  );
  const grouped = {};
  for (const r of rows) {
    if (!grouped[r.phone_number]) grouped[r.phone_number] = [];
    grouped[r.phone_number].push(r.template_id);
  }
  return grouped;
}

async function removeForPhones(deviceId, phones) {
  if (!phones.length) return;
  await db.query(
    `DELETE FROM sent_history WHERE device_id = ? AND phone_number IN (${phones.map(() => '?').join(',')})`,
    [deviceId, ...phones]
  );
}

async function removeAllForDevice(deviceId) {
  await db.query('DELETE FROM sent_history WHERE device_id = ?', [deviceId]);
}

module.exports = { getSentTemplateIdsForPhone, record, getGroupedForDevice, removeForPhones, removeAllForDevice };
