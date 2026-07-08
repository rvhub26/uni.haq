const router = require('express').Router();
const devicesRepo = require('../repos/devices');
const productsRepo = require('../repos/products');
const botSettingsRepo = require('../repos/botSettings');
const prospectsRepo = require('../repos/prospects');
const conversationsRepo = require('../repos/conversations');

async function requireOwnedDevice(req, res, next) {
  const device = await devicesRepo.getById(req.params.deviceId);
  if (!device || device.user_id !== req.session.userId) return res.status(404).json({ error: 'Peranti tidak dijumpai' });
  req.device = device;
  next();
}

function toProductApi(p) {
  if (!p) return null;
  return {
    id: p.id, deviceId: p.device_id, namaProduk: p.nama_produk,
    harga1: p.harga_1, hargaPakej2: p.harga_pakej_2, hargaPakej3: p.harga_pakej_3,
    namaAkaun: p.nama_akaun, bank1Nama: p.bank_1_nama, bank1No: p.bank_1_no,
    bank2Nama: p.bank_2_nama, bank2No: p.bank_2_no, codEnabled: !!p.cod_enabled,
    gambarProduk: p.gambar_produk, gambarTestimoni1: p.gambar_testimoni_1,
    gambarTestimoni2: p.gambar_testimoni_2, gambarTestimoni3: p.gambar_testimoni_3,
    gambarKajian: p.gambar_kajian, gambarIngredient: p.gambar_ingredient,
    gambarKkm: p.gambar_kkm, gambarPakej: p.gambar_pakej,
  };
}

function toSettingsApi(s) {
  if (!s) return null;
  return {
    aiBrainEnabled: !!s.ai_brain_enabled,
    telegramBotToken: s.telegram_bot_token, telegramChatId: s.telegram_chat_id,
    botSleepStart: s.bot_sleep_start, botSleepEnd: s.bot_sleep_end,
    adSpendToday: s.ad_spend_today,
  };
}

function toProspectApi(p) {
  return {
    id: p.id, phoneNumber: p.phone_number, nama: p.nama, angle: p.angle,
    currentStep: p.current_step, temperature: p.temperature, status: p.status,
    lastMessageAt: p.last_message_at, createdAt: p.created_at,
  };
}

// GET /api/closing-bot/:deviceId/product
router.get('/:deviceId/product', requireOwnedDevice, async (req, res) => {
  res.json(toProductApi(await productsRepo.getByDeviceId(req.params.deviceId)));
});

// PUT /api/closing-bot/:deviceId/product — create/update
router.put('/:deviceId/product', requireOwnedDevice, async (req, res) => {
  const body = req.body;
  const existing = await productsRepo.getByDeviceId(req.params.deviceId);
  if (!existing && !body.namaProduk?.trim()) {
    return res.status(400).json({ error: 'Nama produk diperlukan' });
  }

  const fields = {};
  const map = {
    namaProduk: 'nama_produk', harga1: 'harga_1', hargaPakej2: 'harga_pakej_2', hargaPakej3: 'harga_pakej_3',
    namaAkaun: 'nama_akaun', bank1Nama: 'bank_1_nama', bank1No: 'bank_1_no',
    bank2Nama: 'bank_2_nama', bank2No: 'bank_2_no', codEnabled: 'cod_enabled',
    gambarProduk: 'gambar_produk', gambarTestimoni1: 'gambar_testimoni_1',
    gambarTestimoni2: 'gambar_testimoni_2', gambarTestimoni3: 'gambar_testimoni_3',
    gambarKajian: 'gambar_kajian', gambarIngredient: 'gambar_ingredient',
    gambarKkm: 'gambar_kkm', gambarPakej: 'gambar_pakej',
  };
  for (const [k, col] of Object.entries(map)) {
    if (body[k] !== undefined) fields[col] = k === 'codEnabled' ? (body[k] ? 1 : 0) : body[k];
  }

  const product = await productsRepo.upsertForDevice(req.params.deviceId, fields);
  res.json(toProductApi(product));
});

// GET /api/closing-bot/:deviceId/settings
router.get('/:deviceId/settings', requireOwnedDevice, async (req, res) => {
  res.json(toSettingsApi(await botSettingsRepo.ensureForDevice(req.params.deviceId)));
});

// PUT /api/closing-bot/:deviceId/settings
router.put('/:deviceId/settings', requireOwnedDevice, async (req, res) => {
  const body = req.body;
  const fields = {};
  if (body.aiBrainEnabled !== undefined) fields.ai_brain_enabled = body.aiBrainEnabled ? 1 : 0;
  if (body.telegramBotToken !== undefined) fields.telegram_bot_token = body.telegramBotToken;
  if (body.telegramChatId !== undefined) fields.telegram_chat_id = body.telegramChatId;
  if (body.botSleepStart !== undefined) fields.bot_sleep_start = body.botSleepStart;
  if (body.botSleepEnd !== undefined) fields.bot_sleep_end = body.botSleepEnd;

  const settings = await botSettingsRepo.update(req.params.deviceId, fields);
  res.json(toSettingsApi(settings));
});

// GET /api/closing-bot/:deviceId/prospects
router.get('/:deviceId/prospects', requireOwnedDevice, async (req, res) => {
  const list = await prospectsRepo.getAllForDevice(req.params.deviceId);
  res.json(list.map(toProspectApi));
});

// GET /api/closing-bot/:deviceId/prospects/:id/conversations
router.get('/:deviceId/prospects/:id/conversations', requireOwnedDevice, async (req, res) => {
  const prospect = await prospectsRepo.getById(req.params.id);
  if (!prospect || prospect.device_id !== req.params.deviceId) return res.status(404).json({ error: 'Prospek tidak dijumpai' });
  const history = await conversationsRepo.getHistory(prospect.id, 100);
  res.json(history.map(c => ({
    id: c.id, direction: c.direction, message: c.message, messageType: c.message_type, createdAt: c.created_at,
  })));
});

module.exports = router;
