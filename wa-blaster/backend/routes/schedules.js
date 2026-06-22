const router = require('express').Router();
const { readJSON, writeJSON } = require('../store');
const { scheduleJob, cancelJob, runBlast } = require('../scheduler');

router.post('/', (req, res) => {
  const { template, mediaFile, type, datetime, pattern, contacts, useRotation, templateIds, contactGapMs, templateGapMs } = req.body;

  if (!type || !['one-time', 'recurring'].includes(type)) return res.status(400).json({ error: 'Jenis jadual tidak sah' });
  if (type === 'one-time' && !datetime) return res.status(400).json({ error: 'Tarikh & masa diperlukan' });
  if (type === 'recurring' && !pattern?.time) return res.status(400).json({ error: 'Masa diperlukan' });

  if (useRotation) {
    if (!templateIds?.length) return res.status(400).json({ error: 'Pilih sekurang-kurangnya satu template untuk rotation' });
  } else {
    if (!template || !template.trim()) return res.status(400).json({ error: 'Template mesej diperlukan' });
  }

  const schedule = {
    id: `sch_${Date.now()}`,
    useRotation: !!useRotation,
    templateIds: useRotation ? templateIds : null,
    rotationIndex: 0,
    template: useRotation ? null : template?.trim(),
    mediaFile: useRotation ? null : (mediaFile || null),
    type,
    datetime: datetime || null,
    pattern: pattern || null,
    contacts: contacts || 'all',
    contactGapMs: contactGapMs || 4000,
    templateGapMs: templateGapMs || 0,
    status: 'active',
    createdAt: new Date().toISOString(),
  };

  const list = readJSON('schedules.json');
  list.push(schedule);
  writeJSON('schedules.json', list);
  scheduleJob(schedule);
  res.json(schedule);
});

router.get('/', (_req, res) => res.json(readJSON('schedules.json')));

router.delete('/:id', (req, res) => {
  const list = readJSON('schedules.json');
  const filtered = list.filter(s => s.id !== req.params.id);
  if (filtered.length === list.length) return res.status(404).json({ error: 'Jadual tidak dijumpai' });
  writeJSON('schedules.json', filtered);
  cancelJob(req.params.id);
  res.json({ ok: true });
});

router.get('/logs', (_req, res) => res.json(readJSON('logs.json')));
router.delete('/logs', (_req, res) => { writeJSON('logs.json', []); res.json({ ok: true }); });
router.get('/queue', (_req, res) => {
  const { getQueueStatus } = require('../queue');
  res.json(getQueueStatus());
});
router.delete('/:id/queue', (req, res) => {
  const { cancelQueueForSchedule } = require('../queue');
  cancelQueueForSchedule(req.params.id);
  res.json({ ok: true });
});

router.post('/:id/blast-now', async (req, res) => {
  const schedule = readJSON('schedules.json').find(s => s.id === req.params.id);
  if (!schedule) return res.status(404).json({ error: 'Jadual tidak dijumpai' });
  cancelJob(req.params.id); // cancel pending timeout supaya tak double-blast
  try {
    res.json(await runBlast(schedule));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
