const router = require('express').Router();
const { readUserJSON, writeUserJSON, deleteDeviceDir } = require('../store');
const { connectDevice, disconnectDevice, getDeviceStatus, getDeviceQR } = require('../whatsapp');
const { setupMetaDevice, getMetaDeviceStatus, disconnectMetaDevice } = require('../meta-api');

async function connectWithPairingCode(userId, deviceId, phone) {
  return connectDevice(userId, deviceId, phone);
}

const MAX_DEVICES = 10;

function getUserDevices(userId) { return readUserJSON(userId, 'devices.json'); }
function saveUserDevices(userId, devices) { writeUserJSON(userId, 'devices.json', devices); }

// GET /api/devices — list semua devices user dengan status
router.get('/', (req, res) => {
  const userId = req.session.userId;
  const devices = getUserDevices(userId);
  const result = devices.map(d => {
    const status = d.type === 'meta'
      ? getMetaDeviceStatus(userId, d.id)
      : { ...getDeviceStatus(userId, d.id), qr: getDeviceQR(userId, d.id) };
    return { ...d, ...status, isCurrent: req.session.deviceId === d.id };
  });
  res.json(result);
});

// POST /api/devices — tambah device baru
router.post('/', async (req, res) => {
  const userId = req.session.userId;
  const devices = getUserDevices(userId);

  if (devices.length >= MAX_DEVICES) {
    return res.status(400).json({ error: `Had maksimum ${MAX_DEVICES} peranti` });
  }

  const deviceId = `dev_${Date.now()}`;
  const name = (req.body.name || `Nombor ${devices.length + 1}`).trim();

  const newDevice = { id: deviceId, name, createdAt: new Date().toISOString() };
  devices.push(newDevice);
  saveUserDevices(userId, devices);

  // Set sebagai device aktif kalau ni first device
  if (devices.length === 1 || !req.session.deviceId) {
    req.session.deviceId = deviceId;
    await new Promise(r => req.session.save(r));
  }

  // Mula connection (async — QR akan muncul selepas beberapa saat)
  connectDevice(userId, deviceId).catch(() => {});

  res.json({ ...newDevice, status: 'connecting', connected: false, isCurrent: req.session.deviceId === deviceId });
});

// POST /api/devices/:deviceId/select — tukar device aktif
router.post('/:deviceId/select', async (req, res) => {
  const userId = req.session.userId;
  const { deviceId } = req.params;
  const devices = getUserDevices(userId);

  if (!devices.find(d => d.id === deviceId)) {
    return res.status(404).json({ error: 'Peranti tidak dijumpai' });
  }

  req.session.deviceId = deviceId;
  await new Promise(r => req.session.save(r));

  // Pastikan device connected
  const st = getDeviceStatus(userId, deviceId);
  if (st.status === 'disconnected') {
    connectDevice(userId, deviceId).catch(() => {});
  }

  res.json({ ok: true, deviceId, ...getDeviceStatus(userId, deviceId) });
});

// POST /api/devices/:deviceId/connect — reconnect device
router.post('/:deviceId/connect', async (req, res) => {
  const userId = req.session.userId;
  const { deviceId } = req.params;
  const devices = getUserDevices(userId);

  if (!devices.find(d => d.id === deviceId)) {
    return res.status(404).json({ error: 'Peranti tidak dijumpai' });
  }

  connectDevice(userId, deviceId).catch(() => {});
  res.json({ ok: true });
});

// POST /api/devices/:deviceId/pair — sambung via pairing code (tanpa scan QR)
router.post('/:deviceId/pair', async (req, res) => {
  const userId = req.session.userId;
  const { deviceId } = req.params;
  const { phone } = req.body;

  if (!phone || !/^\d{10,15}$/.test(phone.replace(/\D/g, ''))) {
    return res.status(400).json({ error: 'Nombor telefon tidak sah. Contoh: 601234567890' });
  }

  const devices = getUserDevices(userId);
  if (!devices.find(d => d.id === deviceId)) {
    return res.status(404).json({ error: 'Peranti tidak dijumpai' });
  }

  try {
    const code = await connectWithPairingCode(userId, deviceId, phone);
    if (!code) {
      return res.json({ ok: true, message: 'Peranti sudah berdaftar, sambungan biasa dimulakan' });
    }
    res.json({ ok: true, code });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/devices/:deviceId/status — status + QR untuk satu device
router.get('/:deviceId/status', (req, res) => {
  const userId = req.session.userId;
  const { deviceId } = req.params;
  res.json({
    ...getDeviceStatus(userId, deviceId),
    qr: getDeviceQR(userId, deviceId),
    isCurrent: req.session.deviceId === deviceId,
  });
});

// PUT /api/devices/:deviceId — rename device
router.put('/:deviceId', (req, res) => {
  const userId = req.session.userId;
  const { deviceId } = req.params;
  const devices = getUserDevices(userId);
  const dev = devices.find(d => d.id === deviceId);
  if (!dev) return res.status(404).json({ error: 'Peranti tidak dijumpai' });

  dev.name = (req.body.name || dev.name).trim();
  saveUserDevices(userId, devices);
  res.json(dev);
});

// POST /api/devices/meta — tambah peranti Meta API
router.post('/meta', async (req, res) => {
  const userId = req.session.userId;
  const devices = getUserDevices(userId);

  if (devices.length >= MAX_DEVICES) {
    return res.status(400).json({ error: `Had maksimum ${MAX_DEVICES} peranti` });
  }

  const { name, phoneNumberId, accessToken } = req.body;
  if (!phoneNumberId || !accessToken) {
    return res.status(400).json({ error: 'Phone Number ID dan Access Token diperlukan' });
  }

  const deviceId = `dev_${Date.now()}`;
  const deviceName = (name || `Meta API ${devices.length + 1}`).trim();

  try {
    const info = await setupMetaDevice(userId, deviceId, phoneNumberId, accessToken);
    const newDevice = {
      id: deviceId,
      name: deviceName,
      type: 'meta',
      createdAt: new Date().toISOString(),
    };
    devices.push(newDevice);
    saveUserDevices(userId, devices);

    if (devices.length === 1 || !req.session.deviceId) {
      req.session.deviceId = deviceId;
      await new Promise(r => req.session.save(r));
    }

    res.json({ ...newDevice, ...getMetaDeviceStatus(userId, deviceId), isCurrent: req.session.deviceId === deviceId, displayPhone: info.displayPhone, verifiedName: info.verifiedName });
  } catch (e) {
    res.status(400).json({ error: `Gagal verify credentials: ${e.message}` });
  }
});

// DELETE /api/devices/:deviceId — buang device
router.delete('/:deviceId', async (req, res) => {
  const userId = req.session.userId;
  const { deviceId } = req.params;
  const devices = getUserDevices(userId);
  const idx = devices.findIndex(d => d.id === deviceId);

  if (idx < 0) return res.status(404).json({ error: 'Peranti tidak dijumpai' });

  const device = devices[idx];

  // Disconnect mengikut jenis device
  if (device.type === 'meta') {
    disconnectMetaDevice(userId, deviceId);
  } else {
    await disconnectDevice(userId, deviceId).catch(() => {});
  }

  // Remove from list
  devices.splice(idx, 1);
  saveUserDevices(userId, devices);

  // Delete device data
  deleteDeviceDir(userId, deviceId);

  // Switch current device if needed
  if (req.session.deviceId === deviceId) {
    req.session.deviceId = devices[0]?.id || null;
    await new Promise(r => req.session.save(r));
  }

  res.json({ ok: true, newDeviceId: req.session.deviceId });
});

module.exports = router;
