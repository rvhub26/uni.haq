const msg = require('./messages');
const { detectAngle, detectTemperature, detectIntent } = require('./detector');
const humanizer = require('./humanizer');
const prospectsRepo = require('../repos/prospects');
const ordersRepo = require('../repos/orders');
const outbound = require('../outbound');
const leadsExcel = require('./leadsExcel');
const telegram = require('./telegram');

// ============================================================
// MAIN FLOW PROCESSOR
// State machine — setiap step trigger next step
// ============================================================

async function processFlow(userId, deviceId, prospect, inboundText, product, settings) {
  const step = prospect.current_step;
  const temperature = detectTemperature(inboundText);
  const intent = detectIntent(inboundText);

  // Update temperature & last message time
  await prospectsRepo.updateFields(deviceId, prospect.phone_number, {
    temperature,
    last_message_at: new Date(),
  });

  // HOT prospect — skip terus ke closing
  if (temperature === 'HOT' && !['payment_transfer', 'payment_cod', 'after_order', 'get_delivery'].includes(step)) {
    await prospectsRepo.updateStep(deviceId, prospect.phone_number, 'closing');
    await sendMessages(userId, deviceId, prospect.phone_number, msg.closing());
    return;
  }

  // Objection handler — boleh berlaku pada mana-mana step
  if (intent === 'objection_mahal') {
    await sendMessages(userId, deviceId, prospect.phone_number, msg.objectionMahal());
    await prospectsRepo.updateStep(deviceId, prospect.phone_number, 'ask_payment');
    return;
  }

  if (intent === 'objection_fikir') {
    if (prospect.cold_attempts >= 1) {
      await sendMessages(userId, deviceId, prospect.phone_number, msg.objectionFikirUrgency());
    } else {
      await sendMessages(userId, deviceId, prospect.phone_number, msg.objectionFikir());
      await prospectsRepo.incrementColdAttempts(deviceId, prospect.phone_number);
    }
    return;
  }

  // Route ikut step semasa
  switch (step) {
    case 'detect_angle':
      await handleDetectAngle(userId, deviceId, prospect, inboundText, product);
      break;
    case 'fact_finding':
      await handleFactFinding(userId, deviceId, prospect, inboundText);
      break;
    case 'korek_masalah':
      await handleKorekMasalah(userId, deviceId, prospect, inboundText);
      break;
    case 'fear_amplification':
      await handleFearAmplification(userId, deviceId, prospect, inboundText);
      break;
    case 'tanya_ikhtiar':
      await handleTanyaIkhtiar(userId, deviceId, prospect, inboundText);
      break;
    case 'intro_solution':
      await handleIntroSolution(userId, deviceId, prospect, inboundText);
      break;
    case 'usp':
      await handleUSP(userId, deviceId, prospect, product);
      break;
    case 'social_proof':
      await handleSocialProof(userId, deviceId, prospect, product);
      break;
    case 'closing':
      await handleClosing(userId, deviceId, prospect, inboundText);
      break;
    case 'upsell':
      await handleUpsell(userId, deviceId, prospect, inboundText);
      break;
    case 'ask_payment':
      await handleAskPayment(userId, deviceId, prospect, inboundText, product);
      break;
    case 'get_delivery':
      await handleGetDelivery(userId, deviceId, prospect, inboundText, product, settings);
      break;
    case 'after_order':
      // Conversation selesai
      break;
    default:
      await handleDetectAngle(userId, deviceId, prospect, inboundText, product);
  }
}

// ============================================================
// STEP HANDLERS
// ============================================================

async function handleDetectAngle(userId, deviceId, prospect, text, product) {
  const angle = detectAngle(text);

  if (!angle) {
    // Tak detect angle — tanya terus
    await sendMessages(userId, deviceId, prospect.phone_number, [
      'Terima kasih contact Zia☺️',
      'Zia nak tahu, anak akak ada masalah apa sekarang? Susah fokus belajar, atau ada masalah lain?',
    ]);
    return;
  }

  await prospectsRepo.updateFields(deviceId, prospect.phone_number, { angle });
  leadsExcel.updateLeadsFile(deviceId, prospect.phone_number, { angle });

  const greetingMsgs = msg[angle].greeting();
  await sendMessages(userId, deviceId, prospect.phone_number, greetingMsgs);
  await prospectsRepo.updateStep(deviceId, prospect.phone_number, 'fact_finding');
}

async function handleFactFinding(userId, deviceId, prospect, text) {
  const angle = prospect.angle;

  // Cuba extract darjah/umur dari teks
  const darjahMatch = text.match(/darjah\s*(\d+)|standard\s*(\d+)/i);
  const umurMatch = text.match(/(\d+)\s*(tahun|thn|th)/i);

  const darjah = darjahMatch ? (darjahMatch[1] || darjahMatch[2]) : null;
  const umur = umurMatch ? umurMatch[1] : null;

  const fields = {};
  if (darjah) fields.darjah_anak = darjah;
  if (umur) fields.umur_anak = umur;
  if (Object.keys(fields).length) await prospectsRepo.updateFields(deviceId, prospect.phone_number, fields);

  const factFindingMsgs = msg[angle].factFinding(darjah);
  await sendMessages(userId, deviceId, prospect.phone_number, factFindingMsgs);
  await prospectsRepo.updateStep(deviceId, prospect.phone_number, 'korek_masalah');
}

async function handleKorekMasalah(userId, deviceId, prospect, text) {
  await prospectsRepo.updateFields(deviceId, prospect.phone_number, { pain_point: text.substring(0, 255) });

  const angle = prospect.angle;
  await sendMessages(userId, deviceId, prospect.phone_number, msg[angle].korekMasalah());
  await prospectsRepo.updateStep(deviceId, prospect.phone_number, 'fear_amplification');
}

async function handleFearAmplification(userId, deviceId, prospect, text) {
  const angle = prospect.angle;
  const darjah = prospect.darjah_anak;

  await sendMessages(userId, deviceId, prospect.phone_number, msg[angle].fearAmplification(darjah));
  await prospectsRepo.updateStep(deviceId, prospect.phone_number, 'tanya_ikhtiar');
}

async function handleTanyaIkhtiar(userId, deviceId, prospect, text) {
  const mention = text.toLowerCase();
  if (mention.includes('tuisyen') || mention.includes('tuition') || mention.includes('kelas')) {
    await sendMessages(userId, deviceId, prospect.phone_number, msg.fokus.responseIkhtiarTuisyen());
  }

  await sendMessages(userId, deviceId, prospect.phone_number, msg.introSolution());
  await prospectsRepo.updateStep(deviceId, prospect.phone_number, 'intro_solution');
}

async function handleIntroSolution(userId, deviceId, prospect, text) {
  const angle = prospect.angle;
  const lower = text.toLowerCase();

  if (['boleh', 'okay', 'ok', 'ya', 'ye', 'yes'].some(w => lower.includes(w))) {
    const solutionResponse = msg[angle].introSolutionResponse
      ? msg[angle].introSolutionResponse()
      : [];

    if (solutionResponse.length > 0) {
      await sendMessages(userId, deviceId, prospect.phone_number, solutionResponse);
    }

    await sendMessages(userId, deviceId, prospect.phone_number, msg.uspExama());
    await prospectsRepo.updateStep(deviceId, prospect.phone_number, 'usp');
  } else {
    await sendMessages(userId, deviceId, prospect.phone_number, msg.uspExama());
    await prospectsRepo.updateStep(deviceId, prospect.phone_number, 'usp');
  }
}

async function handleUSP(userId, deviceId, prospect, product) {
  if (product.gambar_ingredient) {
    await outbound.sendImage(userId, deviceId, prospect.phone_number, product.gambar_ingredient);
  }
  if (product.gambar_kkm) {
    await outbound.sendImage(userId, deviceId, prospect.phone_number, product.gambar_kkm);
  }

  await sendMessages(userId, deviceId, prospect.phone_number, msg.kajianSaintifik());

  if (product.gambar_kajian) {
    await outbound.sendImage(userId, deviceId, prospect.phone_number, product.gambar_kajian);
  }

  await prospectsRepo.updateStep(deviceId, prospect.phone_number, 'social_proof');

  // Hantar social proof selepas delay
  setTimeout(async () => {
    await handleSocialProof(userId, deviceId, prospect, product);
  }, 3000);
}

async function handleSocialProof(userId, deviceId, prospect, product) {
  await sendMessages(userId, deviceId, prospect.phone_number, [msg.socialProof()[0]]);

  const testimoniImages = [product.gambar_testimoni_1, product.gambar_testimoni_2, product.gambar_testimoni_3].filter(Boolean);
  for (const img of testimoniImages) {
    await outbound.sendImage(userId, deviceId, prospect.phone_number, img);
  }

  await sendMessages(userId, deviceId, prospect.phone_number, [msg.socialProof()[1]]);

  if (product.gambar_produk) {
    await outbound.sendImage(userId, deviceId, prospect.phone_number, product.gambar_produk);
  }

  await sendMessages(userId, deviceId, prospect.phone_number, msg.closing());
  await prospectsRepo.updateStep(deviceId, prospect.phone_number, 'closing');
}

async function handleClosing(userId, deviceId, prospect, text) {
  const lower = text.toLowerCase();

  if (lower.includes('sebotol') || lower.includes('satu') || lower.includes('1')) {
    await sendMessages(userId, deviceId, prospect.phone_number, msg.upsell());
    await prospectsRepo.updateStep(deviceId, prospect.phone_number, 'upsell');
  } else {
    await sendMessages(userId, deviceId, prospect.phone_number, msg.askPaymentMethod());
    await prospectsRepo.updateStep(deviceId, prospect.phone_number, 'ask_payment');
  }
}

async function handleUpsell(userId, deviceId, prospect, text) {
  await sendMessages(userId, deviceId, prospect.phone_number, msg.askPaymentMethod());
  await prospectsRepo.updateStep(deviceId, prospect.phone_number, 'ask_payment');
}

async function handleAskPayment(userId, deviceId, prospect, text, product) {
  const intent = detectIntent(text);
  const lower = text.toLowerCase();

  let pakej = '1_botol';
  let totalPrice = product.harga_1;
  if (lower.includes('3') || lower.includes('tiga')) { pakej = '3_botol'; totalPrice = product.harga_pakej_3; }
  if (lower.includes('6') || lower.includes('enam')) { pakej = '6_botol'; totalPrice = product.harga_pakej_6; }

  const orderId = await ordersRepo.create(
    prospect.id, deviceId, product.id, pakej, totalPrice,
    intent === 'payment_cod' ? 'cod' : 'transfer'
  );

  await prospectsRepo.updateFields(deviceId, prospect.phone_number, { current_order_id: orderId });

  if (intent === 'payment_cod') {
    await sendMessages(userId, deviceId, prospect.phone_number, msg.paymentDetailsCOD());
    await prospectsRepo.updateStep(deviceId, prospect.phone_number, 'get_delivery');
  } else {
    await sendMessages(userId, deviceId, prospect.phone_number, msg.paymentDetailsTransfer(product));
    await prospectsRepo.updateStep(deviceId, prospect.phone_number, 'after_order');
    await finalizeOrder(userId, deviceId, prospect, product, orderId);
  }
}

async function handleGetDelivery(userId, deviceId, prospect, text, product, settings) {
  await prospectsRepo.updateStep(deviceId, prospect.phone_number, 'after_order');
  await sendMessages(userId, deviceId, prospect.phone_number, msg.afterOrder());

  const orderId = prospect.current_order_id;
  if (orderId) {
    await ordersRepo.updateDelivery(orderId, prospect.nama || '-', text);
  }

  await finalizeOrder(userId, deviceId, prospect, product, orderId, settings);
}

async function finalizeOrder(userId, deviceId, prospect, product, orderId, settings) {
  await prospectsRepo.updateStatus(deviceId, prospect.phone_number, 'closed');

  const order = orderId ? await ordersRepo.getById(orderId) : null;
  await telegram.notifyNewOrder(prospect, order, product, settings);

  leadsExcel.updateLeadsFile(deviceId, prospect.phone_number, { status: 'CLOSE' });
}

// ============================================================
// HELPER — send multiple messages dengan humanizer
// ============================================================

async function sendMessages(userId, deviceId, phone, messages) {
  await humanizer.sendHumanMessages(userId, deviceId, phone, messages);
}

module.exports = { processFlow };
