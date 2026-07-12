// Thin adapter over dashboard-configured message templates (bot_message_templates).
// `templateMap` shape: { _shared: { key: [bubble,...] }, <angleKey>: { key: [bubble,...] } }
// Fixed shape contract (flow.js dispatches these literal keys — dashboard configures
// content, not key names): shared keys listed in migration 005, per-angle keys are
// greeting/factFinding/korekMasalah/fearAmplification/tanyaIkhtiar/responseIkhtiarLain/introSolutionResponse.

const { renderBubbles } = require('./templateRenderer');

function getShared(templateMap, key, vars = {}) {
  const bubbles = templateMap._shared && templateMap._shared[key];
  return bubbles ? renderBubbles(bubbles, vars) : [];
}

function getAngle(templateMap, angle, key, vars = {}) {
  const bubbles = templateMap[angle] && templateMap[angle][key];
  return bubbles ? renderBubbles(bubbles, vars) : [];
}

function hasAngle(templateMap, angle, key) {
  return !!(templateMap[angle] && templateMap[angle][key]);
}

module.exports = { getShared, getAngle, hasAngle };
