const router = require('express').Router();
const { getStatus, getQR } = require('../whatsapp');

// Status sambungan WhatsApp
router.get('/status', (_req, res) => {
  res.json(getStatus());
});

// QR code dalam base64 — null kalau dah connected
router.get('/qr', (_req, res) => {
  const qr = getQR();
  res.json({ qr });
});

module.exports = router;
