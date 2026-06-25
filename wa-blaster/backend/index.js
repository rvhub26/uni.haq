const express = require('express');
const path = require('path');
const session = require('express-session');
const { PORT } = require('./config');
const { connectWhatsApp } = require('./whatsapp');
const { restoreJobs } = require('./scheduler');

const app = express();
app.use(express.json());

// Session middleware
app.use(session({
  secret: 'unihaq-secret-key-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }, // 7 hari
}));

// Auth middleware — protect semua API kecuali /api/auth/*
function requireAuth(req, res, next) {
  if (req.path.startsWith('/api/auth')) return next(); // allow auth routes
  if (req.session?.userId) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Sila log masuk dahulu' });
  next(); // bagi static files lalu dulu
}
app.use(requireAuth);

// Serve frontend static files
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/whatsapp'));
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/media', require('./routes/media'));
app.use('/api/schedules', require('./routes/schedules'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/blacklist', require('./routes/blacklist'));
app.use('/api/reports', require('./routes/reports'));
app.get('/api/logs', (_req, res) => {
  const { readJSON } = require('./store');
  res.json(readJSON('logs.json'));
});

// Fallback ke frontend
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  await connectWhatsApp();
  restoreJobs();
});
