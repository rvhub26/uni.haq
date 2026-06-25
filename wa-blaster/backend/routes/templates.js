const router = require('express').Router();
const { readUserJSON, writeUserJSON } = require('../store');

function getTemplates(userId) { return readUserJSON(userId, 'templates.json'); }

// Semua templates (per-user, shared across devices)
router.get('/', (req, res) => {
  res.json(getTemplates(req.session.userId));
});

// Simpan template baru
router.post('/', (req, res) => {
  const { name, text, mediaFile } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nama template diperlukan' });
  if (!text?.trim()) return res.status(400).json({ error: 'Teks mesej diperlukan' });

  const list = getTemplates(req.session.userId);
  const tmpl = {
    id: `tmpl_${Date.now()}`,
    name: name.trim(),
    text: text.trim(),
    mediaFile: mediaFile || null,
    createdAt: new Date().toISOString(),
  };
  list.push(tmpl);
  writeUserJSON(req.session.userId, 'templates.json', list);
  res.json(tmpl);
});

// Kemaskini template
router.put('/:id', (req, res) => {
  const { name, text, mediaFile } = req.body;
  const list = getTemplates(req.session.userId);
  const idx = list.findIndex(t => t.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Template tidak dijumpai' });

  list[idx] = {
    ...list[idx],
    name: name?.trim() || list[idx].name,
    text: text?.trim() || list[idx].text,
    mediaFile: mediaFile !== undefined ? mediaFile : list[idx].mediaFile,
  };
  writeUserJSON(req.session.userId, 'templates.json', list);
  res.json(list[idx]);
});

// Buang template
router.delete('/:id', (req, res) => {
  const list = getTemplates(req.session.userId);
  const filtered = list.filter(t => t.id !== req.params.id);
  if (filtered.length === list.length) return res.status(404).json({ error: 'Template tidak dijumpai' });
  writeUserJSON(req.session.userId, 'templates.json', filtered);
  res.json({ ok: true });
});

module.exports = router;
module.exports.getTemplates = getTemplates;
