const router = require('express').Router();
const templatesRepo = require('../repos/templates');

function toApi(t) {
  return { id: t.id, name: t.name, text: t.text, mediaFile: t.media_file, createdAt: t.created_at };
}

// Semua templates (per-user, shared across devices)
router.get('/', async (req, res) => {
  const list = await templatesRepo.getForUser(req.session.userId);
  res.json(list.map(toApi));
});

// Simpan template baru
router.post('/', async (req, res) => {
  const { name, text, mediaFile } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nama template diperlukan' });
  if (!text?.trim()) return res.status(400).json({ error: 'Teks mesej diperlukan' });

  const tmpl = await templatesRepo.create(req.session.userId, {
    id: `tmpl_${Date.now()}`,
    name: name.trim(),
    text: text.trim(),
    mediaFile: mediaFile || null,
  });
  res.json(toApi(tmpl));
});

// Kemaskini template
router.put('/:id', async (req, res) => {
  const existing = await templatesRepo.getById(req.params.id);
  if (!existing || existing.user_id !== req.session.userId) return res.status(404).json({ error: 'Template tidak dijumpai' });

  const { name, text, mediaFile } = req.body;
  const updated = await templatesRepo.update(req.params.id, {
    name: name?.trim() || existing.name,
    text: text?.trim() || existing.text,
    mediaFile: mediaFile !== undefined ? mediaFile : existing.media_file,
  });
  res.json(toApi(updated));
});

// Buang template
router.delete('/:id', async (req, res) => {
  const existing = await templatesRepo.getById(req.params.id);
  if (!existing || existing.user_id !== req.session.userId) return res.status(404).json({ error: 'Template tidak dijumpai' });
  await templatesRepo.remove(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
