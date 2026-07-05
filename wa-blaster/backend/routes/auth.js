const router = require('express').Router();
const bcrypt = require('bcryptjs');
const usersRepo = require('../repos/users');

// Buat admin default jika tiada users
async function ensureDefaultAdmin() {
  const total = await usersRepo.count();
  if (!total) {
    const hash = bcrypt.hashSync('admin123', 10);
    await usersRepo.create({ id: 'usr_1', username: 'admin', password: hash, role: 'admin' });
    console.log('Admin default dibuat: admin / admin123 — tukar password selepas login pertama!');
  }
}
ensureDefaultAdmin().catch(e => console.error('[auth] ensureDefaultAdmin gagal:', e.message));

// GET /api/auth/check — semak status login
router.get('/check', async (req, res) => {
  if (!req.session?.userId) return res.json({ loggedIn: false });
  const user = await usersRepo.getById(req.session.userId);
  if (!user) { req.session.destroy(); return res.json({ loggedIn: false }); }
  res.json({ loggedIn: true, username: user.username, role: user.role });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username dan password diperlukan' });

  const user = await usersRepo.getByUsername(username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Username atau password salah' });
  }

  req.session.userId = user.id;
  req.session.save();
  usersRepo.updateLogin(user.id, req.ip || req.connection?.remoteAddress).catch(() => {});
  res.json({ ok: true, username: user.username, role: user.role });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

// GET /api/auth/users — senarai users (admin sahaja)
router.get('/users', requireAdmin, async (req, res) => {
  const users = await usersRepo.getAll();
  res.json(users.map(u => ({ id: u.id, username: u.username, role: u.role, createdAt: u.created_at })));
});

// POST /api/auth/users — tambah user baru (admin sahaja)
router.post('/users', requireAdmin, async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username dan password diperlukan' });

  if (await usersRepo.getByUsername(username)) return res.status(409).json({ error: 'Username dah wujud' });

  const newUser = await usersRepo.create({
    id: `usr_${Date.now()}`,
    username,
    password: bcrypt.hashSync(password, 10),
    role: role === 'admin' ? 'admin' : 'user',
  });
  res.json({ id: newUser.id, username: newUser.username, role: newUser.role });
});

// DELETE /api/auth/users/:id — buang user (admin sahaja)
router.delete('/users/:id', requireAdmin, async (req, res) => {
  if (req.params.id === req.session.userId) return res.status(400).json({ error: 'Tidak boleh buang akaun sendiri' });
  const ok = await usersRepo.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: 'User tidak dijumpai' });
  res.json({ ok: true });
});

// POST /api/auth/change-password — tukar password sendiri
router.post('/change-password', async (req, res) => {
  if (!req.session?.userId) return res.status(401).json({ error: 'Tidak dibenarkan' });
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) return res.status(400).json({ error: 'Password lama dan baru diperlukan' });

  const user = await usersRepo.getById(req.session.userId);
  if (!user) return res.status(404).json({ error: 'User tidak dijumpai' });
  if (!bcrypt.compareSync(oldPassword, user.password)) return res.status(401).json({ error: 'Password lama salah' });

  await usersRepo.updatePassword(user.id, bcrypt.hashSync(newPassword, 10));
  res.json({ ok: true });
});

async function requireAdmin(req, res, next) {
  if (!req.session?.userId) return res.status(401).json({ error: 'Tidak dibenarkan' });
  const user = await usersRepo.getById(req.session.userId);
  if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Admin sahaja' });
  next();
}

module.exports = router;
module.exports.requireAdmin = requireAdmin;
