const db = require('../db');

function parseKeywords(k) {
  if (Array.isArray(k)) return k;
  try { return JSON.parse(k); } catch { return []; }
}

function toRow(r) {
  return {
    tierKey: r.tier_key, label: r.label, quantity: r.quantity,
    price: parseFloat(r.price), keywords: parseKeywords(r.keywords),
    upsellPhrase: r.upsell_phrase,
  };
}

async function getAllForDevice(deviceId) {
  const [rows] = await db.query(
    'SELECT * FROM bot_package_tiers WHERE device_id = ? ORDER BY sort_order, id',
    [deviceId]
  );
  return rows.map(toRow);
}

async function replaceAllForDevice(deviceId, tiers) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM bot_package_tiers WHERE device_id = ?', [deviceId]);
    for (let i = 0; i < tiers.length; i++) {
      const t = tiers[i];
      await conn.query(
        `INSERT INTO bot_package_tiers (device_id, tier_key, label, quantity, price, keywords, upsell_phrase, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [deviceId, t.tierKey, t.label, t.quantity, t.price, JSON.stringify(t.keywords || []), t.upsellPhrase || null, i]
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
