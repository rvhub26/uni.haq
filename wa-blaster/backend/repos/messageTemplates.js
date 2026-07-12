const db = require('../db');

function parseBubbles(b) {
  if (Array.isArray(b)) return b;
  try { return JSON.parse(b); } catch { return []; }
}

async function getAllForDevice(deviceId) {
  const [rows] = await db.query(
    'SELECT * FROM bot_message_templates WHERE device_id = ? ORDER BY angle_key, sort_order, id',
    [deviceId]
  );
  return rows.map(r => ({ angleKey: r.angle_key, templateKey: r.template_key, bubbles: parseBubbles(r.bubbles) }));
}

// Shaped for direct lookup at render time: { _shared: { key: bubbles }, kaku: { key: bubbles }, ... }
async function getTemplateMap(deviceId) {
  const rows = await getAllForDevice(deviceId);
  const map = {};
  for (const r of rows) {
    if (!map[r.angleKey]) map[r.angleKey] = {};
    map[r.angleKey][r.templateKey] = r.bubbles;
  }
  return map;
}

async function replaceAllForDevice(deviceId, templates) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM bot_message_templates WHERE device_id = ?', [deviceId]);
    for (let i = 0; i < templates.length; i++) {
      const t = templates[i];
      await conn.query(
        'INSERT INTO bot_message_templates (device_id, angle_key, template_key, bubbles, sort_order) VALUES (?, ?, ?, ?, ?)',
        [deviceId, t.angleKey || '_shared', t.templateKey, JSON.stringify(t.bubbles || []), i]
      );
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  return getTemplateMap(deviceId);
}

module.exports = { getAllForDevice, getTemplateMap, replaceAllForDevice };
