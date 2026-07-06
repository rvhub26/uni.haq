const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
require('express-async-errors');
const session = require('express-session');
const { PORT } = require('./config');
const { connectDevice } = require('./whatsapp');
const { loadMetaDevice } = require('./meta-api');
const { restoreAllJobs } = require('./scheduler');
const devicesRepo = require('./repos/devices');
const logsRepo = require('./repos/logs');

const app = express();
app.use(express.json());

// Webhook Meta — mesti sebelum auth middleware
app.use('/api/webhook/whatsapp', require('./routes/webhook'));

app.use(session({
  secret: process.env.SESSION_SECRET || 'unihaq-secret-key-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 },
}));

// Auth + device context middleware
function requireAuth(req, res, next) {
  if (req.path.startsWith('/api/auth')) return next();
  if (req.session?.userId) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Sila log masuk dahulu' });
  next();
}
app.use(requireAuth);

// Auto-set deviceId in session if not set
app.use(async (req, res, next) => {
  if (req.session?.userId && !req.session.deviceId) {
    const devices = await devicesRepo.getForUser(req.session.userId);
    if (devices.length) req.session.deviceId = devices[0].id;
  }
  next();
});

app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/devices', require('./routes/devices'));
app.use('/api', require('./routes/whatsapp'));
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/media', require('./routes/media'));
app.use('/api/schedules', require('./routes/schedules'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/blacklist', require('./routes/blacklist'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/closing-bot', require('./routes/closing-bot'));

app.get('/api/logs', async (req, res) => {
  if (!req.session?.deviceId) return res.json([]);
  res.json(await logsRepo.getForDevice(req.session.deviceId));
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// Error handler global — elak crash proses bila route async throw
app.use((err, req, res, next) => {
  console.error(`[error] ${req.method} ${req.path}:`, err.message);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: err.message || 'Ralat server' });
});

// Connect semua devices yang dah ada untuk semua users
async function connectAllDevices() {
  const devices = await devicesRepo.getAllWithUser();
  for (const device of devices) {
    if (device.type === 'meta') {
      await loadMetaDevice(device.user_id, device.id);
    } else {
      await connectDevice(device.user_id, device.id).catch(e => {
        console.error(`Gagal connect ${device.user_id}::${device.id}:`, e.message);
      });
    }
  }
  console.log(`${devices.length} device(s) dimulakan`);
}

app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  await connectAllDevices();
  restoreAllJobs();
});
