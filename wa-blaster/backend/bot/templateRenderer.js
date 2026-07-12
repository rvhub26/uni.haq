// Tiny placeholder renderer for dashboard-configured message copy.
// Supports {{var}}, {{var|default}}, and {{#var}}...{{/var}} optional blocks.

function renderTemplate(str, vars = {}) {
  str = str.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, inner) => (vars[key] ? inner : ''));
  return str.replace(/\{\{(\w+)(?:\|([^}]*))?\}\}/g, (_, key, def) => {
    const v = vars[key];
    return (v === undefined || v === null || v === '') ? (def !== undefined ? def : '') : String(v);
  });
}

function renderBubbles(bubbles, vars = {}) {
  return (bubbles || []).map(b => renderTemplate(b, vars));
}

module.exports = { renderTemplate, renderBubbles };
