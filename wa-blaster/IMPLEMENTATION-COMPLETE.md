# uni.haq — WhatsApp Auto Blast System
## Dokumentasi Lengkap Projek (Dikemaskini: Jun 2026)

> **Untuk Claude Code.** Dokumen ini menerangkan sistem yang SUDAH dibina sepenuhnya.
> Guna sebagai rujukan untuk debug, tambah feature, atau faham struktur projek.

---

## RINGKASAN PROJEK

**uni.haq** adalah sistem blast mesej WhatsApp automatik dengan:
- Upload contacts dari Excel
- Template mesej yang boleh personalize nama (`{nama}`)
- Hantar gambar/video + caption
- Library template — simpan banyak template bernama
- Rotation — hantar template berbeza setiap hari secara giliran
- Gap antara nombor — elak ban (contoh: 4 saat antara setiap contact)
- Gap antara template — mesej drip ke nombor yang sama (contoh: 24 jam)
- Jadual blast: sekali sahaja atau berulang (harian/mingguan/bulanan)
- Queue system — semua hantar dijadualkan, boleh pantau dalam dashboard
- UI: dashboard + sidebar 5 tab

**Pengguna sasaran:** Bukan programmer. Sistem kena senang run dan faham.

---

## CARA RUN

```bash
cd wa-blaster/backend
npm install        # hanya kali pertama
npm start          # atau: node index.js
```

Buka browser: **http://localhost:3001**

> Port: 3001 (bukan 3000, sebab ada projek lain di port itu)

---

## TECH STACK

| Komponen | Library | Versi |
|----------|---------|-------|
| Runtime | Node.js | v18+ |
| Server | Express | ^4.18 |
| WhatsApp | @whiskeysockets/baileys | ^7.0.0-rc13 |
| Scheduling | node-cron | ^3.0 |
| Excel | xlsx (SheetJS) | ^0.18 |
| Upload fail | multer | ^1.4.5-lts |
| QR display | qrcode | ^1.5 |
| Data | JSON files | — |
| Frontend | HTML + CSS + Vanilla JS | — |

---

## STRUKTUR FOLDER

```
wa-blaster/
├── backend/
│   ├── index.js              # Entry point — Express setup, mount routes, start WA
│   ├── config.js             # PORT=3001, MESSAGE_DELAY_MS=4000, path constants
│   ├── store.js              # readJSON(file) / writeJSON(file, data) helpers
│   ├── whatsapp.js           # Baileys: connect, QR, sendMessage, sendMedia
│   ├── scheduler.js          # node-cron: semak jadual, fire blast, rotation logic
│   ├── queue.js              # Queue system: enqueue, process, drip send
│   ├── templateEngine.js     # processTemplate(text, contact) — replace {nama} dll
│   ├── routes/
│   │   ├── whatsapp.js       # GET /api/status, GET /api/qr
│   │   ├── contacts.js       # CRUD contacts + POST /upload (Excel)
│   │   ├── media.js          # Upload/list/delete media files
│   │   ├── templates.js      # CRUD template library
│   │   └── schedules.js      # CRUD jadual + blast-now + queue
│   ├── data/
│   │   ├── contacts.json     # Senarai contacts
│   │   ├── templates.json    # Template library
│   │   ├── schedules.json    # Jadual blast
│   │   ├── logs.json         # Sejarah blast
│   │   └── queue.json        # Mesej pending untuk dihantar
│   ├── uploads/              # Media yang diupload (gambar/video)
│   ├── auth/                 # Baileys session (JANGAN commit ke Git)
│   └── package.json
├── frontend/
│   ├── index.html            # SPA dengan sidebar + 5 tab
│   ├── style.css             # Layout sidebar, kad, table, form styles
│   └── app.js                # Semua logic frontend (fetch, render, event handlers)
├── sample-contacts.xlsx      # Contoh fail Excel
├── .gitignore                # Exclude node_modules, auth/, uploads/
└── IMPLEMENTATION-COMPLETE.md
```

---

## STRUKTUR DATA (JSON)

### contacts.json
```json
[
  {
    "id": "1234567890_0",
    "nama": "Ahmad Rizal",
    "telefon": "601112223333"
  }
]
```

### templates.json
```json
[
  {
    "id": "tmpl_1234567890",
    "name": "Hari 1 — Promosi Raya",
    "text": "Hai {nama}, kami ada tawaran istimewa untuk anda!",
    "mediaFile": "abc123.jpg",
    "createdAt": "2026-06-17T08:00:00.000Z"
  }
]
```

### schedules.json
```json
[
  {
    "id": "sch_1234567890",
    "useRotation": true,
    "templateIds": ["tmpl_aaa", "tmpl_bbb", "tmpl_ccc"],
    "rotationIndex": 2,
    "template": null,
    "mediaFile": null,
    "type": "recurring",
    "datetime": null,
    "pattern": {
      "frequency": "daily",
      "time": "09:00"
    },
    "contacts": "all",
    "contactGapMs": 4000,
    "templateGapMs": 86400000,
    "status": "active",
    "createdAt": "2026-06-17T08:00:00.000Z"
  }
]
```

**Field penting:**
- `useRotation` — true = guna rotation template, false = satu template tetap
- `templateIds` — array ID template untuk rotation (ikut urutan)
- `rotationIndex` — template mana seterusnya (auto-increment setiap blast)
- `contactGapMs` — delay antara contact (elak ban, biasanya 4000ms)
- `templateGapMs` — delay antara template ke nombor yang SAMA (drip campaign)
- `contacts` — `"all"` atau array ID contact tertentu

### queue.json
```json
[
  {
    "id": "q_123_t0_c0",
    "scheduleId": "sch_xxx",
    "nama": "Ahmad",
    "telefon": "601112223333",
    "templateText": "Hai Ahmad, ada promosi!",
    "mediaFile": "abc123.jpg",
    "sendAt": 1750000000000,
    "status": "pending",
    "createdAt": "2026-06-17T08:00:00.000Z"
  }
]
```

### logs.json
```json
[
  {
    "id": "log_1234567890",
    "scheduleId": "sch_xxx",
    "template": "Hai Ahmad...",
    "blastAt": "2026-06-17T09:00:00.000Z",
    "sent": 10,
    "failed": 0,
    "details": [
      { "nama": "Ahmad", "telefon": "601...", "status": "sent" }
    ]
  }
]
```

---

## API ENDPOINTS

### WhatsApp
| Method | URL | Fungsi |
|--------|-----|--------|
| GET | `/api/status` | `{ connected, status }` |
| GET | `/api/qr` | `{ qr: "data:image/png;base64,..." }` |

### Contacts
| Method | URL | Fungsi |
|--------|-----|--------|
| GET | `/api/contacts` | Semua contacts |
| POST | `/api/contacts/upload` | Upload Excel (multipart, field: `file`) |
| DELETE | `/api/contacts/:id` | Buang satu contact |
| DELETE | `/api/contacts` | Kosongkan semua |

**Upload Excel format:** Fail `.xlsx`/`.xls` dengan header kolum `nama` dan `telefon`

### Templates
| Method | URL | Fungsi |
|--------|-----|--------|
| GET | `/api/templates` | Semua templates |
| POST | `/api/templates` | Buat template baru |
| PUT | `/api/templates/:id` | Kemaskini template |
| DELETE | `/api/templates/:id` | Buang template |

### Media
| Method | URL | Fungsi |
|--------|-----|--------|
| POST | `/api/media/upload` | Upload gambar/video (max 16MB) |
| GET | `/api/media` | Senarai media |
| DELETE | `/api/media/:filename` | Buang fail media |

**Jenis fail diterima:** JPG, PNG, GIF, WEBP, MP4, MOV

### Schedules
| Method | URL | Fungsi |
|--------|-----|--------|
| GET | `/api/schedules` | Semua jadual |
| POST | `/api/schedules` | Buat jadual baru |
| DELETE | `/api/schedules/:id` | Buang jadual |
| POST | `/api/schedules/:id/blast-now` | Blast segera |
| GET | `/api/schedules/queue` | Semua pending queue |
| DELETE | `/api/schedules/:id/queue` | Cancel queue untuk jadual |
| GET | `/api/logs` | Log blast |

---

## FLOW UTAMA

### 1. Sambungan WhatsApp
```
index.js startup
  → connectWhatsApp()
  → makeWASocket + useMultiFileAuthState('./auth')
  → connection.update event:
      - ada QR → simpan sebagai base64 → frontend poll /api/qr
      - connection open → status = 'connected'
      - connection close → auto-reconnect (kecuali logout/401)
```

### 2. Blast Biasa (satu template)
```
User klik "Blast Sekarang"
  → POST /api/schedules/:id/blast-now
  → runBlast(schedule)
  → enqueueBlast({ contacts, templateText, mediaFile, gapMs })
  → queue.json: setiap contact dapat sendAt = now + i * gapMs
  → cron setiap minit: processQueue()
  → sendMessage() atau sendMedia() bila masa tiba
  → catat dalam logs.json
```

### 3. Rotation + Template Gap (drip campaign)
```
User pilih rotation + templateGapMs
  → POST /api/schedules/:id/blast-now
  → runBlast(schedule) — detect useRotation && templateGapMs > 0
  → enqueueRotationBlast({ contacts, templates, contactGapMs, templateGapMs })
  → queue.json:
      Template 1, Contact A: sendAt = now + 0
      Template 1, Contact B: sendAt = now + contactGapMs
      Template 2, Contact A: sendAt = now + templateGapMs
      Template 2, Contact B: sendAt = now + templateGapMs + contactGapMs
      ...
  → cron setiap minit: processQueue() hantar yang dah tiba masa
```

### 4. Jadual Berulang (recurring)
```
restoreJobs() masa server start → reload semua jadual aktif
cron '* * * * *' setiap minit:
  → timeMatches(schedule.pattern) → true bila jam & hari sepadan
  → runBlast(schedule) → enqueue contacts
```

---

## FRONTEND — STRUKTUR TAB

```
Sidebar kiri (fixed, 220px)
├── 🏠 Dashboard    — status WA, 4 stat cards, log terkini
├── 👥 Contacts     — upload Excel, jadual contact, delete
├── 📝 Templates    — form tambah/edit template, senarai
├── 📅 Jadual Blast — form buat jadual, senarai jadual
└── ⏳ Queue & Log  — pending queue, sejarah blast
```

**Branding:** uni.haq (logo SVG paper plane + gradient hijau)

---

## MODUL BACKEND — RINGKASAN FUNGSI

### `whatsapp.js`
```js
connectWhatsApp()     // sambung ke WA, handle QR & reconnect
getStatus()           // { connected: bool, status: string }
getQR()               // base64 QR image atau null
sendMessage(phone, text)              // hantar teks
sendMedia(phone, filePath, caption)   // hantar gambar/video
```

### `store.js`
```js
readJSON(filename)           // baca dari data/, return [] kalau tak ada
writeJSON(filename, data)    // tulis ke data/
```

### `templateEngine.js`
```js
processTemplate(template, contact)
// "Hai {nama}!" + { nama: "Ahmad" } → "Hai Ahmad!"
// Support: {nama}, {telefon}
```

### `queue.js`
```js
enqueueBlast({ scheduleId, contacts, templateText, mediaFile, gapMs, startAt })
// Queue satu template → semua contacts dengan delay gapMs antara setiap satu

enqueueRotationBlast({ scheduleId, contacts, templates, contactGapMs, templateGapMs, startAt })
// Queue SEMUA templates × semua contacts dengan dua jenis gap

processQueue()
// Hantar semua queue item yang sendAt <= now
// Dipanggil setiap minit oleh cron

getQueueStatus()       // pending items untuk display
cancelQueueForSchedule(id)  // buang pending items untuk satu jadual
```

### `scheduler.js`
```js
scheduleJob(schedule)   // daftar jadual (setTimeout atau cron)
cancelJob(id)           // batalkan jadual
restoreJobs()           // dipanggil masa startup, reload jadual aktif
runBlast(schedule)      // tentukan template, queue contacts
```

---

## NOTA PENTING

1. **Risiko ban:** Baileys guna sambungan tidak rasmi. Guna nombor spare. Delay 4 saat membantu tapi tidak jamin 100%.

2. **Session:** Folder `auth/` simpan login. Jangan share atau commit ke Git.

3. **Port:** Server guna port **3001** (bukan 3000).

4. **Queue persistence:** Queue disimpan dalam `queue.json`. Bila server restart, cron akan terus process queue yang tertinggal.

5. **Rotation index:** `rotationIndex` dalam schedules.json dikemaskini setiap kali blast (mod rotation tanpa templateGap). Untuk rotation dengan templateGap, semua template diqueue sekaligus.

6. **Media path:** Media disimpan dalam `backend/uploads/`. Bila hantar, path dibina: `path.join(__dirname, UPLOAD_DIR, mediaFile)`.

7. **Hosting 24/7:** Untuk jadual jalan walaupun laptop tutup, perlu VPS. Sekarang server perlu hidup untuk scheduler berfungsi.

---

## FEATURE YANG BELUM ADA (untuk masa depan)

- [ ] Export log ke Excel
- [ ] Preview queue — tunjuk jadual bila setiap nombor dapat mesej
- [ ] Multi-user / sistem login
- [ ] Tambah contact secara manual (tanpa Excel)
- [ ] Duplicate/copy template
- [ ] Stop/pause jadual sementara
- [ ] Statistik blast (open rate, dll — tidak boleh dengan Baileys)
- [ ] Hosting 24/7 di VPS

---

## CHECKLIST SEMUA FEATURE

- [x] Server Express jalan di localhost:3001
- [x] Frontend SPA dengan sidebar 5 tab
- [x] Branding: uni.haq (logo SVG)
- [x] WhatsApp QR scan & connect
- [x] Session tersimpan (restart tak perlu scan semula)
- [x] Auto-reconnect bila putus
- [x] Upload Excel (nama + telefon), validate nombor Malaysia
- [x] Senarai contact, delete, kosongkan semua
- [x] Template library — simpan, edit, padam template bernama
- [x] Upload media (gambar/video) per template
- [x] Template engine — {nama}, {telefon}
- [x] Jadual blast: sekali sahaja (one-time)
- [x] Jadual blast: berulang harian / mingguan / bulanan
- [x] Pilih contacts: semua atau tertentu
- [x] Rotation — gilir-gilir template mengikut urutan
- [x] Gap antara nombor (contactGapMs) — anti-ban
- [x] Gap antara template (templateGapMs) — drip campaign
- [x] Queue system — hantar mengikut timing, pantau pending
- [x] Log blast — rekod setiap hantar
- [x] Blast segera (blast-now) tanpa tunggu jadual
- [x] Dashboard dengan stats (contacts, templates, jadual aktif, queue)
