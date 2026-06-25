const express = require('express');
const path = require('path');
const session = require('express-session');
const { PORT } = require('./config');
const { connectDevice } = require('./whatsapp');
const { restoreAllJobs } = require('./scheduler');
const { readJSON, readUserJSON } = require('./store');

const app = express();
app.use(express.json());

app.use(session({
  secret: 'unihaq-secret-key-2026',
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
app.use((req, res, next) => {
  if (req.session?.userId && !req.session.deviceId) {
    const devices = readUserJSON(req.session.userId, 'devices.json');
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

app.get('/api/logs', (req, res) => {
  if (!req.session?.deviceId) return res.json([]);
  const { readDeviceJSON } = require('./store');
  res.json(readDeviceJSON(req.session.userId, req.session.deviceId, 'logs.json'));
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// Connect semua devices yang dah ada untuk semua users
async function connectAllDevices() {
  const users = readJSON('users.json');
  for (const user of users) {
    const devices = readUserJSON(user.id, 'devices.json');
    for (const device of devices) {
      await connectDevice(user.id, device.id).catch(e => {
        console.error(`Gagal connect ${user.id}::${device.id}:`, e.message);
      });
    }
  }
  console.log(`${users.reduce((t, u) => t + readUserJSON(u.id, 'devices.json').length, 0)} device(s) dimulakan`);
}

app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  await connectAllDevices();
  restoreAllJobs();
});
