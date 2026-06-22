const path = require('path');
const qrcode = require('qrcode');
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { AUTH_DIR } = require('./config');

let sock = null;
let status = 'disconnected'; // disconnected | connecting | qr | connected
let qrBase64 = null;

// Tukar nombor telefon → JID WhatsApp
function toJID(phone) {
  const clean = String(phone).replace(/\D/g, '');
  return `${clean}@s.whatsapp.net`;
}

// Detect jenis media dari extension
function getMediaType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) return 'image';
  if (['.mp4', '.mov', '.avi', '.mkv'].includes(ext)) return 'video';
  return null;
}

async function connectWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, AUTH_DIR));

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      status = 'qr';
      qrBase64 = await qrcode.toDataURL(qr);
    }

    if (connection === 'open') {
      status = 'connected';
      qrBase64 = null;
      console.log('WhatsApp berjaya disambung');
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      // 401 = logout, jangan reconnect
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      status = shouldReconnect ? 'connecting' : 'disconnected';
      qrBase64 = null;

      if (shouldReconnect) {
        console.log('Sambungan terputus, cuba semula...');
        setTimeout(connectWhatsApp, 3000);
      } else {
        console.log('Dilog keluar. Scan QR semula.');
      }
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
