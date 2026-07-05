const path = require('path');
const fs = require('fs');
const qrcode = require('qrcode');
const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const { AUTH_DIR } = require('./config');
const chatThreadsRepo = require('./repos/chatThreads');
const inbound = require('./inbound');

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

async function connectDevice(userId, deviceId, pairingPhone = null) {
  const conn = getConn(userId, deviceId);

  // Bersihkan watchdog lama kalau ada
  if (conn.watchdog) { clearInterval(conn.watchdog); conn.watchdog = null; }

  if (conn.sock) {
    try { conn.sock.end(undefined); } catch {}
    conn.sock = null;
  }

  const authDir = path.join(__dirname, AUTH_DIR, userId, deviceId);

  // Kalau pairing mode, buang auth lama dulu — mesti fresh start
  if (pairingPhone) {
    try { fs.rmSync(authDir, { recursive: true, force: true }); } catch {}
    conn.pairingMode = true;
  }

  // Kalau tiada credentials DAN bukan pairing mode — jangan connect, tunggu user
  if (!pairingPhone) {
    const credsPath = path.join(authDir, 'creds.json');
    if (!fs.existsSync(credsPath)) {
      conn.status = 'disconnected';
      console.log(`[WA] ${userId}::${deviceId} tiada credentials — skip autoconnect`);
      return;
    }
  }

  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();
  const usePairing = pairingPhone && !state.creds.registered;

  // Track sama ada device dah registered (ada credentials) atau baru
  conn.isRegistered = !!state.creds.registered;

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    browser: ['UniHaq', 'Chrome', '120.0.0'],
    keepAliveIntervalMs: 30000,
    connectTimeoutMs: 60000,
    retryRequestDelayMs: 3000,
    defaultQueryTimeoutMs: 60000,
    generateHighQualityLinkPreview: false,
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });

  conn.sock = sock;
  conn.lastActivity = Date.now();

  sock.ev.on('creds.update', () => { saveCreds(); conn.isRegistered = true; });

  sock.ev.on('chats.upsert', (chats) => {
    conn.lastActivity = Date.now();
    for (const chat of chats) {
      const jid = chat.id;
      if (!jid?.endsWith('@s.whatsapp.net')) continue;
      const phone = jid.replace('@s.whatsapp.net', '');
      chatThreadsRepo.record(deviceId, phone).catch(() => {});
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    conn.lastActivity = Date.now();
    for (const msg of messages) {
      if (msg.key.fromMe || !msg.message) continue;
      const jid = msg.key.remoteJid;
      if (!jid?.endsWith('@s.whatsapp.net')) continue;
      const telefon = jid.replace('@s.whatsapp.net', '');

      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        '';
      const isImage = !!msg.message?.imageMessage;
      if (!text && !isImage) continue;

      try {
        await inbound.handleInboundMessage({ userId, deviceId, from: telefon, text: text.trim(), isImage, waMessageId: msg.key.id });
      } catch (e) {
        console.log(`[WA] ${userId}::${deviceId} inbound gagal: ${e.message}`);
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
      conn.qrBase64 = null;
      conn.reconnectAttempts = 0;
      conn.lastActivity = Date.now();
      conn.lastConnectedAt = Date.now();
      conn.pairingMode = false; // Berjaya sambung — pairing selesai

      conn.status = 'connected';
      conn.phoneNumber = sock.user?.id?.split(':')[0] || null;
      console.log(`[WA] ${userId}::${deviceId} berjaya disambung (${conn.phoneNumber || 'unknown'})`);

      // Keepalive — hantar presence setiap 3 minit supaya session tak idle
      if (conn.watchdog) clearInterval(conn.watchdog);
      conn.watchdog = setInterval(async () => {
        if (conn.status !== 'connected' || !conn.sock) return;
        try {
          await conn.sock.sendPresenceUpdate('available');
          conn.lastActivity = Date.now();
        } catch (e) {
          console.log(`[WA] ${userId}::${deviceId} keepalive gagal: ${e.message}, reconnect...`);
          connectDevice(userId, deviceId);
        }
      }, 3 * 60 * 1000);
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      conn.qrBase64 = null;
      if (conn.watchdog) { clearInterval(conn.watchdog); conn.watchdog = null; }

      // Kalau dalam pairing mode (tunggu user masuk kod) dan putus — jangan reconnect
      // User perlu klik "Jana Kod Baru" untuk cuba semula
      if (conn.pairingMode) {
        console.log(`[WA] ${userId}::${deviceId} pairing timeout/gagal (kod: ${code}), tunggu kod baru...`);
        conn.pairingMode = false;
        conn.status = 'disconnected';
        const authDir = path.join(__dirname, AUTH_DIR, userId, deviceId);
        try { fs.rmSync(authDir, { recursive: true, force: true }); } catch {}
        return;
      }

      // Session dah tak valid — buang auth, jangan reconnect, perlu scan QR baru
      const invalidCodes = [DisconnectReason.loggedOut, DisconnectReason.badSession, 403, 405, 401];
      if (invalidCodes.includes(code)) {
        console.log(`[WA] ${userId}::${deviceId} session tak valid (kod: ${code}), buang auth...`);
        const authDir = path.join(__dirname, AUTH_DIR, userId, deviceId);
        try { fs.rmSync(authDir, { recursive: true, force: true }); } catch {}
        conn.status = 'disconnected';
        conn.phoneNumber = null;
        return;
      }

      // Connection diganti peranti lain — jangan reconnect
      if (code === DisconnectReason.connectionReplaced) {
        conn.status = 'disconnected';
        console.log(`[WA] ${userId}::${deviceId} connection diganti peranti lain`);
        return;
      }

      // QR timeout (408) + belum registered = tiada siapa scan QR, jangan loop
      if (code === 408 && !conn.isRegistered) {
        console.log(`[WA] ${userId}::${deviceId} QR timeout, tiada credentials — stop reconnect, tunggu user`);
        conn.status = 'disconnected';
        return;
      }

      // Rapid fail detection — connect then putus dalam <30s berturut-turut = session stale
      const connectedDuration = conn.lastConnectedAt ? Date.now() - conn.lastConnectedAt : null;
      if (connectedDuration !== null && connectedDuration < 30000) {
        conn.rapidFailCount = (conn.rapidFailCount || 0) + 1;
        console.log(`[WA] ${userId}::${deviceId} rapid fail #${conn.rapidFailCount} (connected ${Math.round(connectedDuration/1000)}s)`);
        if (conn.rapidFailCount >= 3) {
          console.log(`[WA] ${userId}::${deviceId} session stale — buang auth, perlu scan QR baru`);
          const authDir = path.join(__dirname, AUTH_DIR, userId, deviceId);
          try { fs.rmSync(authDir, { recursive: true, force: true }); } catch {}
          conn.status = 'disconnected';
          conn.rapidFailCount = 0;
          conn.phoneNumber = null;
          return;
        }
      } else {
        conn.rapidFailCount = 0;
      }

      // Reconnect dengan exponential backoff + jitter
      conn.reconnectAttempts = (conn.reconnectAttempts || 0) + 1;
      const base = Math.min(5000 * conn.reconnectAttempts, 60000);
      const jitter = Math.floor(Math.random() * 3000);
      const delay = base + jitter;
      conn.status = 'connecting';
      console.log(`[WA] ${userId}::${deviceId} reconnect dalam ${Math.round(delay/1000)}s (cuba ke-${conn.reconnectAttempts}, kod: ${code})...`);
      setTimeout(() => connectDevice(userId, deviceId), delay);
    }
  });

  // Pairing code mode — tunggu socket ready, request kod
  if (usePairing) {
    await new Promise(r => setTimeout(r, 3000));
    try {
      const cleanPhone = pairingPhone.replace(/\D/g, '');
      const code = await sock.requestPairingCode(cleanPhone);
      conn.pairingCode = code;
      console.log(`[WA] ${userId}::${deviceId} pairing code: ${code}`);
      return code;
    } catch (e) {
      console.log(`[WA] ${userId}::${deviceId} pairing code error: ${e.message}`);
      throw new Error(`Gagal dapatkan pairing code: ${e.message}`);
    }
  }
}

async function disconnectDevice(userId, deviceId) {
  const k = connKey(userId, deviceId);
  const conn = conns.get(k);
  if (conn?.watchdog) { clearInterval(conn.watchdog); }
  if (conn?.sock) {
    try { conn.sock.end(undefined); } catch {}
  }
  conns.delete(k);
  const authDir = path.join(__dirname, AUTH_DIR, userId, deviceId);
  if (fs.existsSync(authDir)) fs.rmSync(authDir, { recursive: true, force: true });
}

function getDeviceStatus(userId, deviceId) {
  const conn = getConn(userId, deviceId);
  // Ghost connection check — connected tapi sock.user tiada = fake connection
  const isGhost = conn.status === 'connected' && conn.sock && !conn.sock.user;
  const status = isGhost ? 'disconnected' : conn.status;
  return { connected: status === 'connected', status, phoneNumber: conn.phoneNumber || null };
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

async function getChatHistory(userId, deviceId) {
  const set = await chatThreadsRepo.getPhoneSet(deviceId);
  return [...set];
}

async function sendTypingIndicator(userId, deviceId, phone) {
  const conn = getConn(userId, deviceId);
  if (!conn.sock || conn.status !== 'connected') return;
  try { await conn.sock.sendPresenceUpdate('composing', toJID(phone)); } catch {}
}

async function stopTypingIndicator(userId, deviceId, phone) {
  const conn = getConn(userId, deviceId);
  if (!conn.sock || conn.status !== 'connected') return;
  try { await conn.sock.sendPresenceUpdate('paused', toJID(phone)); } catch {}
}

async function markAsRead(userId, deviceId, messageKey) {
  const conn = getConn(userId, deviceId);
  if (!conn.sock || conn.status !== 'connected') return;
  try { await conn.sock.readMessages([messageKey]); } catch {}
}

module.exports = {
  connectDevice,
  sendTypingIndicator,
  stopTypingIndicator,
  markAsRead,
  disconnectDevice,
  getDeviceStatus,
  getDeviceQR,
  sendMessageDevice,
  sendMediaDevice,
  getChatHistory,
};
