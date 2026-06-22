// Replace {nama}, {telefon} dalam template dengan data contact
function processTemplate(template, contact) {
  return template
    .replace(/\{nama\}/gi, contact.nama || '')
    .replace(/\{telefon\}/gi, contact.telefon || '');
}

module.exports = { processTemplate };
