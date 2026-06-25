const path = require('path');
const { readJSON, readJSONObject, writeJSON } = require('./store');
const { sendMessage, sendMedia, getStatus } = require('./whatsapp');
const { processTemplate } = require('./templateEngine');
const { UPLOAD_DIR } = require('./config');

// Tambah contacts ke dalam queue — skip contact yang dah terima template ini
function enqueueBlast({ scheduleId, contacts, templateText, mediaFile, templateId, gapMs, startAt }) {
  const queue = readJSON('queue.json');
  const sentHistory = readJSONObject('sent_history.json');
  const now = startAt || Date.now();

  // Skip contact yang dah terima template ini
  const eligible = templateId
    ? contacts.filter(c => !(sentHistory[c.telefon] || []).includes(templateId))
    : contacts;

  const newItems = eligible.map((contact, i) => ({
    id: `q_${Date.now()}_${i}`,
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
  writeJSON('queue.json', queue);
  return newItems.length;
}

// Queue semua template sekaligus (rotation) — skip template yang dah pernah hantar per contact
function enqueueRotationBlast({ scheduleId, contacts, templates, contactGapMs, templateGapMs, startAt }) {
  const queue = readJSON('queue.json');
  const sentHistory = readJSONObject('sent_history.json');
  const now = startAt || Date.now();
  let totalQueued = 0;

  contacts.forEach((contact, contactIdx) => {
    const alreadySent = sentHistory[contact.telefon] || [];

    // Hanya template yang BELUM pernah hantar ke contact ini
    const unsentTemplates = templates.filter(t => !alreadySent.includes(t.id));

    if (!unsentTemplates.length) return; // Semua template dah hantar, skip contact ni

    unsentTemplates.forEach((tmpl, tmplIdx) => {
      queue.push({
        id: `q_${Date.now()}_c${contactIdx}_t${tmplIdx}_${Math.random().toString(36).slice(2,6)}`,
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

  writeJSON('queue.json', queue);
  return totalQueued;
}

// Proses queue — hantar item yang dah tiba masa
async function processQueue() {
  if (!getStatus().connected) return;

  const queue = readJSON('queue.json');
  const now = Date.now();
  const due = queue.filter(q => q.status === 'pending' && q.sendAt <= now);
  if (!due.length) return;

  const historyUpdates = {}; // batch update sent_history

  for (const item of due) {
    try {
      const text = processTemplate(item.templateText, { nama: item.nama, telefon: item.telefon });
      if (item.mediaFile) {
        await sendMedia(item.telefon, path.join(__dirname, UPLOAD_DIR, item.mediaFile), text);
      } else {
        await sendMessage(item.telefon, text);
      }
      item.status = 'sent';
      item.sentAt = new Date().toISOString();

      // Track untuk update sent_history
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

    // Catat log
    const logs = readJSON('logs.json');
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
    writeJSON('logs.json', logs.slice(0, 200));
  }

  // Update sent_history — satu kali write je
  if (Object.keys(historyUpdates).length) {
    const history = readJSONObject('sent_history.json');
    Object.entries(historyUpdates).forEach(([phone, tmplIds]) => {
      if (!history[phone]) history[phone] = [];
      tmplIds.forEach(id => {
        if (!history[phone].includes(id)) history[phone].push(id);
      });
    });
    writeJSON('sent_history.json', history);
  }

  // Simpan semula queue
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const updated = queue.map(q => due.find(d => d.id === q.id) || q)
    .filter(q => !(q.status !== 'pending' && new Date(q.createdAt).getTime() < cutoff));
  writeJSON('queue.json', updated);
}

// Senarai queue untuk display
function getQueueStatus() {
  const queue = readJSON('queue.json');
  return queue.filter(q => q.status === 'pending').map(q => ({
    id: q.id,
    nama: q.nama,
    telefon: q.telefon,
    templateId: q.templateId,
    sendAt: new Date(q.sendAt).toISOString(),
    scheduleId: q.scheduleId,
  }));
}

// Buang semua pending queue untuk satu schedule
function cancelQueueForSchedule(scheduleId) {
  const queue = readJSON('queue.json');
  writeJSON('queue.json', queue.filter(q => !(q.scheduleId === scheduleId && q.status === 'pending')));
}

module.exports = { enqueueBlast, enqueueRotationBlast, processQueue, getQueueStatus, cancelQueueForSchedule };
