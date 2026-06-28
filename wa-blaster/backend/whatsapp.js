const path = require('path');
const fs = require('fs');
const qrcode = require('qrcode');
const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { AUTH_DIR } = require('./config');
const { readDeviceJSON, readDeviceJSONObject, writeDeviceJSON } = require('./store');

// Map of active connections: `${userId}::${deviceId}` → state object
const conns = new Map();

function connKey(userId, deviceId) { return `${userId}::${deviceId}`; }

function getConn(userId, deviceId) {
  const k = connKey(userId, deviceId);
  if (!conns.has(k)) {
    conns.set(k, { sock: null, status: 'disconnected', qrBase64: null, reconnectAttempts: 0 });
  }
  return conns.get(k);
}

function toJID(phone) {
  return `${String(phone).replace(/\D/g, '')}@s.whatsapp.net`;
}

function getMediaType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) return 'image';
  if (['.mp4', '.mov', '.avi', '.mkv'].includes(ext)) return 'video';
  return null;
}

async function connectDevice(userId, deviceId) {
  const conn = getConn(userId, deviceId);

  if (conn.sock) {
    try { conn.sock.end(undefined); } catch {}
    conn.sock = null;
  }

  const authDir = path.join(__dirname, AUTH_DIR, userId, deviceId);
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    keepAliveIntervalMs: 15000,
    connectTimeoutMs: 60000,
    retryRequestDelayMs: 2000,
    defaultQueryTimeoutMs: 60000,
    generateHighQualityLinkPreview: false,
  });

  conn.sock = sock;

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('chats.upsert', (chats) => {
    const existing = readDeviceJSON(userId, deviceId, 'chat_history.json');
    const existingSet = new Set(existing);
    for (const chat of chats) {
      const jid = chat.id;
      if (!jid?.endsWith('@s.whatsapp.net')) continue;
      const phone = jid.replace('@s.whatsapp.net', '');
      existingSet.add(phone);
    }
    writeDeviceJSON(userId, deviceId, 'chat_history.json', [...existingSet]);
  });

  sock.ev.on('messages.upsert', ({ messages }) => {
    for (const msg of messages) {
      if (msg.key.fromMe || !msg.message) continue;
      const jid = msg.key.remoteJid;
      if (!jid?.endsWith('@s.whatsapp.net')) continue;
      const telefon = jid.replace('@s.whatsapp.net', '');
      const contacts = readDeviceJSON(userId, deviceId, 'contacts.json');
      const contact = contacts.find(c => c.telefon === telefon);
      if (!contact) continue;
      const replies = readDeviceJSONObject(userId, deviceId, 'replies.json');
      if (!replies[telefon]) {
        replies[telefon] = { nama: contact.nama, replied: true, repliedAt: new Date().toISOString() };
        writeDeviceJSON(userId, deviceId, 'replies.json', replies);
      }
    }
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      conn.status = 'qr';
      conn.qrBase64 = await qrcode.toDataURL(qr);
      conn.reconnectAttempts = 0;
    }

    if (connection === 'open') {
      conn.status = 'connected';
      conn.qrBase64 = null;
      conn.reconnectAttempts = 0;
      console.log(`[WA] ${userId}::${deviceId} berjaya disambung`);
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      conn.qrBase64 = null;

      if (code === DisconnectReason.loggedOut) {
        conn.status = 'disconnected';
        console.log(`[WA] ${userId}::${deviceId} dilog keluar`);
        return;
      }

      conn.reconnectAttempts++;
      const delay = Math.min(3000 * conn.reconnectAttempts, 30000);
      conn.status = 'connecting';
      console.log(`[WA] ${userId}::${deviceId} reconnect dalam ${delay / 1000}s...`);
      setTimeout(() => connectDevice(userId, deviceId), delay);
    }
  });
}

async function disconnectDevice(userId, deviceId) {
  const k = connKey(userId, deviceId);
  const conn = conns.get(k);
  if (conn?.sock) {
    try { conn.sock.end(undefined); } catch {}
  }
  conns.delete(k);
  const authDir = path.join(__dirname, AUTH_DIR, userId, deviceId);
  if (fs.existsSync(authDir)) fs.rmSync(authDir, { recursive: true, force: true });
}

function getDeviceStatus(userId, deviceId) {
  const conn = getConn(userId, deviceId);
  return { connected: conn.status === 'connected', status: conn.status };
}

function getDeviceQR(userId, deviceId) {
  return getConn(userId, deviceId).qrBase64;
}

async function sendMessageDevice(userId, deviceId, phone, text) {
  const conn = getConn(userId, deviceId);
  if (!conn.sock || conn.status !== 'connected') throw new Error('WhatsApp belum disambung');
  await conn.sock.sendMessage(toJID(phone), { text });
}

async function sendMediaDevice(userId, deviceId, phone, filePath, caption) {
  const conn = getConn(userId, deviceId);
  if (!conn.sock || conn.status !== 'connected') throw new Error('WhatsApp belum disambung');
  const type = getMediaType(filePath);
  if (type === 'image') {
    await conn.sock.sendMessage(toJID(phone), { image: { url: filePath }, caption });
  } else if (type === 'video') {
    await conn.sock.sendMessage(toJID(phone), { video: { url: filePath }, caption });
  } else {
    throw new Error('Jenis fail tidak disokong');
  }
}

function getChatHistory(userId, deviceId) {
  return readDeviceJSON(userId, deviceId, 'chat_history.json');
}

module.exports = {
  connectDevice,
  disconnectDevice,
  getDeviceStatus,
  getDeviceQR,
  sendMessageDevice,
  sendMediaDevice,
  getChatHistory,
};
