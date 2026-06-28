const router = require('express').Router();
const { readDeviceJSON, writeDeviceJSON } = require('../store');
const { scheduleJob, cancelJob, runBlast } = require('../scheduler');

function requireDevice(req, res, next) {
  if (!req.session.deviceId) return res.status(400).json({ error: 'Pilih peranti WhatsApp dahulu' });
  next();
}

function ctx(req) { return { userId: req.session.userId, deviceId: req.session.deviceId }; }

router.post('/', requireDevice, (req, res) => {
  const { userId, deviceId } = ctx(req);
  const { template, mediaFile, type, datetime, pattern, contacts, useRotation, templateIds, contactGapMs, templateGapMs, batchSize, batchGapMs, historyOnly } = req.body;

  if (!type || !['one-time', 'recurring'].includes(type)) return res.status(400).json({ error: 'Jenis jadual tidak sah' });
  if (type === 'one-time' && !datetime) return res.status(400).json({ error: 'Tarikh & masa diperlukan' });
  if (type === 'recurring' && !pattern?.time) return res.status(400).json({ error: 'Masa diperlukan' });

  if (useRotation) {
    if (!templateIds?.length) return res.status(400).json({ error: 'Pilih sekurang-kurangnya satu template untuk rotation' });
  } else {
    if (!template?.trim()) return res.status(400).json({ error: 'Template mesej diperlukan' });
  }

  const schedule = {
    id: `sch_${Date.now()}`,
    userId,
    deviceId,
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
    batchSize: (batchSize && batchSize > 0) ? parseInt(batchSize) : 0,
    batchGapMs: batchGapMs || 0,
    historyOnly: !!historyOnly,
    status: 'active',
    createdAt: new Date().toISOString(),
  };

  const list = readDeviceJSON(userId, deviceId, 'schedules.json');
  list.push(schedule);
  writeDeviceJSON(userId, deviceId, 'schedules.json', list);
  scheduleJob(schedule, userId, deviceId);
  res.json(schedule);
});

router.get('/', requireDevice, (req, res) => {
  const { userId, deviceId } = ctx(req);
  res.json(readDeviceJSON(userId, deviceId, 'schedules.json'));
});

router.delete('/:id', requireDevice, (req, res) => {
  const { userId, deviceId } = ctx(req);
  const list = readDeviceJSON(userId, deviceId, 'schedules.json');
  const filtered = list.filter(s => s.id !== req.params.id);
  if (filtered.length === list.length) return res.status(404).json({ error: 'Jadual tidak dijumpai' });
  writeDeviceJSON(userId, deviceId, 'schedules.json', filtered);
  cancelJob(req.params.id);
  res.json({ ok: true });
});

router.get('/logs', requireDevice, (req, res) => {
  const { userId, deviceId } = ctx(req);
  res.json(readDeviceJSON(userId, deviceId, 'logs.json'));
});

router.delete('/logs', requireDevice, (req, res) => {
  const { userId, deviceId } = ctx(req);
  writeDeviceJSON(userId, deviceId, 'logs.json', []);
  res.json({ ok: true });
});

router.get('/queue', requireDevice, (req, res) => {
  const { userId, deviceId } = ctx(req);
  const { getQueueStatus } = require('../queue');
  res.json(getQueueStatus(userId, deviceId));
});

router.delete('/:id/queue', requireDevice, (req, res) => {
  const { userId, deviceId } = ctx(req);
  const { cancelQueueForSchedule } = require('../queue');
  cancelQueueForSchedule(userId, deviceId, req.params.id);
  res.json({ ok: true });
});

router.post('/:id/blast-now', requireDevice, async (req, res) => {
  const { userId, deviceId } = ctx(req);
  const schedule = readDeviceJSON(userId, deviceId, 'schedules.json').find(s => s.id === req.params.id);
  if (!schedule) return res.status(404).json({ error: 'Jadual tidak dijumpai' });
  cancelJob(req.params.id);
  try {
    res.json(await runBlast(schedule, userId, deviceId));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
