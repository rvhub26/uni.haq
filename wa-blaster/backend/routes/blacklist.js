const router = require('express').Router();
const { readJSON, writeJSON } = require('../store');

// Semua blacklist
router.get('/', (_req, res) => {
  res.json(readJSON('blacklist.json'));
});

// Tambah ke blacklist
router.post('/', (req, res) => {
  const { telefon, nama, sebab } = req.body;
  if (!telefon) return res.status(400).json({ error: 'Nombor telefon diperlukan' });

  const list = readJSON('blacklist.json');
  if (list.find(b => b.telefon === telefon)) {
    return res.status(409).json({ error: 'Nombor ini dah dalam blacklist' });
  }

  const entry = {
    telefon,
    nama: nama || '—',
    sebab: sebab || '',
    addedAt: new Date().toISOString(),
  };

  list.push(entry);
  writeJSON('blacklist.json', list);
  res.json(entry);
});

// Buang dari blacklist
router.delete('/:telefon', (req, res) => {
  const telefon = decodeURIComponent(req.params.telefon);
  const list = readJSON('blacklist.json');
  const filtered = list.filter(b => b.telefon !== telefon);
  if (filtered.length === list.length) return res.status(404).json({ error: 'Tidak dijumpai dalam blacklist' });
  writeJSON('blacklist.json', filtered);
  res.json({ ok: true });
});

module.exports = router;
