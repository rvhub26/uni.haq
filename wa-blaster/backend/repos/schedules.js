const db = require('../db');

async function getForDevice(deviceId) {
  const [rows] = await db.query('SELECT * FROM schedules WHERE device_id = ? ORDER BY created_at DESC', [deviceId]);
  return rows;
}

async function getById(id) {
  const [rows] = await db.query('SELECT * FROM schedules WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function create(deviceId, s) {
  await db.query(
    `INSERT INTO schedules
      (id, device_id, use_rotation, template_ids, rotation_index, template, media_file,
       type, datetime, pattern, contacts, contact_gap_ms, template_gap_ms, batch_size, batch_gap_ms,
       history_only, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      s.id, deviceId, s.useRotation ? 1 : 0, JSON.stringify(s.templateIds || []), s.rotationIndex || 0,
      s.template || null, s.mediaFile || null, s.type, s.datetime ? new Date(s.datetime) : null,
      JSON.stringify(s.pattern || null), JSON.stringify(s.contacts ?? 'all'),
      s.contactGapMs || 4000, s.templateGapMs || 0, s.batchSize || 0, s.batchGapMs || 0,
      s.historyOnly ? 1 : 0, s.status || 'active',
    ]
  );
  return getById(s.id);
}

async function setRotationIndex(id, rotationIndex) {
  await db.query('UPDATE schedules SET rotation_index = ? WHERE id = ?', [rotationIndex, id]);
}

async function setStatus(id, status) {
  await db.query('UPDATE schedules SET status = ? WHERE id = ?', [status, id]);
}

async function remove(id) {
  await db.query('DELETE FROM schedules WHERE id = ?', [id]);
}

async function getAllActiveWithDevice() {
  const [rows] = await db.query(`SELECT * FROM schedules WHERE status = 'active'`);
  return rows;
}

module.exports = { getForDevice, getById, create, setRotationIndex, setStatus, remove, getAllActiveWithDevice };
