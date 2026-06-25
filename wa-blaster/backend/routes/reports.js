const router = require('express').Router();
const { readJSON, readJSONObject, writeJSON } = require('../store');

// GET /api/reports/stats — agregat semua stats
router.get('/stats', (_req, res) => {
  const logs = readJSON('logs.json');
  const sales = readJSON('sales.json');
  const replies = readJSONObject('replies.json');

  const total = logs.reduce((s, l) => s + (l.sent || 0) + (l.failed || 0), 0);
  const berjaya = logs.reduce((s, l) => s + (l.sent || 0), 0);
  const failed = logs.reduce((s, l) => s + (l.failed || 0), 0);

  const uniqueBlasted = new Set(
    logs.flatMap(l => (l.details || []).map(d => d.telefon))
  ).size;

  const repliedCount = Object.values(replies).filter(r => r.replied).length;
  const totalRM = sales.reduce((s, sale) => s + (parseFloat(sale.amount) || 0), 0);

  res.json({
    total,
    berjaya,
    failed,
    pctBerjaya: total ? Math.round(berjaya / total * 100) : 0,
    pctFailed: total ? Math.round(failed / total * 100) : 0,
    uniqueBlasted,
    repliedCount,
    pctReplied: uniqueBlasted ? Math.round(repliedCount / uniqueBlasted * 100) : 0,
    totalRM: totalRM.toFixed(2),
    salesCount: sales.length,
  });
});

// GET /api/reports/replies — contacts yang dah balas
router.get('/replies', (_req, res) => {
  const replies = readJSONObject('replies.json');
  const list = Object.entries(replies)
    .filter(([, r]) => r.replied)
    .map(([telefon, r]) => ({ telefon, ...r }))
    .sort((a, b) => new Date(b.repliedAt) - new Date(a.repliedAt));
  res.json(list);
});

// POST /api/reports/replies/manual — manual tandakan contact sebagai dah balas
router.post('/replies/manual', (req, res) => {
  const { telefon, nama } = req.body;
  if (!telefon) return res.status(400).json({ error: 'Telefon diperlukan' });
  const replies = readJSONObject('replies.json');
  replies[telefon] = {
    nama: nama || telefon,
    replied: true,
    repliedAt: replies[telefon]?.repliedAt || new Date().toISOString(),
    manual: true,
  };
  writeJSON('replies.json', replies);
  res.json({ ok: true });
});

// GET /api/reports/sales — semua rekod jualan
router.get('/sales', (_req, res) => {
  res.json(readJSON('sales.json'));
});

// POST /api/reports/sales — tambah rekod jualan
router.post('/sales', (req, res) => {
  const { telefon, nama, amount, notes } = req.body;
  if (!amount || isNaN(amount)) return res.status(400).json({ error: 'Jumlah RM diperlukan' });

  const sales = readJSON('sales.json');
  const entry = {
    id: `sale_${Date.now()}`,
    telefon: telefon || '',
    nama: nama || '—',
    amount: parseFloat(amount),
    notes: notes || '',
    date: new Date().toISOString(),
  };
  sales.unshift(entry);
  writeJSON('sales.json', sales);
  res.json(entry);
});

// DELETE /api/reports/sales/:id — buang rekod jualan
router.delete('/sales/:id', (req, res) => {
  const sales = readJSON('sales.json');
  const filtered = sales.filter(s => s.id !== req.params.id);
  if (filtered.length === sales.length) return res.status(404).json({ error: 'Tidak dijumpai' });
  writeJSON('sales.json', filtered);
  res.json({ ok: true });
});

module.exports = router;
