const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const LEADS_DIR = path.join(__dirname, '..', 'leads');
if (!fs.existsSync(LEADS_DIR)) fs.mkdirSync(LEADS_DIR, { recursive: true });

const HEADERS = ['Nama', 'No Fon', 'Angle', 'Status', 'Tarikh'];

function filePath(deviceId) {
  return path.join(LEADS_DIR, `leads_${deviceId}.xlsx`);
}

function readRows(deviceId) {
  const fp = filePath(deviceId);
  if (!fs.existsSync(fp)) return [];
  const wb = XLSX.readFile(fp);
  const ws = wb.Sheets['Leads'];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }).slice(1); // skip header
}

function writeRows(deviceId, rows) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, 'Leads');
  XLSX.writeFile(wb, filePath(deviceId));
}

// Update/tambah 1 row lead ikut nombor telefon (kolum 2 = No Fon)
function updateLeadsFile(deviceId, phone, fields = {}) {
  try {
    const rows = readRows(deviceId);
    const idx = rows.findIndex(r => r[1] === phone);

    if (idx >= 0) {
      if (fields.status) rows[idx][3] = fields.status;
      if (fields.angle) rows[idx][2] = fields.angle;
    } else {
      rows.push([
        fields.nama || '-',
        phone,
        fields.angle || '-',
        fields.status || 'ACTIVE',
        new Date().toLocaleDateString('ms-MY'),
      ]);
    }

    writeRows(deviceId, rows);
  } catch (err) {
    console.error('[Excel] Error:', err.message);
  }
}

function getLeadsFilePath(deviceId) {
  return filePath(deviceId);
}

module.exports = { updateLeadsFile, getLeadsFilePath };
