# uni.haq — Roadmap & Development Plan

> Dokumen ini dikemaskini selepas setiap sesi brainstorm/build.
> Bila sambung projek, baca ni dulu untuk tahu kat mana nak sambung.

---

## PRINSIP TERAS — ANTI-BAN

> **Setiap feature berkaitan blast MESTI dibina dengan anti-ban sebagai prioriti.**

| Dah Ada | Perlu Bina |
|---------|-----------|
| ✅ Gap antara nombor (4 saat) | ❌ Random gap (3-7 saat, bukan exact) |
| ✅ Gap antara template | ❌ Daily limit cap (max X nombor/hari) |
| ✅ Deduplicate contacts | ❌ Warm-up mode (nombor baru start slow) |
| | ❌ Blacklist/opt-out auto |
| | ❌ Typing indicator simulate |
| | ❌ Time-window blast (9am-6pm sahaja) |
| | ❌ Rotate multi-nombor |
| | ❌ Variasi mesej ringan (anti-duplicate content) |

---

## VISI AKHIR

Platform blast WhatsApp yang boleh:
- Diakses **online** (bukan localhost) dari mana-mana
- **Mobile responsive** — tim guna dari telefon
- Sokong **dua provider blasting:**
  - Unofficial: Baileys (current, free, risiko ban)
  - Official: WhatsApp Business API / Meta Cloud API (no ban, ada kos)
- Boleh guna macam **web app** sebenar

---

## STATUS SEMASA ✅

### Dah Siap (Fasa 1 — Core System)
- [x] Server Express jalan di localhost:3001
- [x] Frontend SPA — sidebar 5 tab (Dashboard, Contacts, Templates, Jadual Blast, Queue & Log)
- [x] Branding uni.haq (logo SVG, dark theme)
- [x] WhatsApp connect via QR scan (Baileys)
- [x] Session tersimpan — restart tak perlu scan semula
- [x] Auto-reconnect bila putus
- [x] Upload Excel → import contacts
- [x] **Contacts sistem kumpulan** — setiap Excel = 1 kumpulan, blast ikut kumpulan
- [x] Template library — simpan, edit, padam template bernama
- [x] Upload media (gambar/video) per template
- [x] Template engine — {nama}, {telefon}
- [x] Jadual blast — mula sekarang atau set masa
- [x] Rotation template — gilir-gilir ikut turutan
- [x] Gap antara nombor (anti-ban)
- [x] Gap antara template (drip campaign)
- [x] Queue system — hantar mengikut timing
- [x] Log blast — rekod setiap hantar
- [x] Dashboard stats

---

## FASA SETERUSNYA (Brainstorm & Plan)

### Fasa 2 — Polish & Mobile Ready
> Status: **BRAINSTORM** — belum mula build

Perkara yang perlu dibincang / diputuskan:
- [ ] Mobile responsive UI — semua tab kena test di telefon
- [ ] Login / password protect (bila jadi online, semua orang boleh akses kalau tak ada auth)
- [ ] Preview mesej sebelum blast (tunjuk nama ditukar dulu)
- [ ] Stop / pause jadual yang aktif
- [ ] Export log ke Excel

### Fasa 3 — Deploy Online
> Status: **BELUM MULA**

- [ ] Push ke GitHub (repo: https://github.com/rvhub26/uni.haq)
- [ ] Setup VPS — install Node.js, clone repo
- [ ] GitHub Actions auto-deploy bila push ke main
- [ ] Setup domain
- [ ] Test akses dari telefon

### Fasa 4 — Official WhatsApp API
> Status: **BELUM MULA — perlukan daftar Meta Business**

- [ ] Daftar WhatsApp Business API (Meta Cloud API)
- [ ] Bina provider layer — abstract antara Baileys dan Meta API
- [ ] Settings page — pilih provider
- [ ] Template approval flow (untuk official API)

---

## KEPUTUSAN SENI BINA

| Perkara | Keputusan |
|---------|-----------|
| Server | Node.js + Express |
| Frontend | HTML + CSS + Vanilla JS (SPA) |
| WhatsApp (sekarang) | Baileys (unofficial) |
| WhatsApp (plan) | Tambah Meta Cloud API sebagai provider ke-2 |
| Data | JSON files (contacts, templates, schedules, logs, queue) |
| Auth (plan) | Password protect bila deploy online |
| Deploy | VPS + GitHub Actions |

---

## LOG SESI BRAINSTORM

### Sesi 1 — 24 Jun 2026
- Dibincang: Visi akhir sistem (online, mobile, dual provider)
- Keputusan: Build Baileys dulu, Official API masuk Fasa 4
- Keputusan: Brainstorm setiap fasa sebelum build
- Next brainstorm: Fasa 2 — Polish & Mobile Ready

---

*Kemaskini: 24 Jun 2026*
