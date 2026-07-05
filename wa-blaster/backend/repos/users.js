const db = require('../db');

async function getByUsername(username) {
  const [rows] = await db.query('SELECT * FROM users WHERE username = ? LIMIT 1', [username]);
  return rows[0] || null;
}

async function getById(id) {
  const [rows] = await db.query('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function getAll() {
  const [rows] = await db.query('SELECT id, username, role, is_active, last_login, created_at FROM users ORDER BY created_at ASC');
  return rows;
}

async function count() {
  const [rows] = await db.query('SELECT COUNT(*) AS c FROM users');
  return rows[0].c;
}

async function create({ id, username, password, role = 'user' }) {
  await db.query(
    'INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)',
    [id, username, password, role]
  );
  return getById(id);
}

async function remove(id) {
  const [result] = await db.query('DELETE FROM users WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

async function updatePassword(id, password) {
  await db.query('UPDATE users SET password = ? WHERE id = ?', [password, id]);
}

async function updateLogin(id, ip) {
  await db.query('UPDATE users SET last_login = NOW(), last_ip = ? WHERE id = ?', [ip, id]);
}

module.exports = { getByUsername, getById, getAll, count, create, remove, updatePassword, updateLogin };
