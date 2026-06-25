const cron = require('node-cron');
const { readJSON, readJSONObject, writeJSON } = require('./store');
const { getStatus } = require('./whatsapp');
const { enqueueBlast, enqueueRotationBlast, processQueue } = require('./queue');

const activeJobs = new Map();

// Tentukan template & media untuk satu schedule (sokong rotation)
function resolveTemplate(schedule) {
  if (schedule.useRotation && schedule.templateIds?.length) {
    const templates = readJSON('templates.json');
    const idx = (schedule.rotationIndex || 0) % schedule.templateIds.length;
    const tmpl = templates.find(t => t.id === schedule.templateIds[idx]);
    if (!tmpl) throw new Error(`Template rotation ke-${idx + 1} tidak dijumpai`);

    // Tambah index rotation untuk kali seterusnya
    const list = readJSON('schedules.json');
    const si = list.findIndex(s => s.id === schedule.id);
    if (si >= 0) { list[si].rotationIndex = idx + 1; writeJSON('schedules.json', list); }

    return { templateId: tmpl.id, templateText: tmpl.text, mediaFile: tmpl.mediaFile || null };
  }
  return { templateId: null, templateText: schedule.template, mediaFile: schedule.mediaFile || null };
}

// Masukkan contacts ke queue dan mulakan drip send
async function runBlast(schedule) {
  if (!getStatus().connected) throw new Error('WhatsApp tidak bersambung');

  const allContacts = readJSON('contacts.json');
  const raw = schedule.contacts === 'all'
    ? allContacts
    : Array.isArray(schedule.contacts)
      ? allContacts.filter(c => schedule.contacts.includes(c.id))
      : schedule.contacts?.kumpulan
        ? allContacts.filter(c => schedule.contacts.kumpulan.includes(c.kumpulan || 'Umum'))
        : allContacts;

  // Deduplicate by phone — elak hantar 2 kali ke nombor sama
  const seen = new Set();
  const deduped = raw.filter(c => {
    if (seen.has(c.telefon)) return false;
    seen.add(c.telefon);
    return true;
  });

  // Filter blacklist
  const blacklist = readJSON('blacklist.json');
  const blacklistSet = new Set(blacklist.map(b => b.telefon));
  const targets = deduped.filter(c => !blacklistSet.has(c.telefon));

  if (!targets.length) throw new Error('Tiada contacts untuk diblast (semua mungkin dalam blacklist)');

  const contactGapMs = schedule.contactGapMs || 4000;
  const templateGapMs = schedule.templateGapMs || 0;

  // Rotation + templateGapMs: queue SEMUA template sekaligus dengan gap
  if (schedule.useRotation && schedule.templateIds?.length && templateGapMs > 0) {
    const allTmpl = readJSON('templates.json');
    const templates = schedule.templateIds.map(id => allTmpl.find(t => t.id === id)).filter(Boolean);
    if (!templates.length) throw new Error('Template tidak dijumpai');

    const count = enqueueRotationBlast({
      scheduleId: schedule.id,
      contacts: targets,
      templates,
      contactGapMs,
      templateGapMs,
      startAt: Date.now(),
    });
    return { queued: count, contactGapMs, templateGapMs, templates: templates.length };
  }

  // Mod biasa: satu template sahaja (atau rotation tanpa templateGap)
  const { templateText, mediaFile, templateId } = resolveTemplate(schedule);
  const count = enqueueBlast({
    scheduleId: schedule.id,
    contacts: targets,
    templateText,
    mediaFile,
    templateId,
    gapMs: contactGapMs,
    startAt: Date.now(),
  });
  return { queued: count, gapMs: contactGapMs };
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

function scheduleJob(schedule) {
  if (activeJobs.has(schedule.id)) return;

  if (schedule.type === 'one-time') {
    const delay = new Date(schedule.datetime).getTime() - Date.now();
    if (delay <= 0) {
      runBlast(schedule).then(() => markDone(schedule.id)).catch(() => {});
      return;
    }
    const timer = setTimeout(() => {
      runBlast(schedule).then(() => markDone(schedule.id)).catch(() => {});
      activeJobs.delete(schedule.id);
    }, delay);
    activeJobs.set(schedule.id, { type: 'timeout', ref: timer });
  } else {
    const job = cron.schedule('* * * * *', () => {
      const latest = readJSON('schedules.json').find(s => s.id === schedule.id);
      if (latest && timeMatches(latest.pattern)) {
        runBlast(latest).catch(() => {});
      }
    });
    activeJobs.set(schedule.id, { type: 'cron', ref: job });
  }
}

function markDone(id) {
  const list = readJSON('schedules.json');
  const idx = list.findIndex(s => s.id === id);
  if (idx >= 0) { list[idx].status = 'done'; writeJSON('schedules.json', list); }
}

function cancelJob(id) {
  const job = activeJobs.get(id);
  if (!job) return;
  if (job.type === 'timeout') clearTimeout(job.ref);
  if (job.type === 'cron') job.ref.stop();
  activeJobs.delete(id);
}

function restoreJobs() {
  const list = readJSON('schedules.json');
  list.filter(s => s.status === 'active').forEach(scheduleJob);

  // Cron setiap minit: proses queue + semak jadual recurring
  cron.schedule('* * * * *', () => {
    processQueue().catch(() => {});
  });

  console.log(`${list.filter(s => s.status === 'active').length} jadual dipulihkan`);
}

module.exports = { scheduleJob, cancelJob, restoreJobs, runBlast };
