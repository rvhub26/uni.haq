const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode');
const cron = require('node-cron');
const {
  useMultiFileAuthState,
  makeWASocket,
  Browsers,
} = require('@whiskeysockets/baileys');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const AUTH_DIR = path.join(DATA_DIR, 'auth');
const CONTACTS_FILE = path.join(DATA_DIR, 'contacts.json');
const HISTORY_FILE = path.join(DATA_DIR, 'broadcast_history.json');
const SCHEDULES_FILE = path.join(DATA_DIR, 'schedules.json');

let socket = null;
let connectionStatus = 'idle';
let connectionError = '';
let qrCodeData = '';
let lastConnectedAt = null;
let reconnectTimer = null;
const scheduledJobs = new Map();

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }
}

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }

    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function initializeDataFiles() {
  if (!fs.existsSync(CONTACTS_FILE)) {
    writeJson(CONTACTS_FILE, []);
  }

  if (!fs.existsSync(HISTORY_FILE)) {
    writeJson(HISTORY_FILE, []);
  }

  if (!fs.existsSync(SCHEDULES_FILE)) {
    writeJson(SCHEDULES_FILE, []);
  }
}

function getActiveContacts() {
  const contacts = readJson(CONTACTS_FILE, []);
  return contacts.filter((contact) => contact.active && contact.jid);
}

async function sendMessageBatch(message, recipients = getActiveContacts()) {
  if (!socket || connectionStatus !== 'connected') {
    throw new Error('WhatsApp is not connected yet. Please scan the QR code first.');
  }

  if (!recipients.length) {
    throw new Error('No active contacts available for broadcast.');
  }

  let successCount = 0;
  const failed = [];

  for (const contact of recipients) {
    try {
      await socket.sendMessage(contact.jid, { text: message });
      successCount += 1;
    } catch (error) {
      failed.push({
        name: contact.name,
        jid: contact.jid,
        error: error.message,
      });
    }
  }

  const history = readJson(HISTORY_FILE, []);
  const entry = {
    id: `${Date.now()}`,
    sentAt: new Date().toISOString(),
    total: recipients.length,
    success: successCount,
    message,
    failed,
  };

  history.unshift(entry);
  writeJson(HISTORY_FILE, history.slice(0, 20));

  return entry;
}

function saveSchedules(schedules) {
  writeJson(SCHEDULES_FILE, schedules);
}

async function runScheduledBroadcast(schedule) {
  const recipients = getActiveContacts();

  if (!recipients.length) {
    return;
  }

  const result = await sendMessageBatch(schedule.message, recipients);

  const schedules = readJson(SCHEDULES_FILE, []);
  const index = schedules.findIndex((item) => item.id === schedule.id);

  if (index >= 0) {
    schedules[index] = {
      ...schedules[index],
      lastRunAt: new Date().toISOString(),
      status: schedule.frequency === 'once' ? 'completed' : 'scheduled',
      lastResult: result,
    };
    saveSchedules(schedules);
  }
}

function registerSchedule(schedule) {
  if (scheduledJobs.has(schedule.id)) {
    return;
  }

  if (schedule.frequency === 'once') {
    const delay = new Date(schedule.scheduledAt).getTime() - Date.now();

    if (delay <= 0) {
      runScheduledBroadcast(schedule).catch(() => {});
      return;
    }

    const timeoutId = setTimeout(() => {
      runScheduledBroadcast(schedule)
        .catch(() => {})
        .finally(() => {
          scheduledJobs.delete(schedule.id);
        });
    }, delay);

    scheduledJobs.set(schedule.id, timeoutId);
    return;
  }

  const scheduleDate = new Date(schedule.scheduledAt);
  if (Number.isNaN(scheduleDate.getTime())) {
    return;
  }

  const cronExpression = `${scheduleDate.getMinutes()} ${scheduleDate.getHours()} * * *`;

  if (!cron.validate(cronExpression)) {
    return;
  }

  const job = cron.schedule(
    cronExpression,
    () => {
      runScheduledBroadcast(schedule).catch(() => {});
    },
    {
      scheduled: true,
    }
  );

  scheduledJobs.set(schedule.id, job);
}

function restoreSchedules() {
  const schedules = readJson(SCHEDULES_FILE, []);
  schedules.forEach((schedule) => {
    if (schedule.status === 'scheduled' || schedule.status === 'active') {
      registerSchedule(schedule);
    }
  });
}

async function startWhatsApp() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    socket = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: Browsers.ubuntu('AutoBroadcast'),
    });

    socket.ev.on('creds.update', saveCreds);

    socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        connectionStatus = 'qr';
        qrCodeData = await qrcode.toDataURL(qr);
      } else if (connection === 'open') {
        connectionStatus = 'connected';
        connectionError = '';
        qrCodeData = '';
        lastConnectedAt = new Date().toISOString();
      } else if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== 401;

        connectionStatus = shouldReconnect ? 'reconnecting' : 'disconnected';
        connectionError = lastDisconnect?.error?.message || 'Connection closed';

        if (shouldReconnect) {
          if (reconnectTimer) {
            clearTimeout(reconnectTimer);
          }

          reconnectTimer = setTimeout(() => {
            startWhatsApp().catch(() => {});
          }, 3000);
        }
      } else if (connection === 'connecting') {
        connectionStatus = 'connecting';
      }
    });

    socket.ev.on('messages.upsert', () => {});
  } catch (error) {
    connectionStatus = 'error';
    connectionError = error.message || 'Failed to start WhatsApp session';
  }
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    status: connectionStatus,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/status', (_req, res) => {
  res.json({
    status: connectionStatus,
    error: connectionError,
    qrCode: qrCodeData,
    lastConnectedAt,
  });
});

app.get('/api/contacts', (_req, res) => {
  const contacts = readJson(CONTACTS_FILE, []);
  res.json(contacts);
});

app.post('/api/contacts', (req, res) => {
  const { name, jid } = req.body;

  if (!name || !jid) {
    return res.status(400).json({ error: 'Name and WhatsApp number are required.' });
  }

  const contacts = readJson(CONTACTS_FILE, []);
  const newContact = {
    id: `${Date.now()}`,
    name,
    jid,
    active: true,
  };

  contacts.push(newContact);
  writeJson(CONTACTS_FILE, contacts);

  res.json(newContact);
});

app.delete('/api/contacts/:id', (req, res) => {
  const { id } = req.params;
  const contacts = readJson(CONTACTS_FILE, []);
  const filtered = contacts.filter((contact) => contact.id !== id);

  if (filtered.length === contacts.length) {
    return res.status(404).json({ error: 'Contact not found.' });
  }

  writeJson(CONTACTS_FILE, filtered);
  res.json({ success: true });
});

app.get('/api/history', (_req, res) => {
  const history = readJson(HISTORY_FILE, []);
  res.json(history);
});

app.get('/api/schedules', (_req, res) => {
  const schedules = readJson(SCHEDULES_FILE, []);
  res.json(schedules);
});

app.post('/api/schedules', (req, res) => {
  const { message, scheduledAt, frequency } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  if (!scheduledAt || !frequency) {
    return res.status(400).json({ error: 'Schedule date and frequency are required.' });
  }

  const schedule = {
    id: `schedule_${Date.now()}`,
    message: message.trim(),
    scheduledAt,
    frequency,
    status: 'scheduled',
    createdAt: new Date().toISOString(),
  };

  const schedules = readJson(SCHEDULES_FILE, []);
  schedules.unshift(schedule);
  saveSchedules(schedules);
  registerSchedule(schedule);

  res.json(schedule);
});

app.delete('/api/schedules/:id', (req, res) => {
  const { id } = req.params;
  const schedules = readJson(SCHEDULES_FILE, []);
  const filtered = schedules.filter((schedule) => schedule.id !== id);

  if (filtered.length === schedules.length) {
    return res.status(404).json({ error: 'Schedule not found.' });
  }

  const job = scheduledJobs.get(id);
  if (job) {
    if (job.stop) {
      job.stop();
    } else {
      clearTimeout(job);
    }
    scheduledJobs.delete(id);
  }

  saveSchedules(filtered);
  res.json({ success: true });
});

app.post('/api/broadcast', async (req, res) => {
  const { message } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  try {
    const result = await sendMessageBatch(message.trim());
    res.json(result);
  } catch (error) {
    res.status(503).json({ error: error.message });
  }
});

app.use((_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

ensureDataDir();
initializeDataFiles();

app.listen(PORT, async () => {
  console.log(`Server running at http://localhost:${PORT}`);
  await startWhatsApp();
  restoreSchedules();
});
