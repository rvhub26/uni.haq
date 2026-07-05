const contactsRepo = require('./repos/contacts');
const repliesRepo = require('./repos/replies');
const devicesRepo = require('./repos/devices');

// Titik masuk tunggal untuk semua mesej masuk (Baileys & Meta) — reply-tracking blast
// sentiasa jalan, closing-bot AI cuma jalan kalau device.closing_bot_enabled = 1.
async function handleInboundMessage({ userId, deviceId, from, text, isImage, waMessageId }) {
  try {
    const contact = await contactsRepo.getByPhone(deviceId, from);
    if (contact) await repliesRepo.record(deviceId, from, contact.nama);
  } catch (e) {
    console.log(`[inbound] ${userId}::${deviceId} reply-track gagal: ${e.message}`);
  }

  let botEnabled = false;
  try {
    botEnabled = await devicesRepo.isClosingBotEnabled(deviceId);
  } catch (e) {
    console.log(`[inbound] ${userId}::${deviceId} check toggle gagal: ${e.message}`);
  }
  if (!botEnabled) return;

  try {
    const handler = require('./bot/handler');
    await handler.handleIncoming(userId, deviceId, { from, text, isImage, id: waMessageId });
  } catch (e) {
    console.log(`[inbound] ${userId}::${deviceId} bot handler gagal: ${e.message}`);
  }
}

module.exports = { handleInboundMessage };
