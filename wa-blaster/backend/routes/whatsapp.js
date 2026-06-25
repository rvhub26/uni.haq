const router = require('express').Router();
const { getDeviceStatus, getDeviceQR } = require('../whatsapp');

// Status + QR untuk device aktif user
router.get('/status', (req, res) => {
  const { userId, deviceId } = req.session;
  if (!deviceId) return res.json({ connected: false, status: 'no_device' });
  res.json(getDeviceStatus(userId, deviceId));
});

router.get('/qr', (req, res) => {
  const { userId, deviceId } = req.session;
  if (!deviceId) return res.json({ qr: null });
  res.json({ qr: getDeviceQR(userId, deviceId) });
});

module.exports = router;
