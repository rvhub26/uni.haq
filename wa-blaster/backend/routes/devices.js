const router = require('express').Router();
const { readUserJSON, writeUserJSON, deleteDeviceDir } = require('../store');
const { connectDevice, disconnectDevice, getDeviceStatus, getDeviceQR } = require('../whatsapp');

const MAX_DEVICES = 10;

function getUserDevices(userId) { return readUserJSON(userId, 'devices.json'); }
function saveUserDevices(userId, devices) { writeUserJSON(userId, 'devices.json', devices); }

// GET /api/devices — list semua devices user dengan status
router.get('/', (req, res) => {
  const userId = req.session.userId;
  const devices = getUserDevices(userId);
  const result = devices.map(d => ({
    ...d,
    ...getDeviceStatus(userId, d.id),
    qr: getDeviceQR(userId, d.id),
    isCurrent: req.session.deviceId === d.id,
  }));
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

// DELETE /api/devices/:deviceId — buang device
router.delete('/:deviceId', async (req, res) => {
  const userId = req.session.userId;
  const { deviceId } = req.params;
  const devices = getUserDevices(userId);
  const idx = devices.findIndex(d => d.id === deviceId);

  if (idx < 0) return res.status(404).json({ error: 'Peranti tidak dijumpai' });

  // Disconnect WhatsApp
  await disconnectDevice(userId, deviceId).catch(() => {});

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
