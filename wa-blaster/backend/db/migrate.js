require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  const dir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    console.log(`[migrate] Running ${file}...`);
    await conn.query(sql);
    console.log(`[migrate] ${file} OK`);
  }

  await conn.end();
  console.log('[migrate] Done — semua migration dijalankan');
}

run().catch(e => {
  console.error('[migrate] FAIL:', e.message);
  process.exit(1);
});
