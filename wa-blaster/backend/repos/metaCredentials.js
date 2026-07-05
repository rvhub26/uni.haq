const db = require('../db');

async function get(deviceId) {
  const [rows] = await db.query('SELECT * FROM device_meta_credentials WHERE device_id = ? LIMIT 1', [deviceId]);
  return rows[0] || null;
}

async function upsert(deviceId, { phoneNumberId, accessToken, displayPhone, verifiedName }) {
  const existing = await get(deviceId);
  if (existing) {
    await db.query(
      `UPDATE device_meta_credentials SET phone_number_id = ?, access_token = ?, display_phone = ?, verified_name = ?
       WHERE device_id = ?`,
      [phoneNumberId, accessToken, displayPhone, verifiedName, deviceId]
    );
  } else {
    await db.query(
      `INSERT INTO device_meta_credentials (device_id, phone_number_id, access_token, display_phone, verified_name)
       VALUES (?, ?, ?, ?, ?)`,
      [deviceId, phoneNumberId, accessToken, displayPhone, verifiedName]
    );
  }
  return get(deviceId);
}

async function findDeviceByPhoneNumberId(phoneNumberId) {
  const [rows] = await db.query(
    'SELECT device_id, phone_number_id FROM device_meta_credentials WHERE phone_number_id = ? LIMIT 1',
    [phoneNumberId]
  );
  return rows[0] || null;
}

async function remove(deviceId) {
  await db.query('DELETE FROM device_meta_credentials WHERE device_id = ?', [deviceId]);
}

module.exports = { get, upsert, findDeviceByPhoneNumberId, remove };
