const router = require('express').Router();
const multer = require('multer');
const XLSX = require('xlsx');
const { readJSON, writeJSON } = require('../store');

// Multer — simpan dalam memory (tak perlu tulis ke disk)
const upload = multer({ storage: multer.memoryStorage() });

// Validate & format nombor telefon Malaysia
function formatPhone(raw) {
  let num = String(raw).replace(/\D/g, '');
  // Tukar 011... / 012... → 6011... / 6012...
  if (num.startsWith('0')) num = '6' + num;
  // Mesti mula dengan 60 dan panjang 10-12 digit
  if (!num.startsWith('60') || num.length < 10 || num.length > 13) return null;
  return num;
}

// Upload Excel
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Tiada fail dihantar' });

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
    });
  });

  const merged = [...existing, ...added];
  writeJSON('contacts.json', merged);

  res.json({
    berjaya: added.length,
    gagal: failed.length,
    gagal_senarai: failed,
    contacts: merged,
  });
});

// Semua contacts
router.get('/', (_req, res) => {
  res.json(readJSON('contacts.json'));
});

// Buang satu contact
router.delete('/:id', (req, res) => {
  const list = readJSON('contacts.json');
  const filtered = list.filter(c => c.id !== req.params.id);
  if (filtered.length === list.length) return res.status(404).json({ error: 'Tidak dijumpai' });
  writeJSON('contacts.json', filtered);
  res.json({ ok: true });
});

// Kosongkan semua
router.delete('/', (_req, res) => {
  writeJSON('contacts.json', []);
  res.json({ ok: true });
});

module.exports = router;
