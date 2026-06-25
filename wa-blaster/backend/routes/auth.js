const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { readJSON, writeJSON } = require('../store');

// Buat admin default jika tiada users
function ensureDefaultAdmin() {
  const users = readJSON('users.json');
  if (!users.length) {
    const hash = bcrypt.hashSync('admin123', 10);
    users.push({ id: 'usr_1', username: 'admin', passwordHash: hash, role: 'admin', createdAt: new Date().toISOString() });
    writeJSON('users.json', users);
    console.log('Admin default dibuat: admin / admin123 — tukar password selepas login pertama!');
  }
}
ensureDefaultAdmin();

// GET /api/auth/check — semak status login
router.get('/check', (req, res) => {
  if (!req.session?.userId) return res.json({ loggedIn: false });
  const users = readJSON('users.json');
  const user = users.find(u => u.id === req.session.userId);
  if (!user) { req.session.destroy(); return res.json({ loggedIn: false }); }
  res.json({ loggedIn: true, username: user.username, role: user.role });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username dan password diperlukan' });

  const users = readJSON('users.json');
  const user = users.find(u => u.username === username);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Username atau password salah' });
  }

  req.session.userId = user.id;
  req.session.save();
  res.json({ ok: true, username: user.username, role: user.role });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

// GET /api/auth/users — senarai users (admin sahaja)
router.get('/users', requireAdmin, (req, res) => {
  const users = readJSON('users.json').map(u => ({
    id: u.id, username: u.username, role: u.role, createdAt: u.createdAt
  }));
  res.json(users);
});

// POST /api/auth/users — tambah user baru (admin sahaja)
router.post('/users', requireAdmin, (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username dan password diperlukan' });

  const users = readJSON('users.json');
  if (users.find(u => u.username === username)) return res.status(409).json({ error: 'Username dah wujud' });

  const newUser = {
    id: `usr_${Date.now()}`,
    username,
    passwordHash: bcrypt.hashSync(password, 10),
    role: role === 'admin' ? 'admin' : 'user',
    createdAt: new Date().toISOString(),
  };
  users.push(newUser);
  writeJSON('users.json', users);
  res.json({ id: newUser.id, username: newUser.username, role: newUser.role });
});

// DELETE /api/auth/users/:id — buang user (admin sahaja)
router.delete('/users/:id', requireAdmin, (req, res) => {
  if (req.params.id === req.session.userId) return res.status(400).json({ error: 'Tidak boleh buang akaun sendiri' });
  const users = readJSON('users.json');
  const filtered = users.filter(u => u.id !== req.params.id);
  if (filtered.length === users.length) return res.status(404).json({ error: 'User tidak dijumpai' });
  writeJSON('users.json', filtered);
  res.json({ ok: true });
});

// POST /api/auth/change-password — tukar password sendiri
router.post('/change-password', (req, res) => {
  if (!req.session?.userId) return res.status(401).json({ error: 'Tidak dibenarkan' });
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) return res.status(400).json({ error: 'Password lama dan baru diperlukan' });

  const users = readJSON('users.json');
  const idx = users.findIndex(u => u.id === req.session.userId);
  if (idx < 0) return res.status(404).json({ error: 'User tidak dijumpai' });
  if (!bcrypt.compareSync(oldPassword, users[idx].passwordHash)) return res.status(401).json({ error: 'Password lama salah' });

  users[idx].passwordHash = bcrypt.hashSync(newPassword, 10);
  writeJSON('users.json', users);
  res.json({ ok: true });
});

function requireAdmin(req, res, next) {
  if (!req.session?.userId) return res.status(401).json({ error: 'Tidak dibenarkan' });
  const users = readJSON('users.json');
  const user = users.find(u => u.id === req.session.userId);
  if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Admin sahaja' });
  next();
}

module.exports = router;
module.exports.requireAdmin = requireAdmin;
