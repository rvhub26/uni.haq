const msg = require('./messages');
const { detectAngle, detectTemperature, detectIntent } = require('./detector');
const pricing = require('./pricing');
const humanizer = require('./humanizer');
const prospectsRepo = require('../repos/prospects');
const ordersRepo = require('../repos/orders');
const outbound = require('../outbound');
const leadsExcel = require('./leadsExcel');
const telegram = require('./telegram');

// ============================================================
// MAIN FLOW PROCESSOR
// State machine — setiap step trigger next step
// botConfig = { angles, templateMap, tiers, brainConfig } — dashboard-configured,
// loaded once per incoming message by handler.js and threaded through.
// ============================================================

function baseVars(botConfig, product, extra = {}) {
  return {
    persona: botConfig.brainConfig.persona_name,
    namaProduk: product.nama_produk,
    ...extra,
  };
}

async function processFlow(userId, deviceId, prospect, inboundText, product, settings, botConfig) {
  const step = prospect.current_step;
  const temperature = detectTemperature(inboundText);
  const intent = detectIntent(inboundText);
  const vars = baseVars(botConfig, product);

  // Update temperature & last message time
  await prospectsRepo.updateFields(deviceId, prospect.phone_number, {
    temperature,
    last_message_at: new Date(),
  });

  // HOT prospect — skip terus ke closing
  if (temperature === 'HOT' && !['payment_transfer', 'payment_cod', 'after_order', 'get_delivery'].includes(step)) {
    await prospectsRepo.updateStep(deviceId, prospect.phone_number, 'closing');
    await sendMessages(userId, deviceId, prospect.phone_number, msg.getShared(botConfig.templateMap, 'closing', vars));
    return;
  }

  // Objection handler — boleh berlaku pada mana-mana step
  if (intent === 'objection_mahal') {
    const objVars = { ...vars, ...pricing.buildObjectionPricingVars(botConfig.tiers) };
    await sendMessages(userId, deviceId, prospect.phone_number, msg.getShared(botConfig.templateMap, 'objectionMahal', objVars));
    await prospectsRepo.updateStep(deviceId, prospect.phone_number, 'ask_payment');
    return;
  }

  if (intent === 'objection_fikir') {
    if (prospect.cold_attempts >= 1) {
      await sendMessages(userId, deviceId, prospect.phone_number, msg.getShared(botConfig.templateMap, 'objectionFikirUrgency', vars));
    } else {
      await sendMessages(userId, deviceId, prospect.phone_number, msg.getShared(botConfig.templateMap, 'objectionFikir', vars));
      await prospectsRepo.incrementColdAttempts(deviceId, prospect.phone_number);
    }
    return;
  }

  // Route ikut step semasa
  switch (step) {
    case 'detect_angle':
      await handleDetectAngle(userId, deviceId, prospect, inboundText, product, botConfig);
      break;
    case 'fact_finding':
      await handleFactFinding(userId, deviceId, prospect, inboundText, product, botConfig);
      break;
    case 'korek_masalah':
      await handleKorekMasalah(userId, deviceId, prospect, inboundText, product, botConfig);
      break;
    case 'fear_amplification':
      await handleFearAmplification(userId, deviceId, prospect, inboundText, product, botConfig);
      break;
    case 'tanya_ikhtiar':
      await handleTanyaIkhtiar(userId, deviceId, prospect, inboundText, product, botConfig);
      break;
    case 'intro_solution':
      await handleIntroSolution(userId, deviceId, prospect, inboundText, product, botConfig);
      break;
    case 'usp':
      await handleUSP(userId, deviceId, prospect, product, botConfig);
      break;
    case 'social_proof':
      await handleSocialProof(userId, deviceId, prospect, product, botConfig);
      break;
    case 'closing':
      await handleClosing(userId, deviceId, prospect, inboundText, product, botConfig);
      break;
    case 'upsell':
      await handleUpsell(userId, deviceId, prospect, inboundText, product, botConfig);
      break;
    case 'ask_payment':
      await handleAskPayment(userId, deviceId, prospect, inboundText, product, botConfig);
      break;
    case 'get_delivery':
      await handleGetDelivery(userId, deviceId, prospect, inboundText, product, settings, botConfig);
      break;
    case 'after_order':
      // Conversation selesai
      break;
    default:
      await handleDetectAngle(userId, deviceId, prospect, inboundText, product, botConfig);
  }
}

// ============================================================
// STEP HANDLERS
// ============================================================

async function handleDetectAngle(userId, deviceId, prospect, text, product, botConfig) {
  const angle = detectAngle(text, botConfig.angles);
  const vars = baseVars(botConfig, product);

  if (!angle) {
    // Tak detect angle — tanya terus
    await sendMessages(userId, deviceId, prospect.phone_number, msg.getShared(botConfig.templateMap, 'detectAngleFallback', vars));
    return;
  }

  await prospectsRepo.updateFields(deviceId, prospect.phone_number, { angle });
  leadsExcel.updateLeadsFile(deviceId, prospect.phone_number, { angle });

  const greetingMsgs = msg.getAngle(botConfig.templateMap, angle, 'greeting', vars);
  await sendMessages(userId, deviceId, prospect.phone_number, greetingMsgs);
  await prospectsRepo.updateStep(deviceId, prospect.phone_number, 'fact_finding');
}

async function handleFactFinding(userId, deviceId, prospect, text, product, botConfig) {
  const angle = prospect.angle;

  // Cuba extract tempoh masalah dari teks (cth: "3 bulan", "setahun")
  const tempohMatch = text.match(/(\d+)\s*(hari|minggu|bulan|tahun|thn)/i);
  const tempoh = tempohMatch ? `${tempohMatch[1]} ${tempohMatch[2]}` : null;

  if (tempoh) await prospectsRepo.updateFields(deviceId, prospect.phone_number, { tempoh_masalah: tempoh });

  const vars = baseVars(botConfig, product, { tempoh });
  const factFindingMsgs = msg.getAngle(botConfig.templateMap, angle, 'factFinding', vars);
  await sendMessages(userId, deviceId, prospect.phone_number, factFindingMsgs);
  await prospectsRepo.updateStep(deviceId, prospect.phone_number, 'korek_masalah');
}

async function handleKorekMasalah(userId, deviceId, prospect, text, product, botConfig) {
  await prospectsRepo.updateFields(deviceId, prospect.phone_number, { pain_point: text.substring(0, 255) });

  const angle = prospect.angle;
  const vars = baseVars(botConfig, product);
  await sendMessages(userId, deviceId, prospect.phone_number, msg.getAngle(botConfig.templateMap, angle, 'korekMasalah', vars));
  await prospectsRepo.updateStep(deviceId, prospect.phone_number, 'fear_amplification');
}

async function handleFearAmplification(userId, deviceId, prospect, text, product, botConfig) {
  const angle = prospect.angle;
  const tempoh = prospect.tempoh_masalah;
  const vars = baseVars(botConfig, product, { tempoh });

  await sendMessages(userId, deviceId, prospect.phone_number, msg.getAngle(botConfig.templateMap, angle, 'fearAmplification', vars));
  await prospectsRepo.updateStep(deviceId, prospect.phone_number, 'tanya_ikhtiar');
}

const IKHTIAR_LAIN_KEYWORDS = ['urut', 'pil', 'ubat', 'panadol', 'koyok', 'minyak', 'krim', 'fisio', 'kopi', 'suplemen lain', 'vitamin lain'];

async function handleTanyaIkhtiar(userId, deviceId, prospect, text, product, botConfig) {
  const angle = prospect.angle;
  const vars = baseVars(botConfig, product);
  const mention = text.toLowerCase();
  if (IKHTIAR_LAIN_KEYWORDS.some(kw => mention.includes(kw))) {
    await sendMessages(userId, deviceId, prospect.phone_number, msg.getAngle(botConfig.templateMap, angle, 'responseIkhtiarLain', vars));
  }

  await sendMessages(userId, deviceId, prospect.phone_number, msg.getShared(botConfig.templateMap, 'introSolution', vars));
  await prospectsRepo.updateStep(deviceId, prospect.phone_number, 'intro_solution');
}

async function handleIntroSolution(userId, deviceId, prospect, text, product, botConfig) {
  const angle = prospect.angle;
  const vars = baseVars(botConfig, product);
  const lower = text.toLowerCase();

  if (['boleh', 'okay', 'ok', 'ya', 'ye', 'yes'].some(w => lower.includes(w))) {
    const solutionResponse = msg.hasAngle(botConfig.templateMap, angle, 'introSolutionResponse')
      ? msg.getAngle(botConfig.templateMap, angle, 'introSolutionResponse', vars)
      : [];

    if (solutionResponse.length > 0) {
      await sendMessages(userId, deviceId, prospect.phone_number, solutionResponse);
    }

    await sendMessages(userId, deviceId, prospect.phone_number, msg.getShared(botConfig.templateMap, 'uspResno', vars));
    await prospectsRepo.updateStep(deviceId, prospect.phone_number, 'usp');
  } else {
    await sendMessages(userId, deviceId, prospect.phone_number, msg.getShared(botConfig.templateMap, 'uspResno', vars));
    await prospectsRepo.updateStep(deviceId, prospect.phone_number, 'usp');
  }
}

async function handleUSP(userId, deviceId, prospect, product, botConfig) {
  const vars = baseVars(botConfig, product);

  if (product.gambar_ingredient) {
    await outbound.sendImage(userId, deviceId, prospect.phone_number, product.gambar_ingredient);
  }
  if (product.gambar_kkm) {
    await outbound.sendImage(userId, deviceId, prospect.phone_number, product.gambar_kkm);
  }

  await sendMessages(userId, deviceId, prospect.phone_number, msg.getShared(botConfig.templateMap, 'kajianSaintifik', vars));

  if (product.gambar_kajian) {
    await outbound.sendImage(userId, deviceId, prospect.phone_number, product.gambar_kajian);
  }

  await prospectsRepo.updateStep(deviceId, prospect.phone_number, 'social_proof');

  // Hantar social proof selepas delay
  setTimeout(async () => {
    await handleSocialProof(userId, deviceId, prospect, product, botConfig);
  }, 3000);
}

async function handleSocialProof(userId, deviceId, prospect, product, botConfig) {
  const vars = baseVars(botConfig, product);
  const socialProofMsgs = msg.getShared(botConfig.templateMap, 'socialProof', vars);

  await sendMessages(userId, deviceId, prospect.phone_number, [socialProofMsgs[0]]);

  const testimoniImages = [product.gambar_testimoni_1, product.gambar_testimoni_2, product.gambar_testimoni_3].filter(Boolean);
  for (const img of testimoniImages) {
    await outbound.sendImage(userId, deviceId, prospect.phone_number, img);
  }

  await sendMessages(userId, deviceId, prospect.phone_number, [socialProofMsgs[1]]);

  if (product.gambar_produk) {
    await outbound.sendImage(userId, deviceId, prospect.phone_number, product.gambar_produk);
  }

  await sendMessages(userId, deviceId, prospect.phone_number, msg.getShared(botConfig.templateMap, 'closing', vars));
  await prospectsRepo.updateStep(deviceId, prospect.phone_number, 'closing');
}

async function handleClosing(userId, deviceId, prospect, text, product, botConfig) {
  const lower = text.toLowerCase();
  const vars = baseVars(botConfig, product);
  const baseTier = botConfig.tiers[0];

  if (baseTier && baseTier.keywords.some(kw => lower.includes(kw))) {
    const upsellMsgs = msg.getShared(botConfig.templateMap, 'upsell', {
      ...vars,
      tierOptions: pricing.buildTierOptionsPhrase(botConfig.tiers, baseTier.tierKey),
    });
    await sendMessages(userId, deviceId, prospect.phone_number, upsellMsgs.slice(0, 1));
    if (product.gambar_pakej) {
      await outbound.sendImage(userId, deviceId, prospect.phone_number, product.gambar_pakej);
    }
    await sendMessages(userId, deviceId, prospect.phone_number, upsellMsgs.slice(1));
    await prospectsRepo.updateStep(deviceId, prospect.phone_number, 'upsell');
  } else {
    await sendMessages(userId, deviceId, prospect.phone_number, msg.getShared(botConfig.templateMap, 'askPaymentMethod', vars));
    await prospectsRepo.updateStep(deviceId, prospect.phone_number, 'ask_payment');
  }
}

async function handleUpsell(userId, deviceId, prospect, text, product, botConfig) {
  const vars = baseVars(botConfig, product);
  await sendMessages(userId, deviceId, prospect.phone_number, msg.getShared(botConfig.templateMap, 'askPaymentMethod', vars));
  await prospectsRepo.updateStep(deviceId, prospect.phone_number, 'ask_payment');
}

async function handleAskPayment(userId, deviceId, prospect, text, product, botConfig) {
  const intent = detectIntent(text);
  const lower = text.toLowerCase();
  const vars = baseVars(botConfig, product);
  const tiers = botConfig.tiers;

  // Last-match-wins ordered by sort_order (mirrors the original sequential-if behavior),
  // default = tiers[0] (base/entry tier) — opposite of angle detection's first-match-wins.
  let chosen = tiers[0];
  for (const t of tiers) {
    if (t.keywords.some(kw => lower.includes(kw))) chosen = t;
  }

  const orderId = await ordersRepo.create(
    prospect.id, deviceId, product.id, chosen.tierKey, chosen.quantity, chosen.price,
    intent === 'payment_cod' ? 'cod' : 'transfer'
  );

  await prospectsRepo.updateFields(deviceId, prospect.phone_number, { current_order_id: orderId });

  if (intent === 'payment_cod') {
    await sendMessages(userId, deviceId, prospect.phone_number, msg.getShared(botConfig.templateMap, 'paymentDetailsCOD', vars));
    await prospectsRepo.updateStep(deviceId, prospect.phone_number, 'get_delivery');
  } else {
    const transferVars = {
      ...vars,
      bank1Nama: product.bank_1_nama, namaAkaun: product.nama_akaun, bank1No: product.bank_1_no,
      bank2Nama: product.bank_2_nama, bank2No: product.bank_2_no,
    };
    await sendMessages(userId, deviceId, prospect.phone_number, msg.getShared(botConfig.templateMap, 'paymentDetailsTransfer', transferVars));
    await prospectsRepo.updateStep(deviceId, prospect.phone_number, 'after_order');
    await finalizeOrder(userId, deviceId, prospect, product, orderId, botConfig);
  }
}

async function handleGetDelivery(userId, deviceId, prospect, text, product, settings, botConfig) {
  const vars = baseVars(botConfig, product);
  await prospectsRepo.updateStep(deviceId, prospect.phone_number, 'after_order');
  await sendMessages(userId, deviceId, prospect.phone_number, msg.getShared(botConfig.templateMap, 'afterOrder', vars));

  const orderId = prospect.current_order_id;
  if (orderId) {
    await ordersRepo.updateDelivery(orderId, prospect.nama || '-', text);
  }

  await finalizeOrder(userId, deviceId, prospect, product, orderId, botConfig, settings);
}

async function finalizeOrder(userId, deviceId, prospect, product, orderId, botConfig, settings) {
  await prospectsRepo.updateStatus(deviceId, prospect.phone_number, 'closed');

  const order = orderId ? await ordersRepo.getById(orderId) : null;
  await telegram.notifyNewOrder(prospect, order, product, settings, botConfig.tiers);

  leadsExcel.updateLeadsFile(deviceId, prospect.phone_number, { status: 'CLOSE' });
}

// ============================================================
// HELPER — send multiple messages dengan humanizer
// ============================================================

async function sendMessages(userId, deviceId, phone, messages) {
  await humanizer.sendHumanMessages(userId, deviceId, phone, messages);
}

module.exports = { processFlow };
