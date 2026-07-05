const router = require('express').Router();
const logsRepo = require('../repos/logs');
const salesRepo = require('../repos/sales');
const repliesRepo = require('../repos/replies');

function requireDevice(req, res, next) {
  if (!req.session.deviceId) return res.status(400).json({ error: 'Pilih peranti WhatsApp dahulu' });
  next();
}

function ctx(req) { return { userId: req.session.userId, deviceId: req.session.deviceId }; }

// Agregat stats
router.get('/stats', requireDevice, async (req, res) => {
  const { deviceId } = ctx(req);
  const logs = await logsRepo.getForDevice(deviceId);
  const sales = await salesRepo.getForDevice(deviceId);
  const replies = await repliesRepo.getForDevice(deviceId);

  const total = logs.reduce((s, l) => s + (l.sent || 0) + (l.failed || 0), 0);
  const berjaya = logs.reduce((s, l) => s + (l.sent || 0), 0);
  const failed = logs.reduce((s, l) => s + (l.failed || 0), 0);
  const uniqueBlasted = new Set(logs.flatMap(l => (l.details || []).map(d => d.telefon))).size;
  const repliedCount = replies.length;
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
router.get('/replies', requireDevice, async (req, res) => {
  const { deviceId } = ctx(req);
  const list = await repliesRepo.getForDevice(deviceId);
  res.json(list.map(r => ({ telefon: r.phone_number, nama: r.nama, replied: true, repliedAt: r.replied_at, manual: !!r.manual })));
});

// Manual tandakan sebagai balas
router.post('/replies/manual', requireDevice, async (req, res) => {
  const { deviceId } = ctx(req);
  const { telefon, nama } = req.body;
  if (!telefon) return res.status(400).json({ error: 'Telefon diperlukan' });
  await repliesRepo.record(deviceId, telefon, nama || telefon, true);
  res.json({ ok: true });
});

// Semua rekod jualan
router.get('/sales', requireDevice, async (req, res) => {
  const { deviceId } = ctx(req);
  const sales = await salesRepo.getForDevice(deviceId);
  res.json(sales.map(s => ({ id: s.id, telefon: s.telefon, nama: s.nama, amount: s.amount, notes: s.notes, date: s.created_at })));
});

// Tambah rekod jualan
router.post('/sales', requireDevice, async (req, res) => {
  const { deviceId } = ctx(req);
  const { telefon, nama, amount, notes } = req.body;
  if (!amount || isNaN(amount)) return res.status(400).json({ error: 'Jumlah RM diperlukan' });

  const entry = { id: `sale_${Date.now()}`, telefon: telefon || '', nama: nama || '—', amount: parseFloat(amount), notes: notes || '' };
  await salesRepo.create(deviceId, entry);
  res.json({ ...entry, date: new Date().toISOString() });
});

// Buang rekod jualan
router.delete('/sales/:id', requireDevice, async (req, res) => {
  const { deviceId } = ctx(req);
  const sales = await salesRepo.getForDevice(deviceId);
  if (!sales.find(s => s.id === req.params.id)) return res.status(404).json({ error: 'Tidak dijumpai' });
  await salesRepo.remove(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
