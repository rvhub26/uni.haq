const path = require('path');
const queueRepo = require('./repos/queue');
const sentHistoryRepo = require('./repos/sentHistory');
const logsRepo = require('./repos/logs');
const devicesRepo = require('./repos/devices');
const { sendMessageDevice, sendMediaDevice, getDeviceStatus } = require('./whatsapp');
const { sendTextMeta, getMetaDeviceStatus } = require('./meta-api');
const { processTemplate } = require('./templateEngine');
const { UPLOAD_DIR } = require('./config');

// Random gap ±50% dari nilai yang dipilih (nampak macam manusia, bukan bot)
function randomGap(gapMs) {
  const min = gapMs * 0.6;
  const max = gapMs * 1.5;
  return Math.floor(min + Math.random() * (max - min));
}

// Bina array cumulative sendAt untuk semua contacts sekaligus
function buildSendTimes(count, now, gapMs, batchSize, batchGapMs) {
  const times = [];
  let t = now;
  for (let i = 0; i < count; i++) {
    times.push(t);
    if (batchSize && batchGapMs && batchSize > 0 && (i + 1) % batchSize === 0) {
      t += batchGapMs;
    } else {
      t += randomGap(gapMs);
    }
  }
  return times;
}

// Tambah contacts ke queue (single template atau rotation tanpa gap)
async function enqueueBlast({ userId, deviceId, scheduleId, contacts, templateText, mediaFile, templateId, gapMs, startAt, batchSize, batchGapMs }) {
  const sentHistory = templateId ? await sentHistoryRepo.getGroupedForDevice(deviceId) : {};
  const now = startAt || Date.now();

  const eligible = templateId
    ? contacts.filter(c => !(sentHistory[c.telefon] || []).includes(templateId))
    : contacts;

  const sendTimes = buildSendTimes(eligible.length, now, gapMs, batchSize, batchGapMs);

  const newItems = eligible.map((contact, i) => ({
    id: `q_${Date.now()}_${i}`,
    deviceId,
    scheduleId,
    nama: contact.nama,
    telefon: contact.telefon,
    templateId: templateId || null,
    templateText,
    mediaFile: mediaFile || null,
    sendAt: new Date(sendTimes[i]),
  }));

  if (newItems.length) await queueRepo.insertMany(newItems);
  return { queued: newItems.length, batches: batchSize ? Math.ceil(newItems.length / batchSize) : 1 };
}

// Queue rotation blast — semua template sekaligus dengan gap
async function enqueueRotationBlast({ userId, deviceId, scheduleId, contacts, templates, contactGapMs, templateGapMs, startAt, batchSize, batchGapMs }) {
  const sentHistory = await sentHistoryRepo.getGroupedForDevice(deviceId);
  const now = startAt || Date.now();
  let totalQueued = 0;
  const newItems = [];

  const sendTimes = buildSendTimes(contacts.length, now, contactGapMs, batchSize, batchGapMs);

  contacts.forEach((contact, contactIdx) => {
    const alreadySent = sentHistory[contact.telefon] || [];
    const unsentTemplates = templates.filter(t => !alreadySent.includes(t.id));
    if (!unsentTemplates.length) return;

    const baseTime = sendTimes[contactIdx];

    unsentTemplates.forEach((tmpl, tmplIdx) => {
      newItems.push({
        id: `q_${Date.now()}_c${contactIdx}_t${tmplIdx}_${Math.random().toString(36).slice(2, 6)}`,
        deviceId,
        scheduleId,
        nama: contact.nama,
        telefon: contact.telefon,
        templateId: tmpl.id,
        templateText: tmpl.text,
        mediaFile: tmpl.mediaFile || null,
        sendAt: new Date(baseTime + tmplIdx * templateGapMs),
      });
      totalQueued++;
    });
  });

  if (newItems.length) await queueRepo.insertMany(newItems);
  return { queued: totalQueued, batches: batchSize ? Math.ceil(contacts.length / batchSize) : 1 };
}

// Check sama ada device connected (support Baileys dan Meta)
async function isDeviceConnected(userId, deviceId) {
  const device = await devicesRepo.getById(deviceId);
  if (device?.type === 'meta') return getMetaDeviceStatus(userId, deviceId).connected;
  return getDeviceStatus(userId, deviceId).connected;
}

// Hantar mesej mengikut jenis device
async function sendMessage(userId, deviceId, telefon, text, mediaFile) {
  const device = await devicesRepo.getById(deviceId);

  if (device?.type === 'meta') {
    // Meta API — hantar teks sahaja (media belum disokong)
    return sendTextMeta(userId, deviceId, telefon, text);
  }

  // Baileys (unofficial)
  if (mediaFile) {
    return sendMediaDevice(userId, deviceId, telefon, path.join(__dirname, UPLOAD_DIR, mediaFile), text);
  }
  return sendMessageDevice(userId, deviceId, telefon, text);
}

// Proses queue untuk satu device
async function processQueue(userId, deviceId) {
  if (!(await isDeviceConnected(userId, deviceId))) return;

  const due = await queueRepo.getDuePending(deviceId);
  if (!due.length) return;

  for (const item of due) {
    let status = 'sent';
    let error = null;
    try {
      const text = processTemplate(item.template_text, { nama: item.nama, telefon: item.telefon });
      await sendMessage(userId, deviceId, item.telefon, text, item.media_file);
      await queueRepo.markSent(item.id);
      if (item.template_id) await sentHistoryRepo.record(deviceId, item.telefon, item.template_id);
    } catch (e) {
      status = 'failed';
      error = e.message;
      await queueRepo.markFailed(item.id, error);
    }

    await logsRepo.create({
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      deviceId,
      scheduleId: item.schedule_id,
      templateId: item.template_id || null,
      templateText: item.template_text,
      blastAt: new Date(),
      sent: status === 'sent' ? 1 : 0,
      failed: status === 'failed' ? 1 : 0,
      details: [{ nama: item.nama, telefon: item.telefon, status }],
    });
  }

  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  queueRepo.deleteOldProcessed(deviceId, cutoff).catch(() => {});
}

function getQueueStatus(userId, deviceId) {
  return queueRepo.getPendingForDevice(deviceId).then(rows => rows.map(q => ({
    id: q.id,
    nama: q.nama,
    telefon: q.telefon,
    templateId: q.template_id,
    sendAt: new Date(q.send_at).toISOString(),
    scheduleId: q.schedule_id,
  })));
}

function cancelQueueForSchedule(userId, deviceId, scheduleId) {
  return queueRepo.removePendingForSchedule(deviceId, scheduleId);
}

module.exports = { enqueueBlast, enqueueRotationBlast, processQueue, getQueueStatus, cancelQueueForSchedule };
