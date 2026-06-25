const router = require('express').Router();
const multer = require('multer');
const XLSX = require('xlsx');
const { readJSON, readJSONObject, writeJSON } = require('../store');

const upload = multer({ storage: multer.memoryStorage() });

function formatPhone(raw) {
  let num = String(raw).replace(/\D/g, '');
  if (num.startsWith('0')) num = '6' + num;
  if (!num.startsWith('60') || num.length < 10 || num.length > 13) return null;
  return num;
}

// Upload Excel dengan nama kumpulan
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Tiada fail dihantar' });

  const kumpulan = (req.body.kumpulan || '').trim() || 'Umum';

  let rows;
  try {
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  } catch {
    return res.status(400).json({ error: 'Fail Excel tidak sah' });
  }

  const existing = readJSON('contacts.json');
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

    added.push({
      id: `${Date.now()}_${i}`,
      nama,
      telefon,
      kumpulan,
    });
  });

  const merged = [...existing, ...added];
  writeJSON('contacts.json', merged);

  res.json({
    berjaya: added.length,
    gagal: failed.length,
    gagal_senarai: failed,
    contacts: merged,
    kumpulan,
  });
});

// Semua contacts
router.get('/', (_req, res) => {
  res.json(readJSON('contacts.json'));
});

// Buang satu contact
router.delete('/:id', (req, res) => {
  if (req.params.id === 'all') {
    writeJSON('contacts.json', []);
    return res.json({ ok: true });
  }
  const list = readJSON('contacts.json');
  const filtered = list.filter(c => c.id !== req.params.id);
  if (filtered.length === list.length) return res.status(404).json({ error: 'Tidak dijumpai' });
  writeJSON('contacts.json', filtered);
  res.json({ ok: true });
});

// Buang semua contacts dalam satu kumpulan
router.delete('/group/:name', (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const list = readJSON('contacts.json');
  const filtered = list.filter(c => (c.kumpulan || 'Umum') !== name);
  writeJSON('contacts.json', filtered);
  res.json({ ok: true, buang: list.length - filtered.length });
});

// Kosongkan semua
router.delete('/', (_req, res) => {
  writeJSON('contacts.json', []);
  res.json({ ok: true });
});

// Lihat sent history (berapa template dah hantar per nombor)
router.get('/history', (_req, res) => {
  const history = readJSONObject('sent_history.json');
  const contacts = readJSON('contacts.json');
  const templates = readJSON('templates.json');

  const result = Object.entries(history).map(([telefon, tmplIds]) => {
    const contact = contacts.find(c => c.telefon === telefon);
    return {
      telefon,
      nama: contact?.nama || '—',
      kumpulan: contact?.kumpulan || '—',
      templatesDihantar: tmplIds.length,
      templates: tmplIds.map(id => {
        const t = templates.find(t => t.id === id);
        return { id, name: t?.name || '(template dipadam)' };
      }),
    };
  });

  res.json(result);
});

// Reset sent history untuk satu kumpulan
router.delete('/history/group/:name', (req, res) => {
  const kumpulan = decodeURIComponent(req.params.name);
  const contacts = readJSON('contacts.json');
  const history = readJSONObject('sent_history.json');

  const phonesInGroup = contacts
    .filter(c => (c.kumpulan || 'Umum') === kumpulan)
    .map(c => c.telefon);

  phonesInGroup.forEach(phone => { delete history[phone]; });
  writeJSON('sent_history.json', history);

  res.json({ ok: true, reset: phonesInGroup.length });
});

// Reset sent history untuk semua
router.delete('/history', (_req, res) => {
  writeJSON('sent_history.json', {});
  res.json({ ok: true });
});

module.exports = router;
