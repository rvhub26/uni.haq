const router = require('express').Router();
const schedulesRepo = require('../repos/schedules');
const logsRepo = require('../repos/logs');
const { scheduleJob, cancelJob, runBlast } = require('../scheduler');
const { getQueueStatus, cancelQueueForSchedule } = require('../queue');

function requireDevice(req, res, next) {
  if (!req.session.deviceId) return res.status(400).json({ error: 'Pilih peranti WhatsApp dahulu' });
  next();
}

function ctx(req) { return { userId: req.session.userId, deviceId: req.session.deviceId }; }

function toApi(s) {
  return {
    id: s.id, userId: undefined, deviceId: s.device_id,
    useRotation: !!s.use_rotation,
    templateIds: s.template_ids ? (typeof s.template_ids === 'string' ? JSON.parse(s.template_ids) : s.template_ids) : null,
    rotationIndex: s.rotation_index,
    template: s.template, mediaFile: s.media_file,
    type: s.type, datetime: s.datetime,
    pattern: s.pattern ? (typeof s.pattern === 'string' ? JSON.parse(s.pattern) : s.pattern) : null,
    contacts: s.contacts ? (typeof s.contacts === 'string' ? JSON.parse(s.contacts) : s.contacts) : 'all',
    contactGapMs: s.contact_gap_ms, templateGapMs: s.template_gap_ms,
    batchSize: s.batch_size, batchGapMs: s.batch_gap_ms,
    historyOnly: !!s.history_only, status: s.status, createdAt: s.created_at,
  };
}

router.post('/', requireDevice, async (req, res) => {
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
    useRotation: !!useRotation,
    templateIds: useRotation ? templateIds : [],
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
  };

  const saved = await schedulesRepo.create(deviceId, schedule);
  scheduleJob(saved, userId, deviceId);
  res.json(toApi(saved));
});

router.get('/', requireDevice, async (req, res) => {
  const { deviceId } = ctx(req);
  const list = await schedulesRepo.getForDevice(deviceId);
  res.json(list.map(toApi));
});

router.delete('/:id', requireDevice, async (req, res) => {
  const { deviceId } = ctx(req);
  const existing = await schedulesRepo.getById(req.params.id);
  if (!existing || existing.device_id !== deviceId) return res.status(404).json({ error: 'Jadual tidak dijumpai' });
  await schedulesRepo.remove(req.params.id);
  cancelJob(req.params.id);
  res.json({ ok: true });
});

router.get('/logs', requireDevice, async (req, res) => {
  const { deviceId } = ctx(req);
  const logs = await logsRepo.getForDevice(deviceId);
  res.json(logs.map(l => ({
    id: l.id, scheduleId: l.schedule_id, templateId: l.template_id, template: l.template_text,
    blastAt: l.blast_at, sent: l.sent, failed: l.failed,
    details: typeof l.details === 'string' ? JSON.parse(l.details) : l.details,
  })));
});

router.delete('/logs', requireDevice, async (req, res) => {
  const { deviceId } = ctx(req);
  await logsRepo.removeAllForDevice(deviceId);
  res.json({ ok: true });
});

router.get('/queue', requireDevice, async (req, res) => {
  const { userId, deviceId } = ctx(req);
  res.json(await getQueueStatus(userId, deviceId));
});

router.delete('/:id/queue', requireDevice, async (req, res) => {
  const { userId, deviceId } = ctx(req);
  await cancelQueueForSchedule(userId, deviceId, req.params.id);
  res.json({ ok: true });
});

router.post('/:id/blast-now', requireDevice, async (req, res) => {
  const { userId, deviceId } = ctx(req);
  const schedule = await schedulesRepo.getById(req.params.id);
  if (!schedule || schedule.device_id !== deviceId) return res.status(404).json({ error: 'Jadual tidak dijumpai' });
  cancelJob(req.params.id);
  try {
    res.json(await runBlast(schedule, userId, deviceId));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
