#!/bin/bash
# uni.haq - Resno hotfix deploy
# Fetch fail yang berubah terus dari GitHub (satu tarball, commit tetap),
# tanpa guna git pull — elak konflik sebab working tree server dah lama
# menyimpang dari git history, dan elak rate-limit raw.githubusercontent.com.
# Usage: bash resno-hotfix.sh   (run dari mana-mana, script auto cd ke /var/www/unihaq)

set -e
cd /var/www/unihaq

SHA=383f8c3
TARBALL="https://github.com/rvhub26/uni.haq/archive/$SHA.tar.gz"
BACKUP="/var/www/unihaq-backup-resno-$(date +%Y%m%d%H%M%S)"
TMPDIR=$(mktemp -d)

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

echo "== Muat turun tarball repo (commit $SHA) =="
curl -sfL --retry 5 --retry-delay 3 "$TARBALL" -o "$TMPDIR/repo.tar.gz"
tar -xzf "$TMPDIR/repo.tar.gz" -C "$TMPDIR"
EXTRACTED=$(find "$TMPDIR" -maxdepth 1 -type d -name "uni.haq-*" | head -1)

if [ -z "$EXTRACTED" ]; then
  echo "FAIL: tarball tak extract dengan betul"
  rm -rf "$TMPDIR"
  exit 1
fi

echo "== Backup fail sedia ada ke $BACKUP =="
for f in "${FILES[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$f")"
  [ -f "$f" ] && cp "$f" "$BACKUP/$f" || true
done

echo "== Salin fail terkini dari tarball =="
for f in "${FILES[@]}"; do
  mkdir -p "$(dirname "$f")"
  cp "$EXTRACTED/$f" "$f"
  echo "  updated: $f"
done

rm -rf "$TMPDIR"

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
