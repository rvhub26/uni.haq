const cron = require('node-cron');
const { readDeviceJSON, readDeviceJSONObject, writeDeviceJSON, readUserJSON, readJSON } = require('./store');
const { getDeviceStatus, getChatHistory } = require('./whatsapp');
const { getMetaDeviceStatus } = require('./meta-api');
const { enqueueBlast, enqueueRotationBlast, processQueue } = require('./queue');

const activeJobs = new Map(); // key: scheduleId

function resolveTemplate(schedule, userId, deviceId) {
  if (schedule.useRotation && schedule.templateIds?.length) {
    const templates = readUserJSON(userId, 'templates.json');
    const idx = (schedule.rotationIndex || 0) % schedule.templateIds.length;
    const tmpl = templates.find(t => t.id === schedule.templateIds[idx]);
    if (!tmpl) throw new Error(`Template rotation ke-${idx + 1} tidak dijumpai`);

    const list = readDeviceJSON(userId, deviceId, 'schedules.json');
    const si = list.findIndex(s => s.id === schedule.id);
    if (si >= 0) { list[si].rotationIndex = idx + 1; writeDeviceJSON(userId, deviceId, 'schedules.json', list); }

    return { templateId: tmpl.id, templateText: tmpl.text, mediaFile: tmpl.mediaFile || null };
  }
  return { templateId: null, templateText: schedule.template, mediaFile: schedule.mediaFile || null };
}

function isConnected(userId, deviceId) {
  const devices = readUserJSON(userId, 'devices.json');
  const device = devices.find(d => d.id === deviceId);
  if (device?.type === 'meta') return getMetaDeviceStatus(userId, deviceId).connected;
  return getDeviceStatus(userId, deviceId).connected;
}

async function runBlast(schedule, userId, deviceId) {
  if (!isConnected(userId, deviceId)) throw new Error('WhatsApp tidak bersambung');

  const allContacts = readDeviceJSON(userId, deviceId, 'contacts.json');
  const raw = schedule.contacts === 'all'
    ? allContacts
    : Array.isArray(schedule.contacts)
      ? allContacts.filter(c => schedule.contacts.includes(c.id))
      : schedule.contacts?.kumpulan
        ? allContacts.filter(c => schedule.contacts.kumpulan.includes(c.kumpulan || 'Umum'))
        : allContacts;

  const seen = new Set();
  const deduped = raw.filter(c => { if (seen.has(c.telefon)) return false; seen.add(c.telefon); return true; });

  const blacklist = readDeviceJSON(userId, deviceId, 'blacklist.json');
  const blacklistSet = new Set(blacklist.map(b => b.telefon));
  let targets = deduped.filter(c => !blacklistSet.has(c.telefon));

  if (schedule.historyOnly) {
    const historySet = new Set(getChatHistory(userId, deviceId));
    targets = targets.filter(c => historySet.has(c.telefon));
    if (!targets.length) throw new Error('Tiada contacts yang pernah ada history chat dengan nombor ini');
  }

  if (!targets.length) throw new Error('Tiada contacts untuk diblast (semua mungkin dalam blacklist)');

  const contactGapMs = schedule.contactGapMs || 4000;
  const templateGapMs = schedule.templateGapMs || 0;
  const batchSize = schedule.batchSize || 0;
  const batchGapMs = schedule.batchGapMs || 0;

  if (schedule.useRotation && schedule.templateIds?.length && templateGapMs > 0) {
    const allTmpl = readUserJSON(userId, 'templates.json');
    const templates = schedule.templateIds.map(id => allTmpl.find(t => t.id === id)).filter(Boolean);
    if (!templates.length) throw new Error('Template tidak dijumpai');

    const result = enqueueRotationBlast({ userId, deviceId, scheduleId: schedule.id, contacts: targets, templates, contactGapMs, templateGapMs, startAt: Date.now(), batchSize, batchGapMs });
    return { ...result, contactGapMs, templateGapMs, templates: templates.length, batchSize, batchGapMs };
  }

  const { templateText, mediaFile, templateId } = resolveTemplate(schedule, userId, deviceId);
  const result = enqueueBlast({ userId, deviceId, scheduleId: schedule.id, contacts: targets, templateText, mediaFile, templateId, gapMs: contactGapMs, startAt: Date.now(), batchSize, batchGapMs });
  return { ...result, gapMs: contactGapMs, batchSize, batchGapMs };
}

function timeMatches(pattern) {
  const now = new Date();
  const [hh, mm] = pattern.time.split(':').map(Number);
  if (now.getHours() !== hh || now.getMinutes() !== mm) return false;
  if (pattern.frequency === 'daily') return true;
  if (pattern.frequency === 'weekly') return pattern.days?.includes(now.getDay());
  if (pattern.frequency === 'monthly') return now.getDate() === pattern.dayOfMonth;
  return false;
}

function scheduleJob(schedule, userId, deviceId) {
  if (activeJobs.has(schedule.id)) return;

  if (schedule.type === 'one-time') {
    const delay = new Date(schedule.datetime).getTime() - Date.now();
    if (delay <= 0) {
      runBlast(schedule, userId, deviceId).then(() => markDone(schedule.id, userId, deviceId)).catch(() => {});
      return;
    }
    const timer = setTimeout(() => {
      runBlast(schedule, userId, deviceId).then(() => markDone(schedule.id, userId, deviceId)).catch(() => {});
      activeJobs.delete(schedule.id);
    }, delay);
    activeJobs.set(schedule.id, { type: 'timeout', ref: timer });
  } else {
    const job = cron.schedule('* * * * *', () => {
      const latest = readDeviceJSON(userId, deviceId, 'schedules.json').find(s => s.id === schedule.id);
      if (latest && timeMatches(latest.pattern)) {
        runBlast(latest, userId, deviceId).catch(() => {});
      }
    });
    activeJobs.set(schedule.id, { type: 'cron', ref: job });
  }
}

function markDone(id, userId, deviceId) {
  const list = readDeviceJSON(userId, deviceId, 'schedules.json');
  const idx = list.findIndex(s => s.id === id);
  if (idx >= 0) { list[idx].status = 'done'; writeDeviceJSON(userId, deviceId, 'schedules.json', list); }
}

function cancelJob(id) {
  const job = activeJobs.get(id);
  if (!job) return;
  if (job.type === 'timeout') clearTimeout(job.ref);
  if (job.type === 'cron') job.ref.stop();
  activeJobs.delete(id);
}

// Restore semua schedules untuk semua users + devices
function restoreAllJobs() {
  const users = readJSON('users.json');
  let total = 0;

  for (const user of users) {
    const devices = readUserJSON(user.id, 'devices.json');
    for (const device of devices) {
      const schedules = readDeviceJSON(user.id, device.id, 'schedules.json');
      schedules.filter(s => s.status === 'active').forEach(s => {
        scheduleJob(s, user.id, device.id);
        total++;
      });
    }
  }

  // Cron setiap minit: proses semua queues
  cron.schedule('* * * * *', async () => {
    const allUsers = readJSON('users.json');
    for (const user of allUsers) {
      const devices = readUserJSON(user.id, 'devices.json');
      for (const dev of devices) {
        await processQueue(user.id, dev.id).catch(() => {});
      }
    }
  });

  console.log(`${total} jadual dipulihkan`);
}

module.exports = { scheduleJob, cancelJob, restoreAllJobs, runBlast };
