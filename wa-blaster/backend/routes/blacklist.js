const router = require('express').Router();
const { readDeviceJSON, writeDeviceJSON } = require('../store');

function requireDevice(req, res, next) {
  if (!req.session.deviceId) return res.status(400).json({ error: 'Pilih peranti WhatsApp dahulu' });
  next();
}

router.get('/', requireDevice, (req, res) => {
  const { userId, deviceId } = req.session;
  res.json(readDeviceJSON(userId, deviceId, 'blacklist.json'));
});

router.post('/', requireDevice, (req, res) => {
  const { userId, deviceId } = req.session;
  const { telefon, nama, sebab } = req.body;
  if (!telefon) return res.status(400).json({ error: 'Nombor telefon diperlukan' });

  const list = readDeviceJSON(userId, deviceId, 'blacklist.json');
  if (list.find(b => b.telefon === telefon)) {
    return res.status(409).json({ error: 'Nombor ini dah dalam blacklist' });
  }

  const entry = { telefon, nama: nama || '—', sebab: sebab || '', addedAt: new Date().toISOString() };
  list.push(entry);
  writeDeviceJSON(userId, deviceId, 'blacklist.json', list);
  res.json(entry);
});

router.delete('/:telefon', requireDevice, (req, res) => {
  const { userId, deviceId } = req.session;
  const telefon = decodeURIComponent(req.params.telefon);
  const list = readDeviceJSON(userId, deviceId, 'blacklist.json');
  const filtered = list.filter(b => b.telefon !== telefon);
  if (filtered.length === list.length) return res.status(404).json({ error: 'Tidak dijumpai dalam blacklist' });
  writeDeviceJSON(userId, deviceId, 'blacklist.json', filtered);
  res.json({ ok: true });
});

module.exports = router;
