// ============================================================
// Semua template mesej UniBot ikut skrip Resno
// Setiap function return array — setiap string = satu mesej berasingan
// ============================================================

// ============================================================
// SHARED — sama untuk semua angle
// ============================================================

function introSolution() {
  return [
    'Awak, Aina nak share something yang ramai dah rasa manfaat dia.',
    'Nampak perubahan dalam masa 2-3 minggu bila diamalkan konsisten. Boleh?',
  ];
}

function uspResno() {
  return [
    'Resno ni bukan supplement biasa.\n\nBahan aktif dia Glucosamine Sulphate, Collagen Peptide dan ekstrak herba terpilih — untuk sokong pergerakan sendi dan tenaga harian.',
    'Ada juga Vitamin D3 untuk sokongan kesihatan tulang dan sendi sekali.',
    'Cara ambil pun senang, 2 kapsul sehari lepas makan je.\n\nTak rumit, senang nak jadikan rutin harian.',
  ];
}

function kajianSaintifik() {
  return [
    'Awak, Aina nak share satu fakta menarik.\n\nGlucosamine dan collagen memang biasa digunakan untuk sokong keselesaan pergerakan sendi bila diamalkan secara konsisten.',
    'Ramai pengguna kongsi lepas amalkan Resno dalam rutin harian sebulan dua, mereka rasa lebih selesa nak bergerak dan tak cepat penat.',
  ];
}

function socialProof() {
  return [
    'Awak boleh tengok sendiri apa yang pengguna lain kongsikan pasal Resno.',
    'Ni antara mereka yang dah jadikan Resno sebahagian rutin harian depa.',
  ];
}

function closing() {
  return ['Awak nak cuba sebotol dulu untuk rasa sendiri, atau terus ambil pakej yang lebih jimat?'];
}

function upsell() {
  return [
    'Bagus! Tapi sebelum tu Aina nak bagitahu.\n\nRamai yang ambil sebotol dulu, lepas rasa selesa terus nak repeat. Tapi kadang stok terhad, kena tunggu batch baru.',
    'Kalau ambil pakej 2 botol RM159 atau pakej 3 botol RM219 sekarang, lagi jimat dan dapat penghantaran percuma, tak risau stok habis.\n\nAwak nak ambil pakej mana?',
  ];
}

function askPaymentMethod() {
  return [
    'Awak nak bayar online transfer atau COD ye?\n\nAina nak pastikan order awak sempat masuk untuk penghantaran hari ni.',
  ];
}

function paymentDetailsTransfer(product) {
  return [
    'Awak boleh bank in ke akaun ni.\n\nLepas tu whatsapp balik resit ye, Aina proses terus!',
    `${product.bank_1_nama} - ${product.nama_akaun} - ${product.bank_1_no}\n${product.bank_2_nama} - ${product.nama_akaun} - ${product.bank_2_no}`,
  ];
}

function paymentDetailsCOD() {
  return [
    'Ok, COD boleh!\n\nAina nak minta nama penuh dan alamat penghantaran awak ye, supaya Aina boleh proses sekarang.',
  ];
}

function afterOrder() {
  return [
    'Alhamdulillah terima kasih!\n\nAina dah terima. Order awak akan diproses hari ni.',
    'Dalam 2-5 hari bekerja (Semenanjung) atau 4-7 hari (Sabah/Sarawak), Resno akan sampai depan pintu awak.\n\nAmalkan 2 kapsul sehari selepas makan secara konsisten ye.',
  ];
}

function objectionMahal() {
  return [
    'Aina faham risau pasal harga.\n\nTapi kalau kira ikut hari, 1 botol Resno (RM89) untuk 30 hari — bawah RM3 sehari, lebih murah dari secawan kopi.',
    'Lagipun kalau ambil pakej 3 botol, dah jimat sampai RM48 dan dapat penghantaran percuma.\n\nBerbaloi untuk rutin kesihatan jangka panjang.',
    'Awak nak pakej 2 botol atau 3 botol?',
  ];
}

function objectionFikir() {
  return [
    'Aina faham, awak ambil masa.\n\nCuma Aina nak tanya, bahagian mana yang awak masih tak pasti? Aina nak pastikan awak ada semua info yang perlu.',
  ];
}

function objectionFikirUrgency() {
  return [
    'Okay no hal, Aina faham.\n\nCuma stok Resno untuk minggu ni dah tinggal sikit. Takut awak nak order nanti kena tunggu batch baru. Nak Aina hold dulu untuk awak?',
  ];
}

function coldPancing(attempt) {
  if (attempt === 1) {
    return ['Awak still kat sini?\n\nAina tanya sebab tak nak awak terlepas info penting pasal rutin kesihatan ni.'];
  }
  return ['Awak, Aina harap awak okay.\n\nKalau rasa kaku atau tak bertenaga ni dibiarkan, boleh jadi makin tak selesa nak buat aktiviti harian. Aina tak nak awak rasa menyesal nanti.'];
}

function followUp1h() {
  return ['Awak, Aina just nak check, awak okay je?\n\nAina masih di sini kalau ada soalan pasal Resno.'];
}

function followUp24h() {
  return ['Awak, Aina tahu awak busy.\n\nTapi Aina tak nak awak terlepas peluang jaga sendi dan tenaga harian ni. Nak Aina bantu?'];
}

function followUp72h() {
  return ['Awak, ini mungkin mesej terakhir Aina.\n\nAina doakan semoga awak jumpa cara terbaik untuk rasa lebih selesa dan bertenaga. Kalau perlukan Aina, Aina sentiasa ada di sini.'];
}

// ============================================================
// ANGLE 1 — SENDI KAKU
// ============================================================

const kaku = {
  greeting() {
    return [
      'Terima kasih contact Aina☺️',
      'Awak nak settlekan masalah sendi rasa kaku ni ya.\n\nBiasanya rasa kaku tu waktu pagi je, atau sepanjang hari pun ada?',
    ];
  },
  factFinding(tempoh) {
    const t = tempoh ? `Dah ${tempoh} rasa macam ni ye.\n\n` : '';
    return [`${t}Rasa kaku ni macam mana awak rasa? Susah nak bergerak waktu bangun je, atau lepas duduk/berdiri lama pun rasa sama?`];
  },
  korekMasalah() {
    return ['Memang tak selesa kan bila badan rasa kaku macam tu.\n\nAwak dah pernah cuba apa-apa sebelum ni untuk bantu sendi awak?'];
  },
  fearAmplification(tempoh) {
    const t = tempoh || 'beberapa lama';
    return [
      `Kalau rasa kaku ni dah ${t} dan dibiarkan je, lama-lama ia boleh jadi makin kerap dan makin lama nak hilang.`,
      'Bila sendi selalu kaku, kita jadi malas nak bergerak, akhirnya kurang aktif dan badan pun makin "tak larat". Memang menyusahkan nak buat kerja harian.',
    ];
  },
  tanyaIkhtiar() {
    return ['Awak dah cuba apa-apa sebelum ni untuk bantu sendi awak?'];
  },
  responseIkhtiarLain() {
    return ['Urut atau pil tahan sakit tu boleh bantu sementara je.\n\nTapi kalau nak sokongan jangka panjang untuk sendi, badan perlukan bahan macam glucosamine dan collagen secara konsisten.'];
  },
  introSolutionResponse() {
    return ['Ramai yang datang jumpa Aina dengan masalah sama macam awak.\n\nLepas amalkan Resno konsisten, dalam 2-3 minggu ramai kongsi rasa lebih selesa nak bergerak.'];
  },
};

// ============================================================
// ANGLE 2 — TENAGA RENDAH
// ============================================================

const tenaga = {
  greeting() {
    return [
      'Terima kasih contact Aina☺️',
      'Awak nak cari sokongan untuk tenaga harian ya.\n\nBiasanya rasa cepat penat atau lesu tu waktu bila — pagi-pagi lagi, atau lepas tengah hari?',
    ];
  },
  factFinding(tempoh) {
    const t = tempoh ? `Dah ${tempoh} rasa macam ni ye.\n\n` : '';
    return [`${t}Rasa tak bertenaga ni macam mana? Cepat penat walaupun kerja baru start, atau memang rasa lesu sepanjang hari?`];
  },
  korekMasalah() {
    return ['Memang penat kan kalau badan tak bertenaga tapi kerja dan tanggungjawab kena settle jugak.\n\nAwak dah pernah cuba apa-apa untuk bantu tenaga awak?'];
  },
  fearAmplification(tempoh) {
    const t = tempoh || 'lama';
    return [
      `Kalau tenaga rendah ni dah ${t} dan dibiarkan, ia boleh jejaskan produktiviti kerja dan masa untuk keluarga atau diri sendiri.`,
      'Bila selalu penat, kita jadi kurang aktif, dan lama-lama badan pun rasa "tak macam dulu". Memang menyusahkan nak kekal produktif macam tu.',
    ];
  },
  tanyaIkhtiar() {
    return ['Awak dah cuba apa-apa sebelum ni untuk boost tenaga?'];
  },
  responseIkhtiarLain() {
    return ['Kopi atau minuman tenaga tu boost sekejap je, lepas tu penat balik.\n\nResno fokus kepada sokongan tenaga jangka panjang sebagai rutin, bukan boost sekejap.'];
  },
  introSolutionResponse() {
    return ['Ramai yang datang jumpa Aina dengan masalah sama.\n\nLepas amalkan Resno, ramai kongsi rasa lebih bertenaga untuk teruskan aktiviti harian tanpa cepat penat.'];
  },
};

// ============================================================
// ANGLE 3 — SUSAH KONSISTEN / DAH CUBA MACAM-MACAM
// ============================================================

const rutin = {
  greeting() {
    return [
      'Terima kasih contact Aina☺️',
      'Awak nak cari rutin kesihatan yang senang nak diamalkan ya.\n\nSelama ni apa yang buat awak susah nak konsisten — lupa nak makan, atau rasa proses dia rumit?',
    ];
  },
  factFinding(tempoh) {
    const t = tempoh ? `Dah ${tempoh} cuba macam-macam ye.\n\n` : '';
    return [`${t}Boleh cerita sikit, apa produk atau cara yang awak pernah cuba sebelum ni?`];
  },
  korekMasalah() {
    return ['Memang biasa jadi macam tu bila proses rumit atau perlu ingat banyak benda.\n\nAwak dah pernah cuba supplement atau produk kesihatan lain sebelum ni?'];
  },
  fearAmplification() {
    return [
      'Kalau setiap kali cuba produk baru tapi tak konsisten, hasil pun sukar nampak — akhirnya rasa macam "buang duit" je.',
      'Lama-lama boleh buat kita give up terus nak jaga kesihatan, sedangkan badan makin perlukan sokongan bila umur meningkat.',
    ];
  },
  tanyaIkhtiar() {
    return ['Apa yang buat awak susah nak konsisten dengan produk yang awak cuba sebelum ni?'];
  },
  responseIkhtiarLain() {
    return ['Memang ramai rasa macam tu bila proses rumit.\n\nResno direka senang — 2 kapsul sehari je, tak perlu proses ribet, senang jadi rutin.'];
  },
  introSolutionResponse() {
    return ['Ramai yang datang jumpa Aina dengan masalah sama — susah nak konsisten.\n\nLepas cuba Resno, ramai kongsi senang je nak amalkan sebab cuma 2 kapsul sehari.'];
  },
};

module.exports = {
  // shared
  introSolution,
  uspResno,
  kajianSaintifik,
  socialProof,
  closing,
  upsell,
  askPaymentMethod,
  paymentDetailsTransfer,
  paymentDetailsCOD,
  afterOrder,
  objectionMahal,
  objectionFikir,
  objectionFikirUrgency,
  coldPancing,
  followUp1h,
  followUp24h,
  followUp72h,
  // angle scripts
  kaku,
  tenaga,
  rutin,
};
