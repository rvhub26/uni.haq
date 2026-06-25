const path = require('path');
const { readDeviceJSON, readDeviceJSONObject, writeDeviceJSON } = require('./store');
const { sendMessageDevice, sendMediaDevice, getDeviceStatus } = require('./whatsapp');
const { processTemplate } = require('./templateEngine');
const { UPLOAD_DIR } = require('./config');

// Tambah contacts ke queue (single template atau rotation tanpa gap)
function enqueueBlast({ userId, deviceId, scheduleId, contacts, templateText, mediaFile, templateId, gapMs, startAt }) {
  const queue = readDeviceJSON(userId, deviceId, 'queue.json');
  const sentHistory = readDeviceJSONObject(userId, deviceId, 'sent_history.json');
  const now = startAt || Date.now();

  const eligible = templateId
    ? contacts.filter(c => !(sentHistory[c.telefon] || []).includes(templateId))
    : contacts;

  const newItems = eligible.map((contact, i) => ({
    id: `q_${Date.now()}_${i}`,
    userId,
    deviceId,
    scheduleId,
    nama: contact.nama,
    telefon: contact.telefon,
    templateId: templateId || null,
    templateText,
    mediaFile: mediaFile || null,
    sendAt: now + i * gapMs,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }));

  queue.push(...newItems);
  writeDeviceJSON(userId, deviceId, 'queue.json', queue);
  return newItems.length;
}

// Queue rotation blast — semua template sekaligus dengan gap
function enqueueRotationBlast({ userId, deviceId, scheduleId, contacts, templates, contactGapMs, templateGapMs, startAt }) {
  const queue = readDeviceJSON(userId, deviceId, 'queue.json');
  const sentHistory = readDeviceJSONObject(userId, deviceId, 'sent_history.json');
  const now = startAt || Date.now();
  let totalQueued = 0;

  contacts.forEach((contact, contactIdx) => {
    const alreadySent = sentHistory[contact.telefon] || [];
    const unsentTemplates = templates.filter(t => !alreadySent.includes(t.id));
    if (!unsentTemplates.length) return;

    unsentTemplates.forEach((tmpl, tmplIdx) => {
      queue.push({
        id: `q_${Date.now()}_c${contactIdx}_t${tmplIdx}_${Math.random().toString(36).slice(2, 6)}`,
        userId,
        deviceId,
        scheduleId,
        nama: contact.nama,
        telefon: contact.telefon,
        templateId: tmpl.id,
        templateText: tmpl.text,
        mediaFile: tmpl.mediaFile || null,
        sendAt: now + contactIdx * contactGapMs + tmplIdx * templateGapMs,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
      totalQueued++;
    });
  });

  writeDeviceJSON(userId, deviceId, 'queue.json', queue);
  return totalQueued;
}

// Proses queue untuk satu device
async function processQueue(userId, deviceId) {
  if (!getDeviceStatus(userId, deviceId).connected) return;

  const queue = readDeviceJSON(userId, deviceId, 'queue.json');
  const now = Date.now();
  const due = queue.filter(q => q.status === 'pending' && q.sendAt <= now);
  if (!due.length) return;

  const historyUpdates = {};

  for (const item of due) {
    try {
      const text = processTemplate(item.templateText, { nama: item.nama, telefon: item.telefon });
      if (item.mediaFile) {
        await sendMediaDevice(userId, deviceId, item.telefon, path.join(__dirname, UPLOAD_DIR, item.mediaFile), text);
      } else {
        await sendMessageDevice(userId, deviceId, item.telefon, text);
      }
      item.status = 'sent';
      item.sentAt = new Date().toISOString();

      if (item.templateId) {
        if (!historyUpdates[item.telefon]) historyUpdates[item.telefon] = [];
        if (!historyUpdates[item.telefon].includes(item.templateId)) {
          historyUpdates[item.telefon].push(item.templateId);
        }
      }
    } catch (e) {
      item.status = 'failed';
      item.error = e.message;
    }

    const logs = readDeviceJSON(userId, deviceId, 'logs.json');
    logs.unshift({
      id: `log_${Date.now()}`,
      scheduleId: item.scheduleId,
      templateId: item.templateId || null,
      template: item.templateText,
      blastAt: new Date().toISOString(),
      sent: item.status === 'sent' ? 1 : 0,
      failed: item.status === 'failed' ? 1 : 0,
      details: [{ nama: item.nama, telefon: item.telefon, status: item.status }],
    });
    writeDeviceJSON(userId, deviceId, 'logs.json', logs.slice(0, 200));
  }

  if (Object.keys(historyUpdates).length) {
    const history = readDeviceJSONObject(userId, deviceId, 'sent_history.json');
    Object.entries(historyUpdates).forEach(([phone, tmplIds]) => {
      if (!history[phone]) history[phone] = [];
      tmplIds.forEach(id => { if (!history[phone].includes(id)) history[phone].push(id); });
    });
    writeDeviceJSON(userId, deviceId, 'sent_history.json', history);
  }

  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const updated = queue.map(q => due.find(d => d.id === q.id) || q)
    .filter(q => !(q.status !== 'pending' && new Date(q.createdAt).getTime() < cutoff));
  writeDeviceJSON(userId, deviceId, 'queue.json', updated);
}

function getQueueStatus(userId, deviceId) {
  const queue = readDeviceJSON(userId, deviceId, 'queue.json');
  return queue.filter(q => q.status === 'pending').map(q => ({
    id: q.id,
    nama: q.nama,
    telefon: q.telefon,
    templateId: q.templateId,
    sendAt: new Date(q.sendAt).toISOString(),
    scheduleId: q.scheduleId,
  }));
}

function cancelQueueForSchedule(userId, deviceId, scheduleId) {
  const queue = readDeviceJSON(userId, deviceId, 'queue.json');
  writeDeviceJSON(userId, deviceId, 'queue.json',
    queue.filter(q => !(q.scheduleId === scheduleId && q.status === 'pending'))
  );
}

module.exports = { enqueueBlast, enqueueRotationBlast, processQueue, getQueueStatus, cancelQueueForSchedule };
