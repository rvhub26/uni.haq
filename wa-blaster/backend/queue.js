const path = require('path');
const { readJSON, writeJSON } = require('./store');
const { sendMessage, sendMedia, getStatus } = require('./whatsapp');
const { processTemplate } = require('./templateEngine');
const { UPLOAD_DIR } = require('./config');

// Tambah contacts ke dalam queue dengan gap antara setiap satu
function enqueueBlast({ scheduleId, contacts, templateText, mediaFile, gapMs, startAt }) {
  const queue = readJSON('queue.json');
  const now = startAt || Date.now();

  const newItems = contacts.map((contact, i) => ({
    id: `q_${Date.now()}_${i}`,
    scheduleId,
    nama: contact.nama,
    telefon: contact.telefon,
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

// Proses queue — hantar item yang dah tiba masa
async function processQueue() {
  if (!getStatus().connected) return;

  const queue = readJSON('queue.json');
  const now = Date.now();
  const due = queue.filter(q => q.status === 'pending' && q.sendAt <= now);
  if (!due.length) return;

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
    } catch (e) {
      item.status = 'failed';
      item.error = e.message;
    }

    // Catat log setiap item
    const logs = readJSON('logs.json');
    logs.unshift({
      id: `log_${Date.now()}`,
      scheduleId: item.scheduleId,
      template: item.templateText,
      blastAt: new Date().toISOString(),
      sent: item.status === 'sent' ? 1 : 0,
      failed: item.status === 'failed' ? 1 : 0,
      details: [{ nama: item.nama, telefon: item.telefon, status: item.status }],
    });
    writeJSON('logs.json', logs.slice(0, 200));
  }

  // Simpan semula queue (buang yang dah sent/failed lebih 7 hari)
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const updated = queue.map(q => due.find(d => d.id === q.id) || q)
    .filter(q => !(q.status !== 'pending' && new Date(q.createdAt).getTime() < cutoff));
  writeJSON('queue.json', updated);
}

// Queue semua template sekaligus (untuk rotation one-time dengan templateGapMs)
// Contoh: 3 templates, 2 contacts, templateGap=24jam, contactGap=4s
// → Contact A: T1 now, T1→T2 +24h, T1→T3 +48h
// → Contact B: T1 +4s, T2 +24h+4s, T3 +48h+4s
function enqueueRotationBlast({ scheduleId, contacts, templates, contactGapMs, templateGapMs, startAt }) {
  const queue = readJSON('queue.json');
  const now = startAt || Date.now();
  let totalQueued = 0;

  templates.forEach((tmpl, tmplIdx) => {
    const batchStart = now + tmplIdx * templateGapMs;
    contacts.forEach((contact, contactIdx) => {
      queue.push({
        id: `q_${Date.now()}_t${tmplIdx}_c${contactIdx}`,
        scheduleId,
        nama: contact.nama,
        telefon: contact.telefon,
        templateText: tmpl.text,
        mediaFile: tmpl.mediaFile || null,
        sendAt: batchStart + contactIdx * contactGapMs,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
      totalQueued++;
    });
  });

  writeJSON('queue.json', queue);
  return totalQueued;
}

// Senarai queue untuk display
function getQueueStatus() {
  const queue = readJSON('queue.json');
  return queue.filter(q => q.status === 'pending').map(q => ({
    id: q.id,
    nama: q.nama,
    telefon: q.telefon,
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
