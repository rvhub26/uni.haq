// ============================================================
// ANGLE DETECTION — dari keyword mesej pertama prospect
// ============================================================

const ANGLE_KEYWORDS = {
  fokus: ['fokus', 'focus', 'distracted', 'tidak fokus', 'susah fokus', 'tak fokus', 'tak tumpuan', 'tak concentrate'],
  exam:  ['exam', 'periksa', 'skor', 'score', 'markah', 'result', 'keputusan', 'upsr', 'pt3', 'spm', 'ujian', 'peperiksaan'],
  pagi:  ['bangun', 'pagi', 'sekolah', 'lewat', 'mengantuk', 'tidur', 'ngantuk', 'malas bangun'],
  baca:  ['baca', 'membaca', 'lancar', 'huruf', 'mengeja', 'eja', 'tak lancar', 'lambat baca'],
  lupa:  ['lupa', 'ingat', 'hafal', 'blank', 'ingatan', 'memori', 'mudah lupa', 'susah ingat', 'hafalan'],
};

function detectAngle(text) {
  const lower = text.toLowerCase();
  for (const [angle, keywords] of Object.entries(ANGLE_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return angle;
    }
  }
  return null;
}

// ============================================================
// TEMPERATURE DETECTION — setiap reply prospect
// ============================================================

const HOT_KEYWORDS = [
  'harga', 'berapa', 'nak order', 'nak beli', 'macam mana nak order',
  'bank', 'transfer', 'cod', 'nak ambil', 'boleh order', 'nak bayar',
  'no akaun', 'nak cuba', 'nak tempah',
];

function detectTemperature(text) {
  const lower = text.toLowerCase().trim();

  if (HOT_KEYWORDS.some(kw => lower.includes(kw))) return 'HOT';
  if (lower.split(' ').length <= 3) return 'COLD';
  return 'WARM';
}

// ============================================================
// OBJECTION DETECTION
// ============================================================

const OBJECTION_MAHAL = ['mahal', 'tak mampu', 'pokai', 'takde duit', 'banyak tu', 'costly'];
const OBJECTION_FIKIR = ['fikir', 'pikir', 'consider', 'tanya suami', 'tanya husband', 'discuss', 'nanti'];
const PAYMENT_TRANSFER = ['transfer', 'online', 'bank in', 'maybank', 'cimb'];
const PAYMENT_COD = ['cod', 'cash', 'bayar bila sampai', 'pos laju'];

function detectIntent(text) {
  const lower = text.toLowerCase();
  if (OBJECTION_MAHAL.some(kw => lower.includes(kw))) return 'objection_mahal';
  if (OBJECTION_FIKIR.some(kw => lower.includes(kw))) return 'objection_fikir';
  if (PAYMENT_TRANSFER.some(kw => lower.includes(kw))) return 'payment_transfer';
  if (PAYMENT_COD.some(kw => lower.includes(kw))) return 'payment_cod';
  return null;
}

module.exports = { detectAngle, detectTemperature, detectIntent };
