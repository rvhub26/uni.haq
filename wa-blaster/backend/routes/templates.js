const router = require('express').Router();
const { readJSON, writeJSON } = require('../store');

// Semua templates
router.get('/', (_req, res) => {
  res.json(readJSON('templates.json'));
});

// Simpan template baru
router.post('/', (req, res) => {
  const { name, text, mediaFile } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Nama template diperlukan' });
  if (!text || !text.trim()) return res.status(400).json({ error: 'Teks mesej diperlukan' });

  const list = readJSON('templates.json');
  const tmpl = {
    id: `tmpl_${Date.now()}`,
    name: name.trim(),
    text: text.trim(),
    mediaFile: mediaFile || null,
    createdAt: new Date().toISOString(),
  };
  list.push(tmpl);
  writeJSON('templates.json', list);
  res.json(tmpl);
});

// Kemaskini template
router.put('/:id', (req, res) => {
  const { name, text, mediaFile } = req.body;
  const list = readJSON('templates.json');
  const idx = list.findIndex(t => t.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Template tidak dijumpai' });

  list[idx] = { ...list[idx], name: name?.trim() || list[idx].name, text: text?.trim() || list[idx].text, mediaFile: mediaFile !== undefined ? mediaFile : list[idx].mediaFile };
  writeJSON('templates.json', list);
  res.json(list[idx]);
});

// Buang template
router.delete('/:id', (req, res) => {
  const list = readJSON('templates.json');
  const filtered = list.filter(t => t.id !== req.params.id);
  if (filtered.length === list.length) return res.status(404).json({ error: 'Template tidak dijumpai' });
  writeJSON('templates.json', filtered);
  res.json({ ok: true });
});

module.exports = router;
