const db = require('../db');

async function getForUser(userId) {
  const [rows] = await db.query('SELECT * FROM templates WHERE user_id = ? ORDER BY created_at ASC', [userId]);
  return rows;
}

async function getById(id) {
  const [rows] = await db.query('SELECT * FROM templates WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function create(userId, { id, name, text, mediaFile = null }) {
  await db.query(
    'INSERT INTO templates (id, user_id, name, text, media_file) VALUES (?, ?, ?, ?, ?)',
    [id, userId, name, text, mediaFile]
  );
  return getById(id);
}

async function update(id, fields) {
  const map = { name: 'name', text: 'text', mediaFile: 'media_file' };
  const keys = Object.keys(fields).filter(k => map[k]);
  if (!keys.length) return getById(id);
  const sets = keys.map(k => `${map[k]} = ?`).join(', ');
  await db.query(`UPDATE templates SET ${sets} WHERE id = ?`, [...keys.map(k => fields[k]), id]);
  return getById(id);
}

async function remove(id) {
  await db.query('DELETE FROM templates WHERE id = ?', [id]);
}

module.exports = { getForUser, getById, create, update, remove };
