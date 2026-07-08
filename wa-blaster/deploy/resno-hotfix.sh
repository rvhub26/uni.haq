#!/bin/bash
# uni.haq - Resno hotfix deploy
# Fetch fail yang berubah terus dari GitHub (commit tetap), tanpa guna git pull —
# elak konflik sebab working tree server dah lama menyimpang dari git history.
# Usage: bash resno-hotfix.sh   (run dari mana-mana, script auto cd ke /var/www/unihaq)

set -e
cd /var/www/unihaq

SHA=383f8c3
RAW="https://raw.githubusercontent.com/rvhub26/uni.haq/$SHA"
BACKUP="/var/www/unihaq-backup-resno-$(date +%Y%m%d%H%M%S)"

FILES=(
  "wa-blaster/backend/bot/ai-brain.js"
  "wa-blaster/backend/bot/detector.js"
  "wa-blaster/backend/bot/flow.js"
  "wa-blaster/backend/bot/handler.js"
  "wa-blaster/backend/bot/messages.js"
  "wa-blaster/backend/bot/telegram.js"
  "wa-blaster/backend/repos/orders.js"
  "wa-blaster/backend/routes/closing-bot.js"
  "wa-blaster/frontend/index.html"
  "wa-blaster/backend/db/migrations/004_resno_pivot.sql"
)

echo "== Backup fail sedia ada ke $BACKUP =="
for f in "${FILES[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$f")"
  [ -f "$f" ] && cp "$f" "$BACKUP/$f" || true
done

echo "== Tarik fail terkini dari GitHub (commit $SHA) =="
for f in "${FILES[@]}"; do
  mkdir -p "$(dirname "$f")"
  curl -sfL "$RAW/$f" -o "$f"
  echo "  updated: $f"
done

echo "== Run migration 004 sahaja (001-003 dah applied) =="
cd wa-blaster/backend
node -e "
require('dotenv').config({ path: __dirname + '/.env' });
const mysql = require('mysql2/promise');
const fs = require('fs');
(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });
  const sql = fs.readFileSync('db/migrations/004_resno_pivot.sql', 'utf8');
  await conn.query(sql);
  await conn.end();
  console.log('[migrate 004] OK');
})().catch(e => { console.error('[migrate 004] FAIL:', e.message); process.exit(1); });
"

echo "== Restart app =="
cd /var/www/unihaq
pm2 restart unihaq

echo ""
echo "Done! Backup fail lama tersimpan di: $BACKUP"
pm2 status
