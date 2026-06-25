const router = require('express').Router();
const { readDeviceJSON, readDeviceJSONObject, writeDeviceJSON } = require('../store');

function requireDevice(req, res, next) {
  if (!req.session.deviceId) return res.status(400).json({ error: 'Pilih peranti WhatsApp dahulu' });
  next();
}

function ctx(req) { return { userId: req.session.userId, deviceId: req.session.deviceId }; }

// Agregat stats
router.get('/stats', requireDevice, (req, res) => {
  const { userId, deviceId } = ctx(req);
  const logs = readDeviceJSON(userId, deviceId, 'logs.json');
  const sales = readDeviceJSON(userId, deviceId, 'sales.json');
  const replies = readDeviceJSONObject(userId, deviceId, 'replies.json');

  const total = logs.reduce((s, l) => s + (l.sent || 0) + (l.failed || 0), 0);
  const berjaya = logs.reduce((s, l) => s + (l.sent || 0), 0);
  const failed = logs.reduce((s, l) => s + (l.failed || 0), 0);
  const uniqueBlasted = new Set(logs.flatMap(l => (l.details || []).map(d => d.telefon))).size;
  const repliedCount = Object.values(replies).filter(r => r.replied).length;
  const totalRM = sales.reduce((s, sale) => s + (parseFloat(sale.amount) || 0), 0);

  res.json({
    total, berjaya, failed,
    pctBerjaya: total ? Math.round(berjaya / total * 100) : 0,
    pctFailed: total ? Math.round(failed / total * 100) : 0,
    uniqueBlasted,
    repliedCount,
    pctReplied: uniqueBlasted ? Math.round(repliedCount / uniqueBlasted * 100) : 0,
    totalRM: totalRM.toFixed(2),
    salesCount: sales.length,
  });
});

// Contacts yang dah balas
router.get('/replies', requireDevice, (req, res) => {
  const { userId, deviceId } = ctx(req);
  const replies = readDeviceJSONObject(userId, deviceId, 'replies.json');
  const list = Object.entries(replies)
    .filter(([, r]) => r.replied)
    .map(([telefon, r]) => ({ telefon, ...r }))
    .sort((a, b) => new Date(b.repliedAt) - new Date(a.repliedAt));
  res.json(list);
});

// Manual tandakan sebagai balas
router.post('/replies/manual', requireDevice, (req, res) => {
  const { userId, deviceId } = ctx(req);
  const { telefon, nama } = req.body;
  if (!telefon) return res.status(400).json({ error: 'Telefon diperlukan' });
  const replies = readDeviceJSONObject(userId, deviceId, 'replies.json');
  replies[telefon] = {
    nama: nama || telefon,
    replied: true,
    repliedAt: replies[telefon]?.repliedAt || new Date().toISOString(),
    manual: true,
  };
  writeDeviceJSON(userId, deviceId, 'replies.json', replies);
  res.json({ ok: true });
});

// Semua rekod jualan
router.get('/sales', requireDevice, (req, res) => {
  const { userId, deviceId } = ctx(req);
  res.json(readDeviceJSON(userId, deviceId, 'sales.json'));
});

// Tambah rekod jualan
router.post('/sales', requireDevice, (req, res) => {
  const { userId, deviceId } = ctx(req);
  const { telefon, nama, amount, notes } = req.body;
  if (!amount || isNaN(amount)) return res.status(400).json({ error: 'Jumlah RM diperlukan' });

  const sales = readDeviceJSON(userId, deviceId, 'sales.json');
  const entry = {
    id: `sale_${Date.now()}`,
    telefon: telefon || '',
    nama: nama || '—',
    amount: parseFloat(amount),
    notes: notes || '',
    date: new Date().toISOString(),
  };
  sales.unshift(entry);
  writeDeviceJSON(userId, deviceId, 'sales.json', sales);
  res.json(entry);
});

// Buang rekod jualan
router.delete('/sales/:id', requireDevice, (req, res) => {
  const { userId, deviceId } = ctx(req);
  const sales = readDeviceJSON(userId, deviceId, 'sales.json');
  const filtered = sales.filter(s => s.id !== req.params.id);
  if (filtered.length === sales.length) return res.status(404).json({ error: 'Tidak dijumpai' });
  writeDeviceJSON(userId, deviceId, 'sales.json', filtered);
  res.json({ ok: true });
});

module.exports = router;
