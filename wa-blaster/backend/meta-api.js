const https = require('https');
const { readDeviceJSONObject, writeDeviceJSON } = require('./store');

const META_API_VERSION = 'v21.0';
const BASE_URL = `graph.facebook.com`;

// In-memory cache untuk active meta connections
const metaConns = new Map();

function connKey(userId, deviceId) { return `${userId}::${deviceId}`; }

function getMetaConn(userId, deviceId) {
  const k = connKey(userId, deviceId);
  if (!metaConns.has(k)) {
    metaConns.set(k, { status: 'disconnected', phoneNumberId: null, accessToken: null, displayPhone: null });
  }
  return metaConns.get(k);
}

function apiGet(path, accessToken) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      path: `/${META_API_VERSION}${path}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message));
          resolve(parsed);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function apiPost(path, accessToken, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: BASE_URL,
      path: `/${META_API_VERSION}${path}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'Content-Length': Buffer.byteLength(data),
      },
    };
    const req = https.request(options, (res) => {
      let resp = '';
      res.on('data', c => resp += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(resp);
          if (parsed.error) return reject(new Error(parsed.error.message));
          resolve(parsed);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Setup dan verify credentials Meta API
async function setupMetaDevice(userId, deviceId, phoneNumberId, accessToken) {
  const conn = getMetaConn(userId, deviceId);

  // Verify credentials dengan call API
  const info = await apiGet(`/${phoneNumberId}`, accessToken);

  conn.phoneNumberId = phoneNumberId;
  conn.accessToken = accessToken;
  conn.displayPhone = info.display_phone_number || null;
  conn.verifiedName = info.verified_name || null;
  conn.status = 'connected';

  // Simpan credentials ke disk
  writeDeviceJSON(userId, deviceId, 'meta-creds.json', {
    phoneNumberId,
    accessToken,
    displayPhone: conn.displayPhone,
    verifiedName: conn.verifiedName,
  });

  console.log(`[Meta] ${userId}::${deviceId} connected — ${conn.displayPhone} (${conn.verifiedName})`);
  return { displayPhone: conn.displayPhone, verifiedName: conn.verifiedName };
}

// Load credentials dari disk (dipanggil masa startup)
function loadMetaDevice(userId, deviceId) {
  const creds = readDeviceJSONObject(userId, deviceId, 'meta-creds.json');
  if (!creds.phoneNumberId || !creds.accessToken) return;

  const conn = getMetaConn(userId, deviceId);
  conn.phoneNumberId = creds.phoneNumberId;
  conn.accessToken = creds.accessToken;
  conn.displayPhone = creds.displayPhone || null;
  conn.verifiedName = creds.verifiedName || null;
  conn.status = 'connected';
  console.log(`[Meta] ${userId}::${deviceId} restored — ${conn.displayPhone}`);
}

// Hantar mesej teks biasa
async function sendTextMeta(userId, deviceId, to, text) {
  const conn = getMetaConn(userId, deviceId);
  if (!conn.phoneNumberId || !conn.accessToken) throw new Error('Meta API credentials belum setup');

  const phone = String(to).replace(/\D/g, '');
  return apiPost(`/${conn.phoneNumberId}/messages`, conn.accessToken, {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'text',
    text: { body: text },
  });
}

// Hantar template message (untuk blast pertama kali — di luar 24jam window)
async function sendTemplateMeta(userId, deviceId, to, templateName, langCode = 'ms', components = []) {
  const conn = getMetaConn(userId, deviceId);
  if (!conn.phoneNumberId || !conn.accessToken) throw new Error('Meta API credentials belum setup');

  const phone = String(to).replace(/\D/g, '');
  return apiPost(`/${conn.phoneNumberId}/messages`, conn.accessToken, {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'template',
    template: { name: templateName, language: { code: langCode }, components },
  });
}

// Status Meta device
function getMetaDeviceStatus(userId, deviceId) {
  const conn = getMetaConn(userId, deviceId);
  return {
    connected: conn.status === 'connected',
    status: conn.status,
    phoneNumber: conn.displayPhone || null,
    verifiedName: conn.verifiedName || null,
    type: 'meta',
  };
}

// Disconnect Meta device (buang credentials)
function disconnectMetaDevice(userId, deviceId) {
  const k = connKey(userId, deviceId);
  metaConns.delete(k);
  writeDeviceJSON(userId, deviceId, 'meta-creds.json', {});
}

module.exports = {
  setupMetaDevice,
  loadMetaDevice,
  sendTextMeta,
  sendTemplateMeta,
  getMetaDeviceStatus,
  disconnectMetaDevice,
};
