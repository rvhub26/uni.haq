const router = require('express').Router();
const multer = require('multer');
const XLSX = require('xlsx');
const contactsRepo = require('../repos/contacts');
const templatesRepo = require('../repos/templates');
const sentHistoryRepo = require('../repos/sentHistory');
const devicesRepo = require('../repos/devices');
const { getChatHistory } = require('../whatsapp');

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

async function requireDevice(req, res, next) {
  if (!req.session.deviceId) {
    // Auto-pilih device pertama kalau ada
    const devices = await devicesRepo.getForUser(req.session.userId);
    if (!devices.length) {
      return res.status(400).json({ error: 'Tambah peranti WhatsApp dahulu di tab Peranti' });
    }
    req.session.deviceId = devices[0].id;
    return req.session.save(() => next());
  }
  next();
}

// Upload Excel
router.post('/upload', requireDevice, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Tiada fail dihantar' });
  const { deviceId } = ctx(req);
  const kumpulan = (req.body.kumpulan || '').trim() || 'Umum';

  let rows;
  try {
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  } catch {
    return res.status(400).json({ error: 'Fail Excel tidak sah' });
  }

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

  await contactsRepo.upsertMany(deviceId, added);
  const merged = await contactsRepo.getForDevice(deviceId);

  res.json({ berjaya: added.length, gagal: failed.length, gagal_senarai: failed, contacts: merged, kumpulan });
});

// Semua contacts (dengan hasHistory flag)
router.get('/', requireDevice, async (req, res) => {
  const { userId, deviceId } = ctx(req);
  const contacts = await contactsRepo.getForDevice(deviceId);
  const historySet = new Set(await getChatHistory(userId, deviceId));
  const result = contacts.map(c => ({ ...c, hasHistory: historySet.has(c.telefon) }));
  res.json(result);
});

// Jumlah chat history yang disync
router.get('/chat-history/count', requireDevice, async (req, res) => {
  const { userId, deviceId } = ctx(req);
  const history = await getChatHistory(userId, deviceId);
  res.json({ count: history.length });
});

// Buang satu contact
router.delete('/:id', requireDevice, async (req, res) => {
  const { deviceId } = ctx(req);
  if (req.params.id === 'all') {
    const all = await contactsRepo.getForDevice(deviceId);
    await contactsRepo.removeMany(all.map(c => c.id));
    return res.json({ ok: true });
  }
  const contact = await contactsRepo.getById(req.params.id);
  if (!contact || contact.device_id !== deviceId) return res.status(404).json({ error: 'Tidak dijumpai' });
  await contactsRepo.remove(req.params.id);
  res.json({ ok: true });
});

// Buang semua contacts dalam kumpulan
router.delete('/group/:name', requireDevice, async (req, res) => {
  const { deviceId } = ctx(req);
  const name = decodeURIComponent(req.params.name);
  const list = await contactsRepo.getForDevice(deviceId);
  const toRemove = list.filter(c => (c.kumpulan || 'Umum') === name);
  await contactsRepo.removeMany(toRemove.map(c => c.id));
  res.json({ ok: true, buang: toRemove.length });
});

// Kosongkan semua
router.delete('/', requireDevice, async (req, res) => {
  const { deviceId } = ctx(req);
  const all = await contactsRepo.getForDevice(deviceId);
  await contactsRepo.removeMany(all.map(c => c.id));
  res.json({ ok: true });
});

// Sent history
router.get('/history', requireDevice, async (req, res) => {
  const { userId, deviceId } = ctx(req);
  const history = await sentHistoryRepo.getGroupedForDevice(deviceId);
  const contacts = await contactsRepo.getForDevice(deviceId);
  const templates = await templatesRepo.getForUser(userId);

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
router.delete('/history/group/:name', requireDevice, async (req, res) => {
  const { deviceId } = ctx(req);
  const kumpulan = decodeURIComponent(req.params.name);
  const contacts = await contactsRepo.getForDevice(deviceId);
  const phones = contacts.filter(c => (c.kumpulan || 'Umum') === kumpulan).map(c => c.telefon);
  await sentHistoryRepo.removeForPhones(deviceId, phones);
  res.json({ ok: true });
});

// Reset semua history
router.delete('/history', requireDevice, async (req, res) => {
  const { deviceId } = ctx(req);
  await sentHistoryRepo.removeAllForDevice(deviceId);
  res.json({ ok: true });
});

module.exports = router;
