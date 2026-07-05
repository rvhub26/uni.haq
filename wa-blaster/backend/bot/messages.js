// ============================================================
// Semua template mesej ZiaBot ikut skrip sebenar
// Setiap function return array — setiap string = satu mesej berasingan
// ============================================================

// ============================================================
// SHARED — sama untuk semua angle
// ============================================================

function introSolution() {
  return [
    'Akak, Zia nak sharekan something yang ramai ibu-ibu dah cuba.',
    'Nampak perubahan anak dalam masa 2 minggu. Boleh?',
  ];
}

function uspExama() {
  return [
    'Exama ni bukan supplement biasa akak.\n\nDah dapat kelulusan KKM dan HALAL JAKIM.',
    'Dia guna kaedah hemopati, bahan dia diserap terus ke dalam darah.\n\nKerja dia lagi cepat berbanding supplement biasa.',
    'Bahan aktif dia ada Magnesium, Potassium dan Calcium Phosphate.\n\nMemang makanan utama otak. Bila otak dapat nutrisi yang dia perlukan, fokus anak automatically jadi lagi baik.',
  ];
}

function kajianSaintifik() {
  return [
    'Akak, ni Zia nak share satu kajian menarik.\n\nJurnal Magnesium Research dari Perancis dah buktikan, kanak-kanak yang kurang Magnesium, otak susah fokus dan mudah lupa.',
    'Lepas dapat supplement Magnesium, dalam 2 bulan cikgu sekolah sendiri nampak perubahan.\n\nAnak lebih fokus, lebih tenang masa belajar.',
  ];
}

function socialProof() {
  return [
    'Akak boleh tengok sendiri apa yang ibu-ibu lain cakap pasal Exama.',
    'Ni antara ibu-ibu yang dah percayakan Exama untuk anak dorang akak.',
  ];
}

function closing() {
  return ['Akak nak cuba sebotol dulu, atau nak terus ambil pakej yang lebih jimat?'];
}

function upsell() {
  return [
    'Bagus akak! Tapi sebelum tu Zia nak bagitahu.\n\nRamai ibu-ibu yang ambil sebotol dulu, lepas nampak result anak dalam 2 minggu terus nak repeat. Tapi masa tu kadang stok dah habis, kena tunggu.',
    'Kalau ambil pakej 3 botol RM100 atau pakej 6 botol RM180 sekarang, lagi jimat dan tak risau stok habis tengah-tengah anak nak exam.\n\nAkak nak ambil pakej mana?',
  ];
}

function askPaymentMethod() {
  return [
    'Akak nak bayar online transfer atau COD ye?\n\nZia nak pastikan order akak sempat masuk untuk penghantaran hari ni.',
  ];
}

function paymentDetailsTransfer(product) {
  return [
    'Akak boleh bank in ke akaun ni.\n\nLepas tu whatsapp balik resit ye, Zia proses terus!',
    `${product.bank_1_nama} - ${product.nama_akaun} - ${product.bank_1_no}\n${product.bank_2_nama} - ${product.nama_akaun} - ${product.bank_2_no}`,
  ];
}

function paymentDetailsCOD() {
  return [
    'Ok akak, COD boleh!\n\nZia nak minta nama penuh dan alamat penghantaran akak ye, supaya Zia boleh proses sekarang.',
  ];
}

function afterOrder() {
  return [
    'Alhamdulillah terima kasih akak!\n\nZia dah terima. Order akak akan diproses hari ni.',
    'Dalam 3-5 hari bekerja Exama dah sampai depan pintu akak.\n\nAmalkan 2 biji sehari selepas makan. Dalam 2 minggu akak akan mula nampak perubahan anak insyaAllah.',
  ];
}

function objectionMahal() {
  return [
    'Zia faham akak.\n\nTapi kalau fikir balik, tuisyen sebulan boleh cecah RM200-RM300, tapi fokus anak still sama je.',
    'Exama pakej 3 botol RM100 je, tahan 3 bulan.\n\nBerbaloi sangat akak.',
    'Ramai ibu-ibu yang rasa macam tu jugak akak.\n\nTapi lepas cuba baru dorang sedar, RM100 tu pelaburan untuk masa depan anak, bukan belanja.',
    'Akak nak pakej 3 botol atau 6 botol?',
  ];
}

function objectionFikir() {
  return [
    'Zia faham akak, ambil masa.\n\nTapi Zia nak tanya, bahagian mana yang akak masih tak pasti? Zia nak pastikan akak ada semua info yang akak perlukan.',
  ];
}

function objectionFikirUrgency() {
  return [
    'Ok akak no hal, Zia faham.\n\nCuma stok Exama untuk minggu ni dah tinggal sikit. Takut akak nak order nanti kena tunggu batch baru. Akak nak Zia hold dulu untuk akak?',
  ];
}

function coldPancing(attempt) {
  if (attempt === 1) {
    return ['Akak still kat sini?\n\nZia tanya sebab Zia tak nak akak terlepas info penting pasal anak akak.'];
  }
  return ['Akak, Zia betul-betul risau dengan anak akak.\n\nKalau masalah ni dibiarkan, makin lama makin susah nak kejar. Zia tak nak akak rasa menyesal nanti.'];
}

function followUp1h() {
  return ['Akak, Zia just nak check, akak okay je?\n\nZia masih kat sini kalau akak ada soalan.'];
}

function followUp24h() {
  return ['Akak, Zia tahu akak busy.\n\nTapi Zia tak nak akak terlepas peluang ni. Akak nak Zia bantu?'];
}

function followUp72h() {
  return ['Akak, ini mungkin mesej terakhir Zia.\n\nZia doakan semoga masalah anak akak selesai dengan cara terbaik. Kalau akak perlukan Zia, Zia sentiasa ada di sini.'];
}

// ============================================================
// ANGLE 1 — SUSAH FOKUS
// ============================================================

const fokus = {
  greeting() {
    return [
      'Terima kasih contact Zia☺️',
      'Akak nak settlekan masalah anak susah fokus ya.\n\nAnak akak umur berapa tu kak?',
    ];
  },
  factFinding(darjah) {
    const d = darjah ? `Oh darjah ${darjah} la tu.\n\n` : '';
    return [`${d}Susah fokus ni macam mana kak? Masa belajar asyik nak main je, atau duduk depan buku tapi macam tak masuk-masuk?`];
  },
  korekMasalah() {
    return ['Memang macam tu la bila otak anak tak dapat nutrisi yang cukup.\n\nAkak dah pernah cuba bagi supplement untuk anak tak sebelum ni?'];
  },
  fearAmplification(darjah) {
    const d = darjah || '2';
    return [
      `Kak, kalau sekarang darjah ${d} dah susah fokus, bayangkan bila masuk darjah 4, darjah 5.\n\nSubjek makin banyak, hafalan makin berat. Masa tu lah lagi susah nak kejar.`,
      'Dan bila dah ketinggalan, anak mula rasa down, tak confident.\n\nLama-lama dia sendiri hilang semangat nak belajar. Kita sebagai ibu, tengok anak macam tu memang sebak dalam hati.',
    ];
  },
  tanyaIkhtiar() {
    return ['Akak dah cuba apa-apa sebelum ni untuk bantu anak?'];
  },
  responseIkhtiarTuisyen() {
    return ['Tuisyen memang bagus kak.\n\nTapi kalau otak anak tak ready nak absorb, cikgu terbaik pun susah nak masuk.'];
  },
  introSolutionResponse() {
    return ['Ramai ibu-ibu datang kat Zia dengan masalah sama macam akak.\n\nLepas dorang bagi Exama, dalam masa 2 minggu cikgu sekolah sendiri yang perasan anak dah lain.'];
  },
};

// ============================================================
// ANGLE 2 — SKOR EXAM
// ============================================================

const exam = {
  greeting() {
    return [
      'Terima kasih contact Zia☺️',
      'Akak nak anak score cemerlang dalam exam ya.\n\nAnak akak exam apa dekat ni kak?',
    ];
  },
  factFinding() {
    return ['Okay, exam memang penting.\n\nAnak akak dah mula study ke? Atau masalahnya dia study tapi result tak kena dengan usaha?'];
  },
  korekMasalah() {
    return ['Memang tu la yang paling menyedihkan kak, dah usaha tapi result tak ikut.\n\nAkak dah pernah cuba bagi supplement untuk anak tak sebelum ni?'];
  },
  fearAmplification() {
    return [
      'Kak, exam ni peluang sekali je.\n\nKalau result tak cemerlang, pintu universiti awam, biasiswa, semua tu bergantung kat keputusan exam ni.',
      'Dan yang paling sebak, anak dah usaha, dah korbankan masa tidur, tapi result masih tak kena.\n\nKita sebagai ibu tengok anak penat macam tu memang sebak dalam hati.',
    ];
  },
  tanyaIkhtiar() {
    return ['Akak dah cuba apa-apa untuk bantu anak prepare exam?'];
  },
  introSolutionResponse() {
    return ['Ramai ibu-ibu datang kat Zia dengan masalah sama.\n\nLepas bagi Exama, anak jadi lebih fokus, lebih mudah ingat, dan masa exam tak blank dah.'];
  },
  coldPancing2() {
    return ['Akak, Zia tanya sebab Zia betul-betul risau dengan anak akak.\n\nExam dah makin dekat, kalau masalah ni dibiarkan, makin susah nak kejar nanti. Zia tak nak akak rasa menyesal.'];
  },
  followUp72h() {
    return ['Akak, ini mungkin mesej terakhir Zia.\n\nZia doakan semoga anak akak berjaya cemerlang dalam exam nanti. Kalau akak perlukan Zia, Zia sentiasa ada di sini.'];
  },
};

// ============================================================
// ANGLE 3 — SUSAH BANGUN PAGI
// ============================================================

const pagi = {
  greeting() {
    return [
      'Terima kasih contact Zia☺️',
      'Akak nak settlekan masalah anak susah bangun pagi ya.\n\nAnak akak umur berapa tu kak?',
    ];
  },
  factFinding(darjah) {
    const d = darjah ? `Oh darjah ${darjah} la tu.\n\n` : '';
    return [`${d}Susah bangun pagi ni macam mana kak? Akak kena kejut berkali-kali, atau dia bangun tapi mengantuk je sepanjang hari?`];
  },
  korekMasalah() {
    return ['Memang penat kan kak bila kena kejut anak pagi-pagi.\n\nAkak dah pernah cuba bagi supplement untuk anak tak sebelum ni?'];
  },
  fearAmplification() {
    return [
      'Kak, kalau anak selalu mengantuk pagi, dia sampai sekolah pun otak dia belum fully on lagi.\n\nCikgu ajar dari awal, dia dah terlepas. Lama-lama ketinggalan makin jauh.',
      'Dan bila anak selalu mengantuk di sekolah, cikgu pun mula perasan.\n\nKita sebagai ibu rasa malu, macam orang nampak kita tak pandai jaga anak elok-elok.',
    ];
  },
  tanyaIkhtiar() {
    return ['Akak dah cuba apa-apa untuk bantu anak selain kejut pagi-pagi?'];
  },
  introSolutionResponse() {
    return ['Ramai ibu-ibu datang kat Zia dengan masalah sama.\n\nLepas bagi Exama, anak jadi lebih segar, lebih mudah bangun pagi dan lebih alert masa kat sekolah.'];
  },
};

// ============================================================
// ANGLE 4 — TAK LANCAR BACA
// ============================================================

const baca = {
  greeting() {
    return [
      'Terima kasih contact Zia☺️',
      'Akak nak bantu anak jadi lebih lancar membaca ya.\n\nAnak akak darjah berapa sekarang kak?',
    ];
  },
  factFinding(darjah) {
    const d = darjah ? `Oh darjah ${darjah} la tu.\n\n` : '';
    return [`${d}Tak lancar baca ni macam mana kak? Dia kenal huruf tapi susah nak sambung perkataan, atau baca tapi tak faham apa yang dia baca?`];
  },
  korekMasalah() {
    return ['Memang susah kan kak bila tengok anak struggle nak baca.\n\nAkak dah pernah cuba bagi supplement untuk anak tak sebelum ni?'];
  },
  fearAmplification() {
    return [
      'Kak, kalau masalah bacaan ni tak settle sekarang, semua subjek lain pun akan terkesan.\n\nMatematik pun kena baca soalan, Sains pun kena baca. Bila bacaan lemah, semua subjek pun lemah.',
      'Dan bila anak nampak kawan-kawan dia dah boleh baca laju, dia mula rasa rendah diri.\n\nKita sebagai ibu tengok anak macam tu memang sebak dalam hati.',
    ];
  },
  tanyaIkhtiar() {
    return ['Akak dah cuba apa-apa untuk bantu anak membaca?'];
  },
  introSolutionResponse() {
    return ['Ramai ibu-ibu datang kat Zia dengan masalah sama.\n\nLepas bagi Exama, anak jadi lebih mudah proses apa yang dia baca, lebih faham dan lebih lancar.'];
  },
};

// ============================================================
// ANGLE 5 — MUDAH LUPA
// ============================================================

const lupa = {
  greeting() {
    return [
      'Terima kasih contact Zia☺️',
      'Akak nak settlekan masalah anak mudah lupa ya.\n\nAnak akak umur berapa tu kak?',
    ];
  },
  factFinding(darjah) {
    const d = darjah ? `Oh darjah ${darjah} la tu.\n\n` : '';
    return [`${d}Mudah lupa ni macam mana kak? Hafal malam esok dah lupa, atau belajar tapi bila exam blank je?`];
  },
  korekMasalah() {
    return ['Memang menyedihkan kan kak bila anak dah susah payah hafal tapi still lupa.\n\nAkak dah pernah cuba bagi supplement untuk anak tak sebelum ni?'];
  },
  fearAmplification() {
    return [
      'Kak, kalau masalah mudah lupa ni tak settle, exam makin dekat pun makin susah.\n\nDah hafal berkali-kali pun, bila masuk dewan exam semua ilang. Masa tu lah paling sedih.',
      'Dan anak yang selalu lupa ni lama-lama dia sendiri give up nak hafal.\n\nKita sebagai ibu tengok anak putus asa macam tu memang sebak dalam hati.',
    ];
  },
  tanyaIkhtiar() {
    return ['Akak dah cuba apa-apa untuk bantu anak ingat pelajaran?'];
  },
  introSolutionResponse() {
    return ['Ramai ibu-ibu datang kat Zia dengan masalah sama.\n\nLepas bagi Exama, anak jadi lagi mudah ingat, hafalan dia lebih kuat dan masa exam tak blank dah.'];
  },
};

module.exports = {
  // shared
  introSolution,
  uspExama,
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
  fokus,
  exam,
  pagi,
  baca,
  lupa,
};
