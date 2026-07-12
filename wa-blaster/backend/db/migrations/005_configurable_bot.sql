USE unihaq;

-- Configurable-bot engine: angles, message templates, package tiers, AI brain config
-- become per-device dashboard-editable data instead of hardcoded JS/ENUM values.
-- Seed INSERTs below reproduce the current live Resno/Zia bot byte-for-byte so
-- the 2 devices already in production see zero behavior change after this deploy.

CREATE TABLE IF NOT EXISTS bot_angles (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  device_id   VARCHAR(40) NOT NULL,
  angle_key   VARCHAR(30) NOT NULL,
  label       VARCHAR(100) NOT NULL,
  keywords    JSON NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_device_angle (device_id, angle_key),
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bot_message_templates (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  device_id     VARCHAR(40) NOT NULL,
  angle_key     VARCHAR(30) NOT NULL DEFAULT '_shared',
  template_key  VARCHAR(50) NOT NULL,
  bubbles       JSON NOT NULL,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_device_angle_key (device_id, angle_key, template_key),
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bot_package_tiers (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  device_id     VARCHAR(40) NOT NULL,
  tier_key      VARCHAR(30) NOT NULL,
  label         VARCHAR(50) NOT NULL,
  quantity      INT NOT NULL DEFAULT 1,
  price         DECIMAL(10,2) NOT NULL DEFAULT 0,
  keywords      JSON NOT NULL,
  upsell_phrase VARCHAR(150) NULL,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_device_tier (device_id, tier_key),
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bot_brain_config (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  device_id         VARCHAR(40) UNIQUE NOT NULL,
  persona_name      VARCHAR(50) NOT NULL DEFAULT 'Zia',
  ai_system_prompt  MEDIUMTEXT NULL,
  ai_model          VARCHAR(50) NOT NULL DEFAULT 'claude-sonnet-4-6',
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

-- Loosen ENUMs that assumed fixed angle/tier sets so new config never needs a migration again
ALTER TABLE prospects MODIFY COLUMN angle VARCHAR(30) DEFAULT NULL;
ALTER TABLE orders    MODIFY COLUMN pakej VARCHAR(30) NOT NULL;

-- ============================================================
-- SEED: bot_angles (guarded — only runs once, safe to re-run script)
-- ============================================================

INSERT INTO bot_angles (device_id, angle_key, label, keywords, sort_order)
SELECT device_id, 'kaku', 'Sendi Kaku',
  JSON_ARRAY('kaku','sendi','lutut','sakit sendi','sengal','bengkak','sukar bergerak','tulang','stiff'), 0
FROM products
WHERE NOT EXISTS (SELECT 1 FROM bot_angles LIMIT 1);

INSERT INTO bot_angles (device_id, angle_key, label, keywords, sort_order)
SELECT device_id, 'tenaga', 'Tenaga Rendah',
  JSON_ARRAY('tenaga','penat','letih','lesu','stamina','tak larat','cepat penat','tak bertenaga','mengantuk sepanjang hari'), 1
FROM products
WHERE NOT EXISTS (SELECT 1 FROM bot_angles WHERE angle_key = 'tenaga');

INSERT INTO bot_angles (device_id, angle_key, label, keywords, sort_order)
SELECT device_id, 'rutin', 'Sukar Konsisten',
  JSON_ARRAY('dah cuba','banyak produk','tak konsisten','x konsisten','lupa nak makan','rumit','susah nak amalkan','produk lain'), 2
FROM products
WHERE NOT EXISTS (SELECT 1 FROM bot_angles WHERE angle_key = 'rutin');

-- ============================================================
-- SEED: bot_package_tiers — prices pulled from each device's own products row
-- ============================================================

INSERT INTO bot_package_tiers (device_id, tier_key, label, quantity, price, keywords, sort_order)
SELECT device_id, '1_botol', '1 Botol', 1, harga_1, JSON_ARRAY('1','satu','sebotol'), 0
FROM products
WHERE NOT EXISTS (SELECT 1 FROM bot_package_tiers LIMIT 1);

INSERT INTO bot_package_tiers (device_id, tier_key, label, quantity, price, keywords, sort_order)
SELECT device_id, '2_botol', 'Pakej 2 Botol', 2, harga_pakej_2, JSON_ARRAY('2','dua'), 1
FROM products
WHERE NOT EXISTS (SELECT 1 FROM bot_package_tiers WHERE tier_key = '2_botol');

INSERT INTO bot_package_tiers (device_id, tier_key, label, quantity, price, keywords, sort_order)
SELECT device_id, '3_botol', 'Pakej 3 Botol', 3, harga_pakej_3, JSON_ARRAY('3','tiga'), 2
FROM products
WHERE NOT EXISTS (SELECT 1 FROM bot_package_tiers WHERE tier_key = '3_botol');

-- ============================================================
-- SEED: bot_brain_config
-- ============================================================

INSERT INTO bot_brain_config (device_id, persona_name, ai_system_prompt, ai_model)
SELECT device_id, 'Zia', 'Kau adalah {{persona}}, seorang consultant kesihatan untuk produk supplement {{namaProduk}}.

PERSONA KAU:
- Nama: {{persona}}
- Mesra, empathy tinggi, professional — macam kawan yang faham
- Kau bukan robot — kau manusia sebenar

PRODUK:
- Nama: {{namaProduk}}
- Kategori: Sokongan kesihatan sendi & tenaga harian untuk dewasa 35+
- Harga: {{hargaLadder}}
- Ingredients: Glucosamine Sulphate, Collagen Peptide (Type II), Ekstrak Herba Terpilih, Vitamin D3
- Manfaat: Sokongan keselesaan pergerakan sendi, sokongan tenaga harian
- Cara ambil: 2 kapsul sehari selepas makan, konsisten sebagai rutin harian
- Payment: Bank transfer atau COD (ikut setting produk)

RULES COMPLIANCE (PENTING — jangan langgar):
- JANGAN sekali-kali guna perkataan: sembuh, rawat, jamin, cure, 100% berkesan, hilang terus
- {{namaProduk}} BUKAN ubat — ia sokongan rutin harian, bukan rawatan atau penyembuhan penyakit
- Kalau prospect tanya "boleh sembuhkan artritis/sakit sendi saya tak", jawab ia bukan ubat dan cadangkan rujuk doktor untuk kondisi serius
- Jangan dakwa sijil KKM/Halal wujud melainkan disahkan dalam data produk

RULES BAHASA:
- Bahasa Melayu Malaysia, informal tapi professional
- Guna "awak" untuk refer prospect (neutral, bukan gender-specific)
- Satu mesej satu idea — ayat PENDEK
- Jangan guna "-" dalam ayat
- Emoji sparingly — max 1-2 per mesej
- JANGAN nampak macam nak jual — nampak macam nak consult dan bantu

STRATEGI CLOSING:
1. Fear Amplification — sebelum present produk
2. Social proof — testimoni pengguna lain
3. Either/Or close — jangan tanya "nak beli tak?"
4. Upsell — sebotol → pakej 2 botol → pakej 3 botol
5. Urgency bila objection — stok terhad

TUJUAN: Close sale dengan closing rate minimum 50%

Return HANYA JSON, tiada text lain:
{
  "messages": ["mesej 1", "mesej 2"],
  "next_step": "string atau null",
  "prospect_temperature": "HOT atau WARM atau COLD",
  "should_close": true atau false
}', 'claude-sonnet-4-6'
FROM products
WHERE NOT EXISTS (SELECT 1 FROM bot_brain_config LIMIT 1);

-- ============================================================
-- SEED: bot_message_templates — shared (angle_key = '_shared')
-- ============================================================

INSERT INTO bot_message_templates (device_id, angle_key, template_key, bubbles, sort_order)
SELECT device_id, '_shared', 'detectAngleFallback', JSON_ARRAY(
  'Terima kasih contact {{persona}}☺️',
  '{{persona}} nak tahu, apa masalah utama awak sekarang? Sendi rasa kaku, tenaga rendah, atau ada masalah lain?'
), 0 FROM products WHERE NOT EXISTS (SELECT 1 FROM bot_message_templates LIMIT 1);

INSERT INTO bot_message_templates (device_id, angle_key, template_key, bubbles, sort_order)
SELECT device_id, '_shared', 'introSolution', JSON_ARRAY(
  'Awak, {{persona}} nak share something yang ramai dah rasa manfaat dia.',
  'Nampak perubahan dalam masa 2-3 minggu bila diamalkan konsisten. Boleh?'
), 1 FROM products WHERE NOT EXISTS (SELECT 1 FROM bot_message_templates WHERE template_key = 'introSolution');

INSERT INTO bot_message_templates (device_id, angle_key, template_key, bubbles, sort_order)
SELECT device_id, '_shared', 'uspResno', JSON_ARRAY(
  '{{namaProduk}} ni bukan supplement biasa.\n\nBahan aktif dia Glucosamine Sulphate, Collagen Peptide dan ekstrak herba terpilih — untuk sokong pergerakan sendi dan tenaga harian.',
  'Ada juga Vitamin D3 untuk sokongan kesihatan tulang dan sendi sekali.',
  'Cara ambil pun senang, 2 kapsul sehari lepas makan je.\n\nTak rumit, senang nak jadikan rutin harian.'
), 2 FROM products WHERE NOT EXISTS (SELECT 1 FROM bot_message_templates WHERE template_key = 'uspResno');

INSERT INTO bot_message_templates (device_id, angle_key, template_key, bubbles, sort_order)
SELECT device_id, '_shared', 'kajianSaintifik', JSON_ARRAY(
  'Awak, {{persona}} nak share satu fakta menarik.\n\nGlucosamine dan collagen memang biasa digunakan untuk sokong keselesaan pergerakan sendi bila diamalkan secara konsisten.',
  'Ramai pengguna kongsi lepas amalkan {{namaProduk}} dalam rutin harian sebulan dua, mereka rasa lebih selesa nak bergerak dan tak cepat penat.'
), 3 FROM products WHERE NOT EXISTS (SELECT 1 FROM bot_message_templates WHERE template_key = 'kajianSaintifik');

INSERT INTO bot_message_templates (device_id, angle_key, template_key, bubbles, sort_order)
SELECT device_id, '_shared', 'socialProof', JSON_ARRAY(
  'Awak boleh tengok sendiri apa yang pengguna lain kongsikan pasal {{namaProduk}}.',
  'Ni antara mereka yang dah jadikan {{namaProduk}} sebahagian rutin harian depa.'
), 4 FROM products WHERE NOT EXISTS (SELECT 1 FROM bot_message_templates WHERE template_key = 'socialProof');

INSERT INTO bot_message_templates (device_id, angle_key, template_key, bubbles, sort_order)
SELECT device_id, '_shared', 'closing', JSON_ARRAY(
  'Awak nak cuba sebotol dulu untuk rasa sendiri, atau terus ambil pakej yang lebih jimat?'
), 5 FROM products WHERE NOT EXISTS (SELECT 1 FROM bot_message_templates WHERE template_key = 'closing');

INSERT INTO bot_message_templates (device_id, angle_key, template_key, bubbles, sort_order)
SELECT device_id, '_shared', 'upsell', JSON_ARRAY(
  'Bagus! Tapi sebelum tu {{persona}} nak bagitahu.\n\nRamai yang ambil sebotol dulu, lepas rasa selesa terus nak repeat. Tapi kadang stok terhad, kena tunggu batch baru.',
  'Kalau ambil {{tierOptions}} sekarang, lagi jimat dan dapat penghantaran percuma, tak risau stok habis.\n\nAwak nak ambil pakej mana?'
), 6 FROM products WHERE NOT EXISTS (SELECT 1 FROM bot_message_templates WHERE template_key = 'upsell');

INSERT INTO bot_message_templates (device_id, angle_key, template_key, bubbles, sort_order)
SELECT device_id, '_shared', 'askPaymentMethod', JSON_ARRAY(
  'Awak nak bayar online transfer atau COD ye?\n\n{{persona}} nak pastikan order awak sempat masuk untuk penghantaran hari ni.'
), 7 FROM products WHERE NOT EXISTS (SELECT 1 FROM bot_message_templates WHERE template_key = 'askPaymentMethod');

INSERT INTO bot_message_templates (device_id, angle_key, template_key, bubbles, sort_order)
SELECT device_id, '_shared', 'paymentDetailsTransfer', JSON_ARRAY(
  'Awak boleh bank in ke akaun ni.\n\nLepas tu whatsapp balik resit ye, {{persona}} proses terus!',
  '{{bank1Nama}} - {{namaAkaun}} - {{bank1No}}\n{{bank2Nama}} - {{namaAkaun}} - {{bank2No}}'
), 8 FROM products WHERE NOT EXISTS (SELECT 1 FROM bot_message_templates WHERE template_key = 'paymentDetailsTransfer');

INSERT INTO bot_message_templates (device_id, angle_key, template_key, bubbles, sort_order)
SELECT device_id, '_shared', 'paymentDetailsCOD', JSON_ARRAY(
  'Ok, COD boleh!\n\n{{persona}} nak minta nama penuh dan alamat penghantaran awak ye, supaya {{persona}} boleh proses sekarang.'
), 9 FROM products WHERE NOT EXISTS (SELECT 1 FROM bot_message_templates WHERE template_key = 'paymentDetailsCOD');

INSERT INTO bot_message_templates (device_id, angle_key, template_key, bubbles, sort_order)
SELECT device_id, '_shared', 'afterOrder', JSON_ARRAY(
  'Alhamdulillah terima kasih!\n\n{{persona}} dah terima. Order awak akan diproses hari ni.',
  'Dalam 2-5 hari bekerja (Semenanjung) atau 4-7 hari (Sabah/Sarawak), {{namaProduk}} akan sampai depan pintu awak.\n\nAmalkan 2 kapsul sehari selepas makan secara konsisten ye.'
), 10 FROM products WHERE NOT EXISTS (SELECT 1 FROM bot_message_templates WHERE template_key = 'afterOrder');

INSERT INTO bot_message_templates (device_id, angle_key, template_key, bubbles, sort_order)
SELECT device_id, '_shared', 'objectionMahal', JSON_ARRAY(
  '{{persona}} faham risau pasal harga.\n\nTapi kalau kira ikut hari, {{baseQuantity}} botol {{namaProduk}} (RM{{basePrice}}) untuk {{baseDays}} hari — bawah RM{{basePerDay}} sehari, lebih murah dari secawan kopi.',
  'Lagipun kalau ambil pakej {{topQuantity}} botol, dah jimat sampai RM{{maxSavings}} dan dapat penghantaran percuma.\n\nBerbaloi untuk rutin kesihatan jangka panjang.',
  'Awak nak pakej {{tierNamesShort}}?'
), 11 FROM products WHERE NOT EXISTS (SELECT 1 FROM bot_message_templates WHERE template_key = 'objectionMahal');

INSERT INTO bot_message_templates (device_id, angle_key, template_key, bubbles, sort_order)
SELECT device_id, '_shared', 'objectionFikir', JSON_ARRAY(
  '{{persona}} faham, awak ambil masa.\n\nCuma {{persona}} nak tanya, bahagian mana yang awak masih tak pasti? {{persona}} nak pastikan awak ada semua info yang perlu.'
), 12 FROM products WHERE NOT EXISTS (SELECT 1 FROM bot_message_templates WHERE template_key = 'objectionFikir');

INSERT INTO bot_message_templates (device_id, angle_key, template_key, bubbles, sort_order)
SELECT device_id, '_shared', 'objectionFikirUrgency', JSON_ARRAY(
  'Okay no hal, {{persona}} faham.\n\nCuma stok {{namaProduk}} untuk minggu ni dah tinggal sikit. Takut awak nak order nanti kena tunggu batch baru. Nak {{persona}} hold dulu untuk awak?'
), 13 FROM products WHERE NOT EXISTS (SELECT 1 FROM bot_message_templates WHERE template_key = 'objectionFikirUrgency');

INSERT INTO bot_message_templates (device_id, angle_key, template_key, bubbles, sort_order)
SELECT device_id, '_shared', 'coldPancing_1', JSON_ARRAY(
  'Awak still kat sini?\n\n{{persona}} tanya sebab tak nak awak terlepas info penting pasal rutin kesihatan ni.'
), 14 FROM products WHERE NOT EXISTS (SELECT 1 FROM bot_message_templates WHERE template_key = 'coldPancing_1');

INSERT INTO bot_message_templates (device_id, angle_key, template_key, bubbles, sort_order)
SELECT device_id, '_shared', 'coldPancing_2', JSON_ARRAY(
  'Awak, {{persona}} harap awak okay.\n\nKalau rasa kaku atau tak bertenaga ni dibiarkan, boleh jadi makin tak selesa nak buat aktiviti harian. {{persona}} tak nak awak rasa menyesal nanti.'
), 15 FROM products WHERE NOT EXISTS (SELECT 1 FROM bot_message_templates WHERE template_key = 'coldPancing_2');

INSERT INTO bot_message_templates (device_id, angle_key, template_key, bubbles, sort_order)
SELECT device_id, '_shared', 'followUp1h', JSON_ARRAY(
  'Awak, {{persona}} just nak check, awak okay je?\n\n{{persona}} masih di sini kalau ada soalan pasal {{namaProduk}}.'
), 16 FROM products WHERE NOT EXISTS (SELECT 1 FROM bot_message_templates WHERE template_key = 'followUp1h');

INSERT INTO bot_message_templates (device_id, angle_key, template_key, bubbles, sort_order)
SELECT device_id, '_shared', 'followUp24h', JSON_ARRAY(
  'Awak, {{persona}} tahu awak busy.\n\nTapi {{persona}} tak nak awak terlepas peluang jaga sendi dan tenaga harian ni. Nak {{persona}} bantu?'
), 17 FROM products WHERE NOT EXISTS (SELECT 1 FROM bot_message_templates WHERE template_key = 'followUp24h');

INSERT INTO bot_message_templates (device_id, angle_key, template_key, bubbles, sort_order)
SELECT device_id, '_shared', 'followUp72h', JSON_ARRAY(
  'Awak, ini mungkin mesej terakhir {{persona}}.\n\n{{persona}} doakan semoga awak jumpa cara terbaik untuk rasa lebih selesa dan bertenaga. Kalau perlukan {{persona}}, {{persona}} sentiasa ada di sini.'
), 18 FROM products WHERE NOT EXISTS (SELECT 1 FROM bot_message_templates WHERE template_key = 'followUp72h');

-- ============================================================
-- SEED: bot_message_templates — angle "kaku" (Sendi Kaku)
-- ============================================================

INSERT INTO bot_message_templates (device_id, angle_key, template_key, bubbles, sort_order)
SELECT device_id, 'kaku', 'greeting', JSON_ARRAY(
  'Terima kasih contact {{persona}}☺️',
  'Awak nak settlekan masalah sendi rasa kaku ni ya.\n\nBiasanya rasa kaku tu waktu pagi je, atau sepanjang hari pun ada?'
), 0 FROM products WHERE NOT EXISTS (SELECT 1 FROM bot_message_templates WHERE angle_key = 'kaku' AND template_key = 'greeting');

INSERT INTO bot_message_templates (device_id, angle_key, template_key, bubbles, sort_order)
SELECT device_id, 'kaku', 'factFinding', JSON_ARRAY(
  '{{#tempoh}}Dah {{tempoh}} rasa macam ni ye.\n\n{{/tempoh}}Rasa kaku ni macam mana awak rasa? Susah nak bergerak waktu bangun je, atau lepas duduk/berdiri lama pun rasa sama?'
), 1 FROM products WHERE NOT EXISTS (SELECT 1 FROM bot_message_templates WHERE angle_key = 'kaku' AND template_key = 'factFinding');

INSERT INTO bot_message_templates (device_id, angle_key, template_key, bubbles, sort_order)
SELECT device_id, 'kaku', 'korekMasalah', JSON_ARRAY(
  'Memang tak selesa kan bila badan rasa kaku macam tu.\n\nAwak dah pernah cuba apa-apa sebelum ni untuk bantu sendi awak?'
), 2 FROM products WHERE NOT EXISTS (SELECT 1 FROM bot_message_templates WHERE angle_key = 'kaku' AND template_key = 'korekMasalah');

INSERT INTO bot_message_templates (device_id, angle_key, template_key, bubbles, sort_order)
SELECT device_id, 'kaku', 'fearAmplification', JSON_ARRAY(
  'Kalau rasa kaku ni dah {{tempoh|beberapa lama}} dan dibiarkan je, lama-lama ia boleh jadi makin kerap dan makin lama nak hilang.',
  'Bila sendi selalu kaku, kita jadi malas nak bergerak, akhirnya kurang aktif dan badan pun makin "tak larat". Memang menyusahkan nak buat kerja harian.'
), 3 FROM products WHERE NOT EXISTS (SELECT 1 FROM bot_message_templates WHERE angle_key = 'kaku' AND template_key = 'fearAmplification');

INSERT INTO bot_message_templates (device_id, angle_key, template_key, bubbles, sort_order)
SELECT device_id, 'kaku', 'tanyaIkhtiar', JSON_ARRAY(
  'Awak dah cuba apa-apa sebelum ni untuk bantu sendi awak?'
), 4 FROM products WHERE NOT EXISTS (SELECT 1 FROM bot_message_templates WHERE angle_key = 'kaku' AND template_key = 'tanyaIkhtiar');

INSERT INTO bot_message_templates (device_id, angle_key, template_key, bubbles, sort_order)
SELECT device_id, 'kaku', 'responseIkhtiarLain', JSON_ARRAY(
  'Urut atau pil tahan sakit tu boleh bantu sementara je.\n\nTapi kalau nak sokongan jangka panjang untuk sendi, badan perlukan bahan macam glucosamine dan collagen secara konsisten.'
), 5 FROM products WHERE NOT EXISTS (SELECT 1 FROM bot_message_templates WHERE angle_key = 'kaku' AND template_key = 'responseIkhtiarLain');

INSERT INTO bot_message_templates (device_id, angle_key, template_key, bubbles, sort_order)
SELECT device_id, 'kaku', 'introSolutionResponse', JSON_ARRAY(
  'Ramai yang datang jumpa {{persona}} dengan masalah sama macam awak.\n\nLepas amalkan {{namaProduk}} konsisten, dalam 2-3 minggu ramai kongsi rasa lebih selesa nak bergerak.'
), 6 FROM products WHERE NOT EXISTS (SELECT 1 FROM bot_message_templates WHERE angle_key = 'kaku' AND template_key = 'introSolutionResponse');

-- ============================================================
-- SEED: bot_message_templates — angle "tenaga" (Tenaga Rendah)
-- ============================================================

INSERT INTO bot_message_templates (device_id, angle_key, template_key, bubbles, sort_order)
SELECT device_id, 'tenaga', 'greeting', JSON_ARRAY(
  'Terima kasih contact {{persona}}☺️',
  'Awak nak cari sokongan untuk tenaga harian ya.\n\nBiasanya rasa cepat penat atau lesu tu waktu bila — pagi-pagi lagi, atau lepas tengah hari?'
), 0 FROM products WHERE NOT EXISTS (SELECT 1 FROM bot_message_templates WHERE angle_key = 'tenaga' AND template_key = 'greeting');

INSERT INTO bot_message_templates (device_id, angle_key, template_key, bubbles, sort_order)
SELECT device_id, 'tenaga', 'factFinding', JSON_ARRAY(
  '{{#tempoh}}Dah {{tempoh}} rasa macam ni ye.\n\n{{/tempoh}}Rasa tak bertenaga ni macam mana? Cepat penat walaupun kerja baru start, atau memang rasa lesu sepanjang hari?'
), 1 FROM products WHERE NOT EXISTS (SELECT 1 FROM bot_message_templates WHERE angle_key = 'tenaga' AND template_key = 'factFinding');

INSERT INTO bot_message_templates (device_id, angle_key, template_key, bubbles, sort_order)
SELECT device_id, 'tenaga', 'korekMasalah', JSON_ARRAY(
  'Memang penat kan kalau badan tak bertenaga tapi kerja dan tanggungjawab kena settle jugak.\n\nAwak dah pernah cuba apa-apa untuk bantu tenaga awak?'
), 2 FROM products WHERE NOT EXISTS (SELECT 1 FROM bot_message_templates WHERE angle_key = 'tenaga' AND template_key = 'korekMasalah');

INSERT INTO bot_message_templates (device_id, angle_key, template_key, bubbles, sort_order)
SELECT device_id, 'tenaga', 'fearAmplification', JSON_ARRAY(
  'Kalau tenaga rendah ni dah {{tempoh|lama}} dan dibiarkan, ia boleh jejaskan produktiviti kerja dan masa untuk keluarga atau diri sendiri.',
  'Bila selalu penat, kita jadi kurang aktif, dan lama-lama badan pun rasa "tak macam dulu". Memang menyusahkan nak kekal produktif macam tu.'
), 3 FROM products WHERE NOT EXISTS (SELECT 1 FROM bot_message_templates WHERE angle_key = 'tenaga' AND template_key = 'fearAmplification');

INSERT INTO bot_message_templates (device_id, angle_key, template_key, bubbles, sort_order)
SELECT device_id, 'tenaga', 'tanyaIkhtiar', JSON_ARRAY(
  'Awak dah cuba apa-apa sebelum ni untuk boost tenaga?'
), 4 FROM products WHERE NOT EXISTS (SELECT 1 FROM bot_message_templates WHERE angle_key = 'tenaga' AND template_key = 'tanyaIkhtiar');

INSERT INTO bot_message_templates (device_id, angle_key, template_key, bubbles, sort_order)
SELECT device_id, 'tenaga', 'responseIkhtiarLain', JSON_ARRAY(
  'Kopi atau minuman tenaga tu boost sekejap je, lepas tu penat balik.\n\n{{namaProduk}} fokus kepada sokongan tenaga jangka panjang sebagai rutin, bukan boost sekejap.'
), 5 FROM products WHERE NOT EXISTS (SELECT 1 FROM bot_message_templates WHERE angle_key = 'tenaga' AND template_key = 'responseIkhtiarLain');

INSERT INTO bot_message_templates (device_id, angle_key, template_key, bubbles, sort_order)
SELECT device_id, 'tenaga', 'introSolutionResponse', JSON_ARRAY(
  'Ramai yang datang jumpa {{persona}} dengan masalah sama.\n\nLepas amalkan {{namaProduk}}, ramai kongsi rasa lebih bertenaga untuk teruskan aktiviti harian tanpa cepat penat.'
), 6 FROM products WHERE NOT EXISTS (SELECT 1 FROM bot_message_templates WHERE angle_key = 'tenaga' AND template_key = 'introSolutionResponse');

-- ============================================================
-- SEED: bot_message_templates — angle "rutin" (Sukar Konsisten)
-- ============================================================

INSERT INTO bot_message_templates (device_id, angle_key, template_key, bubbles, sort_order)
SELECT device_id, 'rutin', 'greeting', JSON_ARRAY(
  'Terima kasih contact {{persona}}☺️',
  'Awak nak cari rutin kesihatan yang senang nak diamalkan ya.\n\nSelama ni apa yang buat awak susah nak konsisten — lupa nak makan, atau rasa proses dia rumit?'
), 0 FROM products WHERE NOT EXISTS (SELECT 1 FROM bot_message_templates WHERE angle_key = 'rutin' AND template_key = 'greeting');

INSERT INTO bot_message_templates (device_id, angle_key, template_key, bubbles, sort_order)
SELECT device_id, 'rutin', 'factFinding', JSON_ARRAY(
  '{{#tempoh}}Dah {{tempoh}} cuba macam-macam ye.\n\n{{/tempoh}}Boleh cerita sikit, apa produk atau cara yang awak pernah cuba sebelum ni?'
), 1 FROM products WHERE NOT EXISTS (SELECT 1 FROM bot_message_templates WHERE angle_key = 'rutin' AND template_key = 'factFinding');

INSERT INTO bot_message_templates (device_id, angle_key, template_key, bubbles, sort_order)
SELECT device_id, 'rutin', 'korekMasalah', JSON_ARRAY(
  'Memang biasa jadi macam tu bila proses rumit atau perlu ingat banyak benda.\n\nAwak dah pernah cuba supplement atau produk kesihatan lain sebelum ni?'
), 2 FROM products WHERE NOT EXISTS (SELECT 1 FROM bot_message_templates WHERE angle_key = 'rutin' AND template_key = 'korekMasalah');

INSERT INTO bot_message_templates (device_id, angle_key, template_key, bubbles, sort_order)
SELECT device_id, 'rutin', 'fearAmplification', JSON_ARRAY(
  'Kalau setiap kali cuba produk baru tapi tak konsisten, hasil pun sukar nampak — akhirnya rasa macam "buang duit" je.',
  'Lama-lama boleh buat kita give up terus nak jaga kesihatan, sedangkan badan makin perlukan sokongan bila umur meningkat.'
), 3 FROM products WHERE NOT EXISTS (SELECT 1 FROM bot_message_templates WHERE angle_key = 'rutin' AND template_key = 'fearAmplification');

INSERT INTO bot_message_templates (device_id, angle_key, template_key, bubbles, sort_order)
SELECT device_id, 'rutin', 'tanyaIkhtiar', JSON_ARRAY(
  'Apa yang buat awak susah nak konsisten dengan produk yang awak cuba sebelum ni?'
), 4 FROM products WHERE NOT EXISTS (SELECT 1 FROM bot_message_templates WHERE angle_key = 'rutin' AND template_key = 'tanyaIkhtiar');

INSERT INTO bot_message_templates (device_id, angle_key, template_key, bubbles, sort_order)
SELECT device_id, 'rutin', 'responseIkhtiarLain', JSON_ARRAY(
  'Memang ramai rasa macam tu bila proses rumit.\n\n{{namaProduk}} direka senang — 2 kapsul sehari je, tak perlu proses ribet, senang jadi rutin.'
), 5 FROM products WHERE NOT EXISTS (SELECT 1 FROM bot_message_templates WHERE angle_key = 'rutin' AND template_key = 'responseIkhtiarLain');

INSERT INTO bot_message_templates (device_id, angle_key, template_key, bubbles, sort_order)
SELECT device_id, 'rutin', 'introSolutionResponse', JSON_ARRAY(
  'Ramai yang datang jumpa {{persona}} dengan masalah sama — susah nak konsisten.\n\nLepas cuba {{namaProduk}}, ramai kongsi senang je nak amalkan sebab cuma 2 kapsul sehari.'
), 6 FROM products WHERE NOT EXISTS (SELECT 1 FROM bot_message_templates WHERE angle_key = 'rutin' AND template_key = 'introSolutionResponse');
