const { processFlow } = require('./flow');
const aiBrain = require('./ai-brain');
const leadsExcel = require('./leadsExcel');
const productsRepo = require('../repos/products');
const prospectsRepo = require('../repos/prospects');
const conversationsRepo = require('../repos/conversations');
const contactsRepo = require('../repos/contacts');
const botSettingsRepo = require('../repos/botSettings');
const anglesRepo = require('../repos/angles');
const messageTemplatesRepo = require('../repos/messageTemplates');
const packageTiersRepo = require('../repos/packageTiers');
const brainConfigRepo = require('../repos/brainConfig');
const humanizer = require('./humanizer');

async function handleIncoming(userId, deviceId, message) {
  const phone = message.from;
  const text = (message.text || '').trim();
  if (!text) return;

  console.log(`[bot ${deviceId}] [${phone}] IN: ${text}`);

  const product = await productsRepo.getByDeviceId(deviceId);
  if (!product) {
    console.error(`[bot ${deviceId}] Tiada produk setup — skip`);
    return;
  }

  let prospect = await prospectsRepo.getByPhone(deviceId, phone);
  if (!prospect) {
    const contact = await contactsRepo.getByPhone(deviceId, phone);
    prospect = await prospectsRepo.create(deviceId, phone, contact?.id || null);
    leadsExcel.updateLeadsFile(deviceId, phone, { status: 'ACTIVE' });
  }

  // Simpan conversation (inbound)
  await conversationsRepo.save(prospect.id, deviceId, 'inbound', text, 'text', null, message.id);
  await prospectsRepo.updateLastMessage(deviceId, phone);

  const settings = await botSettingsRepo.ensureForDevice(deviceId);
  const aiEnabled = settings?.ai_brain_enabled === 1 && process.env.CLAUDE_API_KEY;

  const [angles, templateMap, tiers, brainConfig] = await Promise.all([
    anglesRepo.getAllForDevice(deviceId),
    messageTemplatesRepo.getTemplateMap(deviceId),
    packageTiersRepo.getAllForDevice(deviceId),
    brainConfigRepo.ensureForDevice(deviceId),
  ]);
  const botConfig = { angles, templateMap, tiers, brainConfig };

  if (aiEnabled) {
    const history = await conversationsRepo.getHistory(prospect.id, 20);
    const aiResponse = await aiBrain.getAIResponse(history, {
      angle: prospect.angle,
      current_step: prospect.current_step,
      tempoh_masalah: prospect.tempoh_masalah,
      status: prospect.status,
      lastMessage: text,
    }, product, tiers, brainConfig);

    if (aiResponse) {
      await humanizer.sendHumanMessages(userId, deviceId, phone, aiResponse.messages, 'text', settings);

      if (aiResponse.next_step) {
        await prospectsRepo.updateStep(deviceId, phone, aiResponse.next_step);
      }
      if (aiResponse.prospect_temperature) {
        await prospectsRepo.updateFields(deviceId, phone, { temperature: aiResponse.prospect_temperature });
      }
      return;
    }
  }

  // Decision tree mode
  await processFlow(userId, deviceId, prospect, text, product, settings, botConfig);
}

module.exports = { handleIncoming };
