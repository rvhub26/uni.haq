const path = require('path');
const qrcode = require('qrcode');
const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { AUTH_DIR } = require('./config');
const { readJSON, readJSONObject, writeJSON } = require('./store');

let sock = null;
let status = 'disconnected';
let qrBase64 = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30000; // max 30 saat delay

function toJID(phone) {
  const clean = String(phone).replace(/\D/g, '');
  return `${clean}@s.whatsapp.net`;
}

function getMediaType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) return 'image';
  if (['.mp4', '.mov', '.avi', '.mkv'].includes(ext)) return 'video';
  return null;
}

async function connectWhatsApp() {
  // Tutup socket lama sebelum buat baru
  if (sock) {
    try { sock.end(undefined); } catch {}
    sock = null;
  }

  const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, AUTH_DIR));
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    keepAliveIntervalMs: 15000,     // ping setiap 15 saat supaya tak putus
    connectTimeoutMs: 60000,
    retryRequestDelayMs: 2000,
    defaultQueryTimeoutMs: 60000,
    generateHighQualityLinkPreview: false,
  });

  sock.ev.on('creds.update', saveCreds);

  // Track replies dari contacts
  sock.ev.on('messages.upsert', ({ messages }) => {
    for (const msg of messages) {
      if (msg.key.fromMe) continue;
      if (!msg.message) continue;
      const jid = msg.key.remoteJid;
      if (!jid || !jid.endsWith('@s.whatsapp.net')) continue;

      const telefon = jid.replace('@s.whatsapp.net', '');
      const contacts = readJSON('contacts.json');
      const contact = contacts.find(c => c.telefon === telefon);
      if (!contact) continue;

      const replies = readJSONObject('replies.json');
      if (!replies[telefon]) {
        replies[telefon] = {
          nama: contact.nama,
          replied: true,
          repliedAt: new Date().toISOString(),
        };
        writeJSON('replies.json', replies);
      }
    }
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      status = 'qr';
      qrBase64 = await qrcode.toDataURL(qr);
      reconnectAttempts = 0;
    }

    if (connection === 'open') {
      status = 'connected';
      qrBase64 = null;
      reconnectAttempts = 0;
      console.log('WhatsApp berjaya disambung');
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      qrBase64 = null;

      if (statusCode === DisconnectReason.loggedOut) {
        // Kena logout — perlu scan QR baru
        status = 'disconnected';
        console.log('Dilog keluar. Scan QR semula.');
        return;
      }

      // Semua disconnect lain — reconnect dengan exponential backoff
      reconnectAttempts++;
      const delay = Math.min(3000 * reconnectAttempts, MAX_RECONNECT_DELAY);
      status = 'connecting';
      console.log(`Putus sambungan (${statusCode}), cuba semula dalam ${delay / 1000}s... (percubaan #${reconnectAttempts})`);
      setTimeout(connectWhatsApp, delay);
    }
  });
}

function getStatus() {
  return { connected: status === 'connected', status };
}

function getQR() {
  return qrBase64;
}

async function sendMessage(phone, text) {
  if (!sock || status !== 'connected') throw new Error('WhatsApp belum disambung');
  const jid = toJID(phone);
  await sock.sendMessage(jid, { text });
}

async function sendMedia(phone, filePath, caption) {
  if (!sock || status !== 'connected') throw new Error('WhatsApp belum disambung');
  const jid = toJID(phone);
  const type = getMediaType(filePath);

  if (type === 'image') {
    await sock.sendMessage(jid, { image: { url: filePath }, caption });
  } else if (type === 'video') {
    await sock.sendMessage(jid, { video: { url: filePath }, caption });
  } else {
    throw new Error('Jenis fail tidak disokong');
  }
}

module.exports = { connectWhatsApp, getStatus, getQR, sendMessage, sendMedia };
