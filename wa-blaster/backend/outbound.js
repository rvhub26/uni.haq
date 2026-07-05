const path = require('path');
const devicesRepo = require('./repos/devices');
const { sendMessageDevice, sendMediaDevice, sendTypingIndicator, stopTypingIndicator } = require('./whatsapp');
const { sendTextMeta } = require('./meta-api');
const { UPLOAD_DIR } = require('./config');

// Satu titik keluar untuk semua mesej bot/blast — branch ikut jenis device (Baileys/Meta).

async function sendText(userId, deviceId, phone, text) {
  const device = await devicesRepo.getById(deviceId);
  if (device?.type === 'meta') return sendTextMeta(userId, deviceId, phone, text);
  return sendMessageDevice(userId, deviceId, phone, text);
}

async function sendImage(userId, deviceId, phone, filename, caption) {
  const device = await devicesRepo.getById(deviceId);
  if (device?.type === 'meta') {
    console.log(`[outbound] ${userId}::${deviceId} Meta API belum sokong hantar gambar — skip`);
    return;
  }
  return sendMediaDevice(userId, deviceId, phone, path.join(__dirname, UPLOAD_DIR, filename), caption);
}

async function typingStart(userId, deviceId, phone) {
  const device = await devicesRepo.getById(deviceId);
  if (device?.type === 'meta') return;
  return sendTypingIndicator(userId, deviceId, phone);
}

async function typingStop(userId, deviceId, phone) {
  const device = await devicesRepo.getById(deviceId);
  if (device?.type === 'meta') return;
  return stopTypingIndicator(userId, deviceId, phone);
}

module.exports = { sendText, sendImage, typingStart, typingStop };
