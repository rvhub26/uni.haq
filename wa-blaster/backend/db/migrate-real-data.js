// One-off: migrate data JSON sebenar (production) ke MySQL.
// Jalan sekali sahaja kat server, lepas migrate.js (schema) dah siap.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const fs = require('fs');
const db = require('../db');

const DATA_DIR = path.join(__dirname, '..', 'data');

function readJSON(p, fallback) {
  try {
    if (!fs.existsSync(p)) return fallback;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    console.log(`[migrate-data] gagal baca ${p}: ${e.message}`);
    return fallback;
  }
}

async function run() {
  const counts = { users: 0, devices: 0, templates: 0, contacts: 0, schedules: 0, queue: 0, logs: 0, replies: 0, blacklist: 0, chatThreads: 0, sales: 0, sentHistory: 0 };

  const users = readJSON(path.join(DATA_DIR, 'users.json'), []);
  for (const u of users) {
    await db.query(
      'INSERT IGNORE INTO users (id, username, password, role, created_at) VALUES (?, ?, ?, ?, ?)',
      [u.id, u.username, u.passwordHash, u.role, new Date(u.createdAt)]
    );
    counts.users++;

    const userDir = path.join(DATA_DIR, u.id);
    if (!fs.existsSync(userDir)) continue;

    const devices = readJSON(path.join(userDir, 'devices.json'), []);
    for (const d of devices) {
      await db.query(
        'INSERT IGNORE INTO devices (id, user_id, name, type, created_at) VALUES (?, ?, ?, ?, ?)',
        [d.id, u.id, d.name, d.type || 'baileys', new Date(d.createdAt)]
      );
      counts.devices++;
    }

    const templates = readJSON(path.join(userDir, 'templates.json'), []);
    for (const t of templates) {
      await db.query(
        'INSERT IGNORE INTO templates (id, user_id, name, text, media_file, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [t.id, u.id, t.name, t.text, t.mediaFile || null, new Date(t.createdAt)]
      );
      counts.templates++;
    }

    for (const d of devices) {
      const deviceDir = path.join(userDir, d.id);
      if (!fs.existsSync(deviceDir)) continue;

      const contacts = readJSON(path.join(deviceDir, 'contacts.json'), []);
      for (const c of contacts) {
        await db.query(
          `INSERT IGNORE INTO contacts (id, device_id, nama, telefon, kumpulan) VALUES (?, ?, ?, ?, ?)`,
          [c.id, d.id, c.nama, c.telefon, c.kumpulan || 'Umum']
        );
        counts.contacts++;
      }

      const schedules = readJSON(path.join(deviceDir, 'schedules.json'), []);
      for (const s of schedules) {
        await db.query(
          `INSERT IGNORE INTO schedules
            (id, device_id, use_rotation, template_ids, rotation_index, template, media_file,
             type, datetime, pattern, contacts, contact_gap_ms, template_gap_ms, batch_size, batch_gap_ms,
             history_only, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            s.id, d.id, s.useRotation ? 1 : 0, JSON.stringify(s.templateIds || []), s.rotationIndex || 0,
            s.template || null, s.mediaFile || null, s.type, s.datetime ? new Date(s.datetime) : null,
            JSON.stringify(s.pattern || null), JSON.stringify(s.contacts ?? 'all'),
            s.contactGapMs || 4000, s.templateGapMs || 0, s.batchSize || 0, s.batchGapMs || 0,
            s.historyOnly ? 1 : 0, s.status || 'active', new Date(s.createdAt),
          ]
        );
        counts.schedules++;
      }

      const queue = readJSON(path.join(deviceDir, 'queue.json'), []);
      for (const q of queue) {
        const status = ['pending', 'sent', 'failed'].includes(q.status) ? q.status : 'pending';
        await db.query(
          `INSERT IGNORE INTO queue
            (id, device_id, schedule_id, nama, telefon, template_id, template_text, media_file, send_at, status, sent_at, error, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            q.id, d.id, q.scheduleId || null, q.nama, q.telefon, q.templateId || null, q.templateText,
            q.mediaFile || null, new Date(q.sendAt), status, q.sentAt ? new Date(q.sentAt) : null,
            q.error || null, new Date(q.createdAt),
          ]
        );
        counts.queue++;
      }

      // logs.json — id asal ada duplicate (bug lama Date.now() tanpa suffix), regenerate unique id
      const logs = readJSON(path.join(deviceDir, 'logs.json'), []);
      for (let i = 0; i < logs.length; i++) {
        const l = logs[i];
        await db.query(
          `INSERT IGNORE INTO logs (id, device_id, schedule_id, template_id, template_text, blast_at, sent, failed, details)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            `${l.id}_${i}`, d.id, l.scheduleId || null, l.templateId || null, l.template,
            new Date(l.blastAt), l.sent || 0, l.failed || 0, JSON.stringify(l.details || null),
          ]
        );
        counts.logs++;
      }

      const replies = readJSON(path.join(deviceDir, 'replies.json'), {});
      for (const [phone, r] of Object.entries(replies)) {
        await db.query(
          `INSERT IGNORE INTO replies (device_id, phone_number, nama, replied_at, manual) VALUES (?, ?, ?, ?, ?)`,
          [d.id, phone, r.nama, new Date(r.repliedAt), r.manual ? 1 : 0]
        );
        counts.replies++;
      }

      const blacklist = readJSON(path.join(deviceDir, 'blacklist.json'), []);
      for (const b of blacklist) {
        await db.query(
          `INSERT IGNORE INTO blacklist (device_id, telefon, nama, sebab, added_at) VALUES (?, ?, ?, ?, ?)`,
          [d.id, b.telefon, b.nama || null, b.sebab || null, new Date(b.addedAt)]
        );
        counts.blacklist++;
      }

      const chatHistory = readJSON(path.join(deviceDir, 'chat_history.json'), []);
      for (const phone of chatHistory) {
        await db.query(`INSERT IGNORE INTO chat_threads (device_id, phone_number) VALUES (?, ?)`, [d.id, phone]);
        counts.chatThreads++;
      }

      const sales = readJSON(path.join(deviceDir, 'sales.json'), []);
      for (const s of sales) {
        await db.query(
          `INSERT IGNORE INTO sales (id, device_id, telefon, nama, amount, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [s.id, d.id, s.telefon || null, s.nama || null, s.amount, s.notes || null, new Date(s.date)]
        );
        counts.sales++;
      }

      const sentHistory = readJSON(path.join(deviceDir, 'sent_history.json'), {});
      for (const [phone, templateIds] of Object.entries(sentHistory)) {
        for (const tid of templateIds) {
          await db.query(
            `INSERT IGNORE INTO sent_history (device_id, phone_number, template_id) VALUES (?, ?, ?)`,
            [d.id, phone, tid]
          );
          counts.sentHistory++;
        }
      }
    }
  }

  console.log('[migrate-data] Selesai:', JSON.stringify(counts, null, 2));
  process.exit(0);
}

run().catch(e => { console.error('[migrate-data] FAIL:', e); process.exit(1); });
