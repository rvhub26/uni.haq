const express = require('express');
const path = require('path');
const { PORT } = require('./config');
const { connectWhatsApp } = require('./whatsapp');
const { restoreJobs } = require('./scheduler');

const app = express();
app.use(express.json());

// Serve frontend
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Routes
app.use('/api', require('./routes/whatsapp'));
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/media', require('./routes/media'));
app.use('/api/schedules', require('./routes/schedules'));
app.use('/api/templates', require('./routes/templates'));
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
