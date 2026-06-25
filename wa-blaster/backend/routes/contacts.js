const router = require('express').Router();
const multer = require('multer');
const XLSX = require('xlsx');
const { readDeviceJSON, readDeviceJSONObject, writeDeviceJSON } = require('../store');

const upload = multer({ storage: multer.memoryStorage() });

function ctx(req) {
  return { userId: req.session.userId, deviceId: req.session.deviceId };
}

function formatPhone(raw) {
  let num = String(raw).replace(/\D/g, '');
  if (num.startsWith('0')) num = '6' + num;
  if (!num.startsWith('60') || num.length < 10 || num.length > 13) return null;
  return num;
}

function requireDevice(req, res, next) {
  if (!req.session.deviceId) return res.status(400).json({ error: 'Pilih peranti WhatsApp dahulu' });
  next();
}

// Upload Excel
router.post('/upload', requireDevice, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Tiada fail dihantar' });
  const { userId, deviceId } = ctx(req);
  const kumpulan = (req.body.kumpulan || '').trim() || 'Umum';

  let rows;
  try {
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  } catch {
    return res.status(400).json({ error: 'Fail Excel tidak sah' });
  }

  const existing = readDeviceJSON(userId, deviceId, 'contacts.json');
  const added = [];
  const failed = [];

  rows.forEach((row, i) => {
    const nama = String(row['nama'] || row['Nama'] || '').trim();
    const rawPhone = row['telefon'] || row['Telefon'] || row['phone'] || '';
    const telefon = formatPhone(rawPhone);

    if (!nama || !telefon) {
      failed.push({ baris: i + 2, sebab: !nama ? 'Nama kosong' : 'Nombor tidak sah' });
      return;
    }

    added.push({ id: `${Date.now()}_${i}`, nama, telefon, kumpulan });
  });

  const merged = [...existing, ...added];
  writeDeviceJSON(userId, deviceId, 'contacts.json', merged);

  res.json({ berjaya: added.length, gagal: failed.length, gagal_senarai: failed, contacts: merged, kumpulan });
});

// Semua contacts
router.get('/', requireDevice, (req, res) => {
  const { userId, deviceId } = ctx(req);
  res.json(readDeviceJSON(userId, deviceId, 'contacts.json'));
});

// Buang satu contact
router.delete('/:id', requireDevice, (req, res) => {
  const { userId, deviceId } = ctx(req);
  if (req.params.id === 'all') {
    writeDeviceJSON(userId, deviceId, 'contacts.json', []);
    return res.json({ ok: true });
  }
  const list = readDeviceJSON(userId, deviceId, 'contacts.json');
  const filtered = list.filter(c => c.id !== req.params.id);
  if (filtered.length === list.length) return res.status(404).json({ error: 'Tidak dijumpai' });
  writeDeviceJSON(userId, deviceId, 'contacts.json', filtered);
  res.json({ ok: true });
});

// Buang semua contacts dalam kumpulan
router.delete('/group/:name', requireDevice, (req, res) => {
  const { userId, deviceId } = ctx(req);
  const name = decodeURIComponent(req.params.name);
  const list = readDeviceJSON(userId, deviceId, 'contacts.json');
  const filtered = list.filter(c => (c.kumpulan || 'Umum') !== name);
  writeDeviceJSON(userId, deviceId, 'contacts.json', filtered);
  res.json({ ok: true, buang: list.length - filtered.length });
});

// Kosongkan semua
router.delete('/', requireDevice, (req, res) => {
  const { userId, deviceId } = ctx(req);
  writeDeviceJSON(userId, deviceId, 'contacts.json', []);
  res.json({ ok: true });
});

// Sent history
router.get('/history', requireDevice, (req, res) => {
  const { userId, deviceId } = ctx(req);
  const history = readDeviceJSONObject(userId, deviceId, 'sent_history.json');
  const contacts = readDeviceJSON(userId, deviceId, 'contacts.json');
  const templates = require('./templates').getTemplates ? require('./templates').getTemplates(userId) : [];

  const result = Object.entries(history).map(([telefon, tmplIds]) => {
    const contact = contacts.find(c => c.telefon === telefon);
    return {
      telefon,
      nama: contact?.nama || '—',
      kumpulan: contact?.kumpulan || '—',
      templatesDihantar: tmplIds.length,
      templates: tmplIds.map(id => ({ id, name: templates.find(t => t.id === id)?.name || '(dipadam)' })),
    };
  });

  res.json(result);
});

// Reset sent history untuk kumpulan
router.delete('/history/group/:name', requireDevice, (req, res) => {
  const { userId, deviceId } = ctx(req);
  const kumpulan = decodeURIComponent(req.params.name);
  const contacts = readDeviceJSON(userId, deviceId, 'contacts.json');
  const history = readDeviceJSONObject(userId, deviceId, 'sent_history.json');
  contacts.filter(c => (c.kumpulan || 'Umum') === kumpulan).forEach(c => { delete history[c.telefon]; });
  writeDeviceJSON(userId, deviceId, 'sent_history.json', history);
  res.json({ ok: true });
});

// Reset semua history
router.delete('/history', requireDevice, (req, res) => {
  const { userId, deviceId } = ctx(req);
  writeDeviceJSON(userId, deviceId, 'sent_history.json', {});
  res.json({ ok: true });
});

module.exports = router;
