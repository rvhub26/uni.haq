// Computes dynamic pricing phrases for upsell/objection copy from however many
// package tiers a device has configured, instead of hand-typed "2 botol atau 3 botol" text.
// `tiers` must already be sorted ascending by sort_order (tiers[0] = base/entry tier).

function tierPhrase(tier) {
  return tier.upsellPhrase || `pakej ${tier.quantity} botol RM${tier.price}`;
}

function buildTierOptionsPhrase(tiers, excludeTierKey) {
  return tiers
    .filter(t => t.tierKey !== excludeTierKey)
    .map(tierPhrase)
    .join(' atau ');
}

function buildTierNamesShort(tiers, excludeTierKey) {
  return tiers
    .filter(t => t.tierKey !== excludeTierKey)
    .map(t => `${t.quantity} botol`)
    .join(' atau ');
}

function computeMaxSavings(tiers, baseTierKey) {
  const base = tiers.find(t => t.tierKey === baseTierKey) || tiers[0];
  const top = tiers[tiers.length - 1];
  if (!base || !top) return 0;
  return Math.max(0, Math.round(base.price * top.quantity - top.price));
}

// Vars consumed by the objectionMahal template — base tier "per day" cost breakdown
// plus the top tier's savings pitch.
function buildObjectionPricingVars(tiers) {
  if (!tiers.length) return {};
  const base = tiers[0];
  const top = tiers[tiers.length - 1];
  const baseDays = base.quantity * 30;
  return {
    baseQuantity: base.quantity,
    basePrice: base.price,
    baseDays,
    basePerDay: baseDays > 0 ? Math.round(base.price / baseDays) : base.price,
    topQuantity: top.quantity,
    maxSavings: computeMaxSavings(tiers, base.tierKey),
    tierNamesShort: buildTierNamesShort(tiers, base.tierKey),
  };
}

module.exports = { buildTierOptionsPhrase, buildTierNamesShort, computeMaxSavings, buildObjectionPricingVars };
