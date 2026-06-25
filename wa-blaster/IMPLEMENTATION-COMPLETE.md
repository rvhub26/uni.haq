# uni.haq — WhatsApp Auto Blast System
## Dokumentasi Lengkap Projek (Dikemaskini: 25 Jun 2026)

> **Dokumen ini adalah sumber kebenaran tunggal untuk projek uni.haq.**
> Guna untuk: debug, tambah feature, recreate sistem di mesin lain, atau pass kepada developer lain.
> Setiap kali ada perubahan sistem, dokumen ini MESTI dikemaskini.

**GitHub Repo:** https://github.com/rvhub26/uni.haq (Public)
**App aktif:** `wa-blaster/backend/index.js` — port **3001** (local) / **3002** (production)
**Root `server.js` (port 3000) adalah versi lama, abaikan.**

## FEATURE: Multi-Device Per User (v2 — 25 Jun 2026)
- Setiap user login boleh tambah sehingga **10 nombor WhatsApp** (devices)
- Setiap device ada contacts, blacklist, jadual, queue, logs sendiri
- Templates dikongsi sesama devices satu user
- Device selector dalam sidebar — klik untuk switch
- Device Manager modal: tambah, switch, reconnect, buang device
- API: `/api/devices` (GET/POST/DELETE/PUT), `/api/devices/:id/select`
- Data: `data/{userId}/{deviceId}/contacts.json` dll
- Auth: `auth/{userId}/{deviceId}/` (Baileys session per device)

---

## PRINSIP TERAS — ANTI-BAN

> **Setiap feature berkaitan blast MESTI dibina dengan anti-ban sebagai prioriti.**
> WhatsApp boleh ban nombor yang hantar secara tidak natural. Sistem kena simulate tingkah laku manusia.

### Strategi Anti-Ban Semasa (Dah Ada)
- Gap antara nombor (contactGapMs) — default 4 saat
- Gap antara template (templateGapMs) — drip campaign
- Deduplicate contacts sebelum queue — elak hantar dua kali ke nombor sama

### Strategi Anti-Ban Dirancang (Belum Bina)
- Random gap — bukan exact 4 saat, tapi random dalam julat (cth: 3–7 saat)
- Daily limit cap — max X nombor sehari, lebihan queue ke esok
- Warm-up mode — nombor baru start slow (10/hari → 30/hari → 100/hari)
- Blacklist/opt-out — kalau contact balas "STOP", auto skip
- Time-window blast — blast hanya antara jam tertentu (cth: 9am–6pm)
- Typing indicator simulate — lebih natural
- Rotate multi-nombor — gilir-gilir blast antara beberapa nombor

### Panduan Risiko Ban
| Tindakan | Risiko |
|----------|--------|
| Gap < 2 saat | Sangat Tinggi |
| Gap exact sama tiap kali | Sederhana |
| Gap random 3–7 saat | Rendah |
| > 200 nombor/hari (nombor baru) | Tinggi |
| Mesej sama persis ke semua | Tinggi |
| Mesej dengan {nama} berbeza | Rendah |
| Nombor < 6 bulan | Tinggi |
| Nombor > 1 tahun aktif | Rendah |

---

## VISI AKHIR SISTEM

1. **Online 24/7** — deploy ke VPS, bukan localhost
2. **Mobile responsive** — tim boleh akses dan guna dari telefon
3. **Dual provider blasting:**
   - Unofficial: Baileys (current, free, risiko ban)
   - Official: WhatsApp Business API / Meta Cloud API (no ban, kena daftar Meta)
4. **Web app** — boleh guna dari mana-mana browser

---

## CARA RUN (SEMASA)

```bash
cd wa-blaster/backend
npm install        # hanya kali pertama
node index.js      # atau: npm start
```

Buka browser: **http://localhost:3001**

> Port 3001. Root server.js (port 3000) adalah versi lama — jangan guna.

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
│   │   ├── contacts.js       # CRUD contacts + POST /upload + DELETE /group/:name
│   │   ├── media.js          # Upload/list/delete media files
│   │   ├── templates.js      # CRUD template library
│   │   └── schedules.js      # CRUD jadual + blast-now + queue
│   ├── data/
│   │   ├── contacts.json     # Senarai contacts (ada field kumpulan)
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
├── .gitignore                # Exclude node_modules, auth/, data/*.json
├── IMPLEMENTATION-COMPLETE.md  ← DOKUMEN INI
└── PLAN.md                   # (deprecated — semua maklumat dah dipindah ke sini)
```

---

## STRUKTUR DATA (JSON)

### contacts.json
```json
[
  {
    "id": "1234567890_0",
    "nama": "Ahmad Rizal",
    "telefon": "601112223333",
    "kumpulan": "Customer VVIP"
  }
]
```
> **Penting:** Field `kumpulan` wajib ada. Setiap Excel upload = satu kumpulan.
> Contacts lama tanpa field `kumpulan` akan dipaparkan sebagai "Umum".

### templates.json
```json
[
  {
    "id": "tmpl_1234567890",
    "name": "Hari 1 — Promosi",
    "text": "Hai {nama}, kami ada tawaran istimewa!",
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
    "templateIds": ["tmpl_aaa", "tmpl_bbb"],
    "rotationIndex": 0,
    "template": null,
    "mediaFile": null,
    "type": "one-time",
    "datetime": "2026-06-24T09:00:00.000Z",
    "contacts": "all",
    "contactGapMs": 4000,
    "templateGapMs": 86400000,
    "status": "active",
    "createdAt": "2026-06-24T08:00:00.000Z"
  }
]
```

> **Field contacts boleh jadi:**
> - `"all"` — semua contacts
> - `{ "kumpulan": ["Customer VVIP", "Customer Jun"] }` — contacts dari kumpulan tertentu

### queue.json & logs.json
Sama seperti sebelum — rujuk kod untuk struktur penuh.

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
| POST | `/api/contacts/upload` | Upload Excel (multipart: `file` + `kumpulan`) |
| DELETE | `/api/contacts/group/:name` | Buang semua contacts dalam satu kumpulan |
| DELETE | `/api/contacts/:id` | Buang satu contact |
| DELETE | `/api/contacts` | Kosongkan semua |
| GET | `/api/contacts/history` | Lihat sent history per contact |
| DELETE | `/api/contacts/history/group/:name` | Reset sent history untuk satu kumpulan |
| DELETE | `/api/contacts/history` | Reset semua sent history |

### Blacklist
| Method | URL | Fungsi |
|--------|-----|--------|
| GET | `/api/blacklist` | Semua nombor dalam blacklist |
| POST | `/api/blacklist` | Tambah ke blacklist `{ telefon, nama, sebab }` |
| DELETE | `/api/blacklist/:telefon` | Buang dari blacklist (unblock) |

### Reports
| Method | URL | Fungsi |
|--------|-----|--------|
| GET | `/api/reports/stats` | Statistik agregat (total blast, berjaya, gagal, reply, sales) |
| GET | `/api/reports/replies` | Senarai contacts yang dah reply |
| GET | `/api/reports/sales` | Semua rekod jualan |
| POST | `/api/reports/sales` | Tambah rekod jualan `{ nama, amount, notes }` |
| DELETE | `/api/reports/sales/:id` | Buang rekod jualan |

> **Upload Excel format:** Fail `.xlsx`/`.xls` dengan header `nama` dan `telefon`.
> Field `kumpulan` dihantar sebagai form field (bukan dalam Excel).

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

## FRONTEND — STRUKTUR TAB

```
Sidebar kiri (fixed, 220px)
├── 🏠 Dashboard    — status WA, 4 stat cards, log terkini
├── 👥 Contacts     — upload Excel + nama kumpulan, papar by group, delete group
├── 📝 Templates    — form tambah/edit template, senarai
├── 📅 Jadual Blast — form 4 step: template → masa mula → hantar kepada → gap
└── ⏳ Queue & Log  — pending queue, sejarah blast
```

### Jadual Blast — Form Steps
1. Pilih Template (Satu Template atau Rotation gilir-gilir)
2. Masa Mula (optional — kosong = blast sekarang)
3. Hantar Kepada: Semua Contacts / Pilih Kumpulan
4. Gap Antara Setiap Nombor

> **Nota:** Tiada pilihan "Sekali/Berulang" — semua blast adalah one-time sequential.
> Tiada "Pilih Individu" — hanya pilih by kumpulan atau semua.

---

## FLOW UTAMA

### Blast dengan Rotation + Gap Template (cara utama)
```
User simpan jadual (Step 1-4)
  → POST /api/schedules → scheduleJob()
  → delay <= 0 → runBlast() terus
  → deduplicate contacts by phone
  → enqueueRotationBlast()
  → queue.json: T1→semua contacts, T2→semua contacts+templateGap, ...
  → cron setiap minit: processQueue()
  → hantar bila sendAt <= now
  → catat logs.json
```

---

## CHECKLIST FEATURE SEMASA

- [x] Server Express port 3001
- [x] Frontend SPA sidebar 5 tab
- [x] Branding uni.haq (logo SVG, dark theme)
- [x] WhatsApp QR scan & connect (Baileys)
- [x] Session tersimpan (restart tak perlu scan)
- [x] Auto-reconnect (kecuali ban/401)
- [x] Upload Excel + nama kumpulan
- [x] Contacts dipapar by kumpulan, delete by kumpulan
- [x] Template library — simpan, edit, padam
- [x] Upload media per template (gambar/video)
- [x] Template engine — {nama}, {telefon}
- [x] Jadual blast one-time dengan masa mula optional
- [x] Rotation template ikut turutan
- [x] Gap antara nombor (anti-ban)
- [x] Gap antara template (drip campaign)
- [x] Deduplicate contacts sebelum queue
- [x] Sent history tracking — skip template yang dah pernah hantar per contact
- [x] Reset sent history per kumpulan atau semua
- [x] Blacklist / Do Not Contact — blacklist contact, auto-skip bila blast, unblock bila perlu
- [x] Search contacts — cari nama atau nombor merentasi semua kumpulan
- [x] Tab Laporan — stats (blast/berjaya/gagal/reply/sales), auto-detect reply, rekod close sales (RM)
- [x] Queue system — hantar ikut timing
- [x] Log blast
- [x] Dashboard stats

---

## ROADMAP

### Fasa 2 — Polish & Anti-Ban (Brainstorm belum mula build)
- [ ] Random gap antara nombor (bukan exact, dalam julat)
- [ ] Daily limit cap — max X nombor sehari
- [ ] Time-window blast — blast hanya dalam jam tertentu
- [ ] Mobile responsive UI
- [ ] Login / password protect
- [ ] Preview mesej sebelum blast
- [ ] Stop / pause jadual aktif
- [ ] Export log ke Excel

### Fasa 3 — Deploy Online
- [ ] Push ke GitHub → setup VPS
- [ ] GitHub Actions auto-deploy
- [ ] Setup domain
- [ ] Test akses dari telefon

### Fasa 4 — Official WhatsApp API
- [ ] Daftar Meta Business + WhatsApp Business API
- [ ] Provider layer (abstract Baileys vs Meta API)
- [ ] Settings page — pilih provider
- [ ] Template approval flow (untuk official API)

---

## NOTA PENTING

1. **Ban risk:** Baileys adalah tidak rasmi. Guna nombor spare, bukan nombor bisnes utama.
2. **Session:** Folder `auth/` simpan login. Jangan share atau commit ke Git.
3. **Port:** Server guna port **3001**.
4. **Queue persistence:** Queue dalam `queue.json`. Server restart, queue terus diproses.
5. **Hosting:** Untuk jadual jalan 24/7, perlu VPS. Sekarang server kena hidup.
6. **Bila kena ban:** Status 401 → sistem tidak reconnect → perlu scan QR baru.

---

## LOG PERUBAHAN

| Tarikh | Perubahan |
|--------|-----------|
| 24 Jun 2026 | Initial system — core blast, templates, queue, rotation |
| 24 Jun 2026 | Contacts kumpulan system — setiap Excel = satu kumpulan |
| 24 Jun 2026 | Simplify Jadual Blast — buang Sekali/Berulang, buang Pilih Individu |
| 24 Jun 2026 | Fix double-send — deduplicate contacts by phone |
| 24 Jun 2026 | Masa Mula jadi optional (kosong = blast sekarang) |
| 24 Jun 2026 | Sent history tracking — skip template dah hantar, reset per kumpulan |
| 24 Jun 2026 | Blacklist & search contacts — blacklist auto-skip blast, cari nama/nombor |
| 24 Jun 2026 | Tab Laporan — stats cards, auto-detect reply, rekod close sales RM, senarai replies |
