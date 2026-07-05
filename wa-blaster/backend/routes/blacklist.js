const router = require('express').Router();
const blacklistRepo = require('../repos/blacklist');

function requireDevice(req, res, next) {
  if (!req.session.deviceId) return res.status(400).json({ error: 'Pilih peranti WhatsApp dahulu' });
  next();
}

function toApi(b) {
  return { telefon: b.telefon, nama: b.nama, sebab: b.sebab, addedAt: b.added_at };
}

router.get('/', requireDevice, async (req, res) => {
  const { deviceId } = req.session;
  const list = await blacklistRepo.getForDevice(deviceId);
  res.json(list.map(toApi));
});

router.post('/', requireDevice, async (req, res) => {
  const { deviceId } = req.session;
  const { telefon, nama, sebab } = req.body;
  if (!telefon) return res.status(400).json({ error: 'Nombor telefon diperlukan' });

  const existing = await blacklistRepo.getForDevice(deviceId);
  if (existing.find(b => b.telefon === telefon)) {
    return res.status(409).json({ error: 'Nombor ini dah dalam blacklist' });
  }

  await blacklistRepo.add(deviceId, { telefon, nama: nama || '—', sebab: sebab || '' });
  res.json({ telefon, nama: nama || '—', sebab: sebab || '', addedAt: new Date().toISOString() });
});

router.delete('/:telefon', requireDevice, async (req, res) => {
  const { deviceId } = req.session;
  const telefon = decodeURIComponent(req.params.telefon);
  const existing = await blacklistRepo.getForDevice(deviceId);
  if (!existing.find(b => b.telefon === telefon)) return res.status(404).json({ error: 'Tidak dijumpai dalam blacklist' });
  await blacklistRepo.remove(deviceId, telefon);
  res.json({ ok: true });
});

module.exports = router;
