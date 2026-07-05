const outbound = require('../outbound');

const CONFIG = {
  readDelay:       { min: 1000, max: 2000 },
  typingDelay:     { perChar: 50, max: 5000 },
  betweenMessages: { min: 2000, max: 4000 },
  imageDelay:      { min: 3000, max: 6000 },
  sleep:           { start: 0, end: 7 },
  variance:        0.3,
};

// Key: `${userId}::${deviceId}::${phone}` — queue mesej yang tertangguh masa "bot sleep"
const messageQueue = [];

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function addVariance(value) {
  const v = value * CONFIG.variance;
  return Math.floor(value + (Math.random() * v * 2) - v);
}

function isBotSleeping(settings = null) {
  const hour = new Date().getHours();
  const start = settings?.bot_sleep_start
    ? parseInt(String(settings.bot_sleep_start).split(':')[0])
    : CONFIG.sleep.start;
  const end = settings?.bot_sleep_end
    ? parseInt(String(settings.bot_sleep_end).split(':')[0])
    : CONFIG.sleep.end;
  if (start <= end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function typingDelayFor(text) {
  const base = text.length * CONFIG.typingDelay.perChar;
  return addVariance(Math.min(base, CONFIG.typingDelay.max));
}

async function sendHumanMessages(userId, deviceId, phone, messages, type = 'text', settings = null) {
  if (!messages || messages.length === 0) return;

  if (isBotSleeping(settings)) {
    messageQueue.push({ userId, deviceId, phone, messages, type, settings });
    console.log(`[Humanizer] Bot sleeping. Queued ${messages.length} msgs for ${userId}::${deviceId}::${phone}`);
    return;
  }

  // Baca dulu (simulate)
  await delay(randomBetween(CONFIG.readDelay.min, CONFIG.readDelay.max));

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];

    // Tunjuk typing...
    await outbound.typingStart(userId, deviceId, phone);

    // Tunggu ikut panjang mesej
    const waitTime = type === 'image'
      ? randomBetween(CONFIG.imageDelay.min, CONFIG.imageDelay.max)
      : typingDelayFor(message);
    await delay(waitTime);

    // Hantar
    await outbound.sendText(userId, deviceId, phone, message);
    await outbound.typingStop(userId, deviceId, phone);

    // Gap antara mesej
    if (i < messages.length - 1) {
      await delay(randomBetween(CONFIG.betweenMessages.min, CONFIG.betweenMessages.max));
    }
  }
}

async function processQueue() {
  if (messageQueue.length === 0) return;
  if (isBotSleeping()) return;

  console.log(`[Humanizer] Processing ${messageQueue.length} queued messages`);
  while (messageQueue.length > 0) {
    const item = messageQueue.shift();
    await sendHumanMessages(item.userId, item.deviceId, item.phone, item.messages, item.type, item.settings);
    await delay(1000);
  }
}

module.exports = { sendHumanMessages, processQueue, isBotSleeping };
