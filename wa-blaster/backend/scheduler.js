const cron = require('node-cron');
const schedulesRepo = require('./repos/schedules');
const templatesRepo = require('./repos/templates');
const contactsRepo = require('./repos/contacts');
const blacklistRepo = require('./repos/blacklist');
const devicesRepo = require('./repos/devices');
const { getDeviceStatus, getChatHistory } = require('./whatsapp');
const { getMetaDeviceStatus } = require('./meta-api');
const { enqueueBlast, enqueueRotationBlast, processQueue } = require('./queue');
const prospectsRepo = require('./repos/prospects');
const botSettingsRepo = require('./repos/botSettings');
const productsRepo = require('./repos/products');
const messageTemplatesRepo = require('./repos/messageTemplates');
const brainConfigRepo = require('./repos/brainConfig');
const botMessages = require('./bot/messages');
const botHumanizer = require('./bot/humanizer');
const botTelegram = require('./bot/telegram');

const activeJobs = new Map(); // key: scheduleId

async function resolveTemplate(schedule, userId, deviceId) {
  const templateIds = schedule.template_ids ? (typeof schedule.template_ids === 'string' ? JSON.parse(schedule.template_ids) : schedule.template_ids) : [];
  if (schedule.use_rotation && templateIds?.length) {
    const templates = await templatesRepo.getForUser(userId);
    const idx = (schedule.rotation_index || 0) % templateIds.length;
    const tmpl = templates.find(t => t.id === templateIds[idx]);
    if (!tmpl) throw new Error(`Template rotation ke-${idx + 1} tidak dijumpai`);

    await schedulesRepo.setRotationIndex(schedule.id, idx + 1);

    return { templateId: tmpl.id, templateText: tmpl.text, mediaFile: tmpl.media_file || null };
  }
  return { templateId: null, templateText: schedule.template, mediaFile: schedule.media_file || null };
}

async function isConnected(userId, deviceId) {
  const device = await devicesRepo.getById(deviceId);
  if (device?.type === 'meta') return getMetaDeviceStatus(userId, deviceId).connected;
  return getDeviceStatus(userId, deviceId).connected;
}

async function runBlast(schedule, userId, deviceId) {
  if (!(await isConnected(userId, deviceId))) throw new Error('WhatsApp tidak bersambung');

  const allContacts = await contactsRepo.getForDevice(deviceId);
  const scheduleContacts = schedule.contacts ? (typeof schedule.contacts === 'string' ? JSON.parse(schedule.contacts) : schedule.contacts) : 'all';
  const raw = scheduleContacts === 'all'
    ? allContacts
    : Array.isArray(scheduleContacts)
      ? allContacts.filter(c => scheduleContacts.includes(c.id))
      : scheduleContacts?.kumpulan
        ? allContacts.filter(c => scheduleContacts.kumpulan.includes(c.kumpulan || 'Umum'))
        : allContacts;

  const seen = new Set();
  const deduped = raw.filter(c => { if (seen.has(c.telefon)) return false; seen.add(c.telefon); return true; });

  const blacklistSet = await blacklistRepo.getPhoneSet(deviceId);
  let targets = deduped.filter(c => !blacklistSet.has(c.telefon));

  if (schedule.history_only) {
    const historySet = new Set(await getChatHistory(userId, deviceId));
    targets = targets.filter(c => historySet.has(c.telefon));
    if (!targets.length) throw new Error('Tiada contacts yang pernah ada history chat dengan nombor ini');
  }

  if (!targets.length) throw new Error('Tiada contacts untuk diblast (semua mungkin dalam blacklist)');

  const contactGapMs = schedule.contact_gap_ms || 4000;
  const templateGapMs = schedule.template_gap_ms || 0;
  const batchSize = schedule.batch_size || 0;
  const batchGapMs = schedule.batch_gap_ms || 0;

  const templateIds = schedule.template_ids ? (typeof schedule.template_ids === 'string' ? JSON.parse(schedule.template_ids) : schedule.template_ids) : [];

  if (schedule.use_rotation && templateIds?.length && templateGapMs > 0) {
    const allTmpl = await templatesRepo.getForUser(userId);
    const templates = templateIds.map(id => allTmpl.find(t => t.id === id)).filter(Boolean)
      .map(t => ({ id: t.id, text: t.text, mediaFile: t.media_file }));
    if (!templates.length) throw new Error('Template tidak dijumpai');

    const result = await enqueueRotationBlast({ userId, deviceId, scheduleId: schedule.id, contacts: targets, templates, contactGapMs, templateGapMs, startAt: Date.now(), batchSize, batchGapMs });
    return { ...result, contactGapMs, templateGapMs, templates: templates.length, batchSize, batchGapMs };
  }

  const { templateText, mediaFile, templateId } = await resolveTemplate(schedule, userId, deviceId);
  const result = await enqueueBlast({ userId, deviceId, scheduleId: schedule.id, contacts: targets, templateText, mediaFile, templateId, gapMs: contactGapMs, startAt: Date.now(), batchSize, batchGapMs });
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
      runBlast(schedule, userId, deviceId).then(() => markDone(schedule.id)).catch(() => {});
      return;
    }
    const timer = setTimeout(() => {
      runBlast(schedule, userId, deviceId).then(() => markDone(schedule.id)).catch(() => {});
      activeJobs.delete(schedule.id);
    }, delay);
    activeJobs.set(schedule.id, { type: 'timeout', ref: timer });
  } else {
    const job = cron.schedule('* * * * *', async () => {
      const latest = await schedulesRepo.getById(schedule.id);
      const pattern = latest?.pattern ? (typeof latest.pattern === 'string' ? JSON.parse(latest.pattern) : latest.pattern) : null;
      if (latest && pattern && timeMatches(pattern)) {
        runBlast(latest, userId, deviceId).catch(() => {});
      }
    });
    activeJobs.set(schedule.id, { type: 'cron', ref: job });
  }
}

async function markDone(id) {
  await schedulesRepo.setStatus(id, 'done');
}

function cancelJob(id) {
  const job = activeJobs.get(id);
  if (!job) return;
  if (job.type === 'timeout') clearTimeout(job.ref);
  if (job.type === 'cron') job.ref.stop();
  activeJobs.delete(id);
}

// Restore semua schedules untuk semua users + devices
async function restoreAllJobs() {
  const active = await schedulesRepo.getAllActiveWithDevice();
  let total = 0;

  for (const schedule of active) {
    const device = await devicesRepo.getById(schedule.device_id);
    if (!device) continue;
    scheduleJob(schedule, device.user_id, device.id);
    total++;
  }

  // Cron setiap minit: proses semua queues
  cron.schedule('* * * * *', async () => {
    const devices = await devicesRepo.getAllWithUser();
    for (const dev of devices) {
      await processQueue(dev.user_id, dev.id).catch(() => {});
    }
  });

  startClosingBotCronJobs();

  console.log(`${total} jadual dipulihkan`);
}

// Cron closing-bot — hanya jalan untuk device yang closing_bot_enabled = 1
function startClosingBotCronJobs() {
  async function botDevices() {
    const devices = await devicesRepo.getAllWithUser();
    return devices.filter(d => d.closing_bot_enabled);
  }

  // Daily report — 12 malam
  cron.schedule('0 0 * * *', async () => {
    for (const device of await botDevices()) {
      try {
        const settings = await botSettingsRepo.getByDeviceId(device.id);
        if (!settings) continue;
        const stats = await prospectsRepo.getDailyStats(device.id);
        await botTelegram.sendDailyReport(stats, settings.ad_spend_today, settings);
      } catch (e) {
        console.error(`[bot-cron] Daily report gagal (${device.id}):`, e.message);
      }
    }
  });

  // Config bot (angles/templates/tiers dashboard-configured) hanya perlu templateMap +
  // brainConfig + product untuk follow-up copy — dimuatkan sekali per device per tick.
  async function loadFollowUpVars(deviceId) {
    const [product, templateMap, brainConfig] = await Promise.all([
      productsRepo.getByDeviceId(deviceId),
      messageTemplatesRepo.getTemplateMap(deviceId),
      brainConfigRepo.ensureForDevice(deviceId),
    ]);
    const vars = { persona: brainConfig.persona_name, namaProduk: product?.nama_produk };
    return { templateMap, vars };
  }

  // Follow up 1 jam — check setiap 15 minit
  cron.schedule('*/15 * * * *', async () => {
    for (const device of await botDevices()) {
      try {
        const prospects = await prospectsRepo.getForFollowUp(device.id, 1, 'follow_up_1h');
        if (!prospects.length) continue;
        const { templateMap, vars } = await loadFollowUpVars(device.id);
        for (const p of prospects) {
          await botHumanizer.sendHumanMessages(device.user_id, device.id, p.phone_number, botMessages.getShared(templateMap, 'followUp1h', vars));
          await prospectsRepo.markFollowUpSent(device.id, p.phone_number, 'follow_up_1h');
        }
      } catch (e) {
        console.error(`[bot-cron] Follow up 1h gagal (${device.id}):`, e.message);
      }
    }
  });

  // Follow up 24 jam — check setiap jam
  cron.schedule('0 * * * *', async () => {
    for (const device of await botDevices()) {
      try {
        const prospects = await prospectsRepo.getForFollowUp(device.id, 24, 'follow_up_24h');
        if (!prospects.length) continue;
        const { templateMap, vars } = await loadFollowUpVars(device.id);
        for (const p of prospects) {
          await botHumanizer.sendHumanMessages(device.user_id, device.id, p.phone_number, botMessages.getShared(templateMap, 'followUp24h', vars));
          await prospectsRepo.markFollowUpSent(device.id, p.phone_number, 'follow_up_24h');
        }
      } catch (e) {
        console.error(`[bot-cron] Follow up 24h gagal (${device.id}):`, e.message);
      }
    }
  });

  // Follow up 72 jam — check setiap 6 jam
  cron.schedule('0 */6 * * *', async () => {
    for (const device of await botDevices()) {
      try {
        const prospects = await prospectsRepo.getForFollowUp(device.id, 72, 'follow_up_72h');
        if (!prospects.length) continue;
        const { templateMap, vars } = await loadFollowUpVars(device.id);
        for (const p of prospects) {
          await botHumanizer.sendHumanMessages(device.user_id, device.id, p.phone_number, botMessages.getShared(templateMap, 'followUp72h', vars));
          await prospectsRepo.markFollowUpSent(device.id, p.phone_number, 'follow_up_72h');
          await prospectsRepo.updateStatus(device.id, p.phone_number, 'cold');
        }
      } catch (e) {
        console.error(`[bot-cron] Follow up 72h gagal (${device.id}):`, e.message);
      }
    }
  });

  // Humanizer sleep-queue flush — setiap minit
  cron.schedule('* * * * *', async () => {
    try {
      await botHumanizer.processQueue();
    } catch (e) {
      console.error('[bot-cron] Humanizer queue flush gagal:', e.message);
    }
  });

  console.log('[bot-cron] Closing-bot cron jobs started');
}

module.exports = { scheduleJob, cancelJob, restoreAllJobs, runBlast };
