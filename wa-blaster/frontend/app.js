// ── Tab navigation ────────────────────────────────────
function switchTab(tabName) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`tab-${tabName}`)?.classList.add('active');
  document.querySelector(`.nav-item[data-tab="${tabName}"]`)?.classList.add('active');
}

document.querySelectorAll('.nav-item, .link-btn').forEach(el => {
  el.addEventListener('click', () => switchTab(el.dataset.tab));
});

// ── Toast ──────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => { t.className = 'toast'; }, 3500);
}

// ── Status WhatsApp ────────────────────────────────────
async function checkStatus() {
  try {
    const data = await fetch('/api/status').then(r => r.json());
    const badge = document.getElementById('status-badge');
    const dot = document.getElementById('nav-status-dot');
    const navText = document.getElementById('nav-status-text');
    const waLabel = document.getElementById('wa-status-label');

    const label = data.connected ? 'Connected ✓'
      : data.status === 'qr' ? 'Scan QR'
      : data.status === 'connecting' ? 'Menyambung...' : 'Tidak Bersambung';
    const cls = data.connected ? 'connected' : data.status === 'connecting' ? 'connecting' : 'disconnected';

    badge.textContent = label;
    badge.className = `badge ${cls}`;
    dot.className = `status-dot ${cls}`;
    navText.textContent = label;
    waLabel.textContent = data.connected ? 'Bersambung dengan WhatsApp' : 'Belum bersambung';

    const qrSection = document.getElementById('qr-section');
    if (data.connected) {
      qrSection.style.display = 'none';
    } else {
      const qrData = await fetch('/api/qr').then(r => r.json());
      if (qrData.qr) {
        qrSection.style.display = 'block';
        document.getElementById('qr-img').src = qrData.qr;
      } else {
        qrSection.style.display = 'none';
      }
    }
  } catch { /* server belum ready */ }
}

// ── Contacts ───────────────────────────────────────────
let allContacts = [];

async function loadContacts() {
  allContacts = await fetch('/api/contacts').then(r => r.json());
  renderContacts(allContacts);
  renderContactSelectList();
  updateStats();
}

function renderContacts(list) {
  document.getElementById('contact-count').textContent = list.length;
  const tbody = document.getElementById('contacts-body');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-row">Tiada contacts lagi. Upload Excel untuk mula.</td></tr>';
    return;
  }
  tbody.innerHTML = list.map((c, i) => `
    <tr class="contact-row">
      <td style="color:#94a3b8;font-size:0.8rem;">${i + 1}</td>
      <td>${escHtml(c.nama)}</td>
      <td>${escHtml(c.telefon)}</td>
      <td style="text-align:right;"><button class="btn-del" onclick="deleteContact('${c.id}')">🗑</button></td>
    </tr>
  `).join('');
}

function renderContactSelectList() {
  const el = document.getElementById('contact-select-list');
  if (!allContacts.length) { el.innerHTML = '<p class="empty-pick">Tiada contacts</p>'; return; }
  el.innerHTML = allContacts.map(c => `
    <div class="pick-item">
      <input type="checkbox" name="sched-contact-id" value="${c.id}" id="cc_${c.id}" />
      <label for="cc_${c.id}">
        <div class="pick-name">${escHtml(c.nama)}</div>
        <div class="pick-sub">${escHtml(c.telefon)}</div>
      </label>
    </div>
  `).join('');
}

async function deleteContact(id) {
  await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
  loadContacts();
  showToast('Contact dibuang', 'error');
}

document.getElementById('excel-input').addEventListener('change', async (e) => {
  const file = e.target.files[0]; if (!file) return;
  const statusEl = document.getElementById('upload-status');
  statusEl.textContent = 'Memproses...';
  const fd = new FormData(); fd.append('file', file);
  try {
    const res = await fetch('/api/contacts/upload', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) { statusEl.textContent = '❌ ' + data.error; showToast(data.error, 'error'); }
    else {
      statusEl.textContent = `✅ ${data.berjaya} berjaya` + (data.gagal ? `, ${data.gagal} gagal` : '');
      showToast(`${data.berjaya} contacts diimport!`);
      allContacts = data.contacts;
      renderContacts(allContacts);
      renderContactSelectList();
      updateStats();
    }
  } catch { statusEl.textContent = '❌ Ralat upload'; showToast('Ralat upload', 'error'); }
  e.target.value = '';
});

document.getElementById('btn-clear-all').addEventListener('click', async () => {
  if (!confirm('Pasti nak kosongkan semua contacts?')) return;
  await fetch('/api/contacts', { method: 'DELETE' });
  loadContacts();
  showToast('Semua contacts dibuang', 'error');
});

// ── Template Library ───────────────────────────────────
let allTemplates = [];
let tmplCurrentMedia = null;

async function loadTemplates() {
  allTemplates = await fetch('/api/templates').then(r => r.json());
  document.getElementById('tmpl-count').textContent = allTemplates.length;
  renderTemplateList();
  renderSingleTemplatePickList();
  renderRotationTemplateList();
  updateStats();
}

function renderTemplateList() {
  const el = document.getElementById('tmpl-list');
  if (!allTemplates.length) {
    el.innerHTML = '<p class="empty-pick" style="padding:0;">Belum ada template. Tambah menggunakan borang di sebelah.</p>';
    return;
  }
  el.innerHTML = allTemplates.map((t, i) => `
    <div class="tmpl-item">
      <div class="tmpl-num">${i + 1}</div>
      <div class="tmpl-body">
        <div class="tmpl-name">${escHtml(t.name)}</div>
        <div class="tmpl-text">${escHtml(t.text.length > 100 ? t.text.slice(0, 100) + '...' : t.text)}</div>
        ${t.mediaFile ? '<div class="tmpl-meta"><span>📎 ada media</span></div>' : ''}
      </div>
      <div class="tmpl-actions">
        <button class="btn-secondary" style="padding:5px 10px;font-size:0.8rem;" onclick="editTemplate('${t.id}')">✏️</button>
        <button class="btn-del" onclick="deleteTemplate('${t.id}')">🗑</button>
      </div>
    </div>
  `).join('');
}

function renderSingleTemplatePickList() {
  const el = document.getElementById('single-tmpl-list');
  if (!allTemplates.length) { el.innerHTML = '<p class="empty-pick">Tiada template. Tambah dalam tab Templates dahulu.</p>'; return; }
  el.innerHTML = allTemplates.map((t, i) => `
    <div class="pick-item">
      <input type="radio" name="single-tmpl-id" value="${t.id}" id="st_${t.id}" ${i === 0 ? 'checked' : ''} />
      <label for="st_${t.id}">
        <div class="pick-name">${escHtml(t.name)}</div>
        <div class="pick-sub">${escHtml(t.text.slice(0, 70))}${t.text.length > 70 ? '...' : ''}${t.mediaFile ? ' 📎' : ''}</div>
      </label>
    </div>
  `).join('');
}

function renderRotationTemplateList() {
  const el = document.getElementById('rotation-tmpl-list');
  if (!allTemplates.length) { el.innerHTML = '<p class="empty-pick">Tiada template. Tambah dalam tab Templates dahulu.</p>'; return; }
  el.innerHTML = allTemplates.map((t, i) => `
    <div class="pick-item">
      <input type="checkbox" name="rotation-tmpl-id" value="${t.id}" id="rt_${t.id}" onchange="updateRotationPreview()" />
      <label for="rt_${t.id}">
        <div class="pick-name">${escHtml(t.name)}</div>
        <div class="pick-sub">${escHtml(t.text.slice(0, 70))}${t.text.length > 70 ? '...' : ''}${t.mediaFile ? ' 📎' : ''}</div>
      </label>
    </div>
  `).join('');
}

function updateRotationPreview() {
  const checked = [...document.querySelectorAll('input[name="rotation-tmpl-id"]:checked')];
  const el = document.getElementById('rotation-order-preview');
  if (!checked.length) { el.innerHTML = ''; return; }
  const items = checked.map((cb, i) => {
    const tmpl = allTemplates.find(t => t.id === cb.value);
    return `<div style="font-size:0.82rem;padding:3px 0;">Hari ${i + 1}: <b>${escHtml(tmpl?.name || '')}</b></div>`;
  });
  el.innerHTML = `<div class="rotation-preview">${items.join('')}<div style="font-size:0.78rem;opacity:0.7;margin-top:4px;">→ Lepas hari ${checked.length}, rotate semula dari Hari 1</div></div>`;
}

document.getElementById('tmpl-media-input').addEventListener('change', async (e) => {
  const file = e.target.files[0]; if (!file) return;
  const fd = new FormData(); fd.append('file', file);
  try {
    const res = await fetch('/api/media/upload', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) { showToast(data.error, 'error'); return; }
    tmplCurrentMedia = data;
    document.getElementById('tmpl-media-file').value = data.filename;
    document.getElementById('tmpl-media-name').textContent = '📎 ' + data.originalname;
    document.getElementById('tmpl-media-remove').style.display = 'inline';
    showToast('Media diattach!');
  } catch { showToast('Ralat upload media', 'error'); }
  e.target.value = '';
});

document.getElementById('tmpl-media-remove').addEventListener('click', async () => {
  if (tmplCurrentMedia) await fetch(`/api/media/${tmplCurrentMedia.filename}`, { method: 'DELETE' });
  tmplCurrentMedia = null;
  document.getElementById('tmpl-media-file').value = '';
  document.getElementById('tmpl-media-name').textContent = '';
  document.getElementById('tmpl-media-remove').style.display = 'none';
});

document.getElementById('btn-save-tmpl').addEventListener('click', async () => {
  const name = document.getElementById('tmpl-name').value.trim();
  const text = document.getElementById('tmpl-text').value.trim();
  const mediaFile = document.getElementById('tmpl-media-file').value || null;
  const editId = document.getElementById('tmpl-edit-id').value;
  if (!name) { showToast('Sila masukkan nama template', 'error'); return; }
  if (!text) { showToast('Sila masukkan teks mesej', 'error'); return; }

  const url = editId ? `/api/templates/${editId}` : '/api/templates';
  const method = editId ? 'PUT' : 'POST';
  try {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, text, mediaFile }) });
    if (!res.ok) { const d = await res.json(); showToast(d.error, 'error'); return; }
    showToast(editId ? 'Template dikemaskini!' : 'Template disimpan!');
    resetTmplForm();
    loadTemplates();
  } catch { showToast('Ralat simpan template', 'error'); }
});

function editTemplate(id) {
  const t = allTemplates.find(x => x.id === id);
  if (!t) return;
  document.getElementById('tmpl-name').value = t.name;
  document.getElementById('tmpl-text').value = t.text;
  document.getElementById('tmpl-edit-id').value = t.id;
  document.getElementById('tmpl-media-file').value = t.mediaFile || '';
  document.getElementById('tmpl-media-name').textContent = t.mediaFile ? '📎 media tersimpan' : '';
  document.getElementById('btn-save-tmpl').textContent = '💾 Kemaskini';
  document.getElementById('btn-cancel-tmpl-edit').style.display = 'inline-block';
  document.getElementById('tmpl-form-title').textContent = 'Edit Template';
  switchTab('templates');
}

document.getElementById('btn-cancel-tmpl-edit').addEventListener('click', resetTmplForm);
function resetTmplForm() {
  document.getElementById('tmpl-name').value = '';
  document.getElementById('tmpl-text').value = '';
  document.getElementById('tmpl-edit-id').value = '';
  document.getElementById('tmpl-media-file').value = '';
  document.getElementById('tmpl-media-name').textContent = '';
  document.getElementById('tmpl-media-remove').style.display = 'none';
  document.getElementById('btn-save-tmpl').textContent = '➕ Simpan';
  document.getElementById('btn-cancel-tmpl-edit').style.display = 'none';
  document.getElementById('tmpl-form-title').textContent = 'Tambah Template Baru';
  tmplCurrentMedia = null;
}

async function deleteTemplate(id) {
  if (!confirm('Buang template ini?')) return;
  await fetch(`/api/templates/${id}`, { method: 'DELETE' });
  loadTemplates();
  showToast('Template dibuang', 'error');
}

// ── Jadual ─────────────────────────────────────────────
document.querySelectorAll('input[name="sched-mode"]').forEach(r => {
  r.addEventListener('change', () => {
    const isRotation = r.value === 'rotation' && r.checked;
    document.getElementById('single-tmpl-pick').style.display = isRotation ? 'none' : 'block';
    document.getElementById('rotation-fields').style.display = isRotation ? 'block' : 'none';
  });
});

document.querySelectorAll('input[name="sched-type"]').forEach(r => {
  r.addEventListener('change', () => {
    const isRecurring = r.value === 'recurring' && r.checked;
    document.getElementById('one-time-fields').style.display = isRecurring ? 'none' : 'block';
    document.getElementById('recurring-fields').style.display = isRecurring ? 'flex' : 'none';
  });
});

document.getElementById('sched-frequency').addEventListener('change', function () {
  document.getElementById('weekly-days').style.display = this.value === 'weekly' ? 'block' : 'none';
  document.getElementById('monthly-day').style.display = this.value === 'monthly' ? 'block' : 'none';
});

document.querySelectorAll('input[name="sched-contacts"]').forEach(r => {
  r.addEventListener('change', () => {
    document.getElementById('contact-select-list').style.display = r.value === 'select' && r.checked ? 'block' : 'none';
  });
});

// Gap preview (nombor)
function updateGapPreview() {
  const val = Number(document.getElementById('gap-value').value) || 1;
  const unit = Number(document.getElementById('gap-unit').value);
  const el = document.getElementById('gap-preview');
  el.textContent = '= ' + formatGap(val * unit);
}
document.getElementById('gap-value').addEventListener('input', updateGapPreview);
document.getElementById('gap-unit').addEventListener('change', updateGapPreview);
updateGapPreview();

// Gap preview (template)
function updateTmplGapPreview() {
  const val = Number(document.getElementById('tmpl-gap-value').value) || 1;
  const unit = Number(document.getElementById('tmpl-gap-unit').value);
  const el = document.getElementById('tmpl-gap-preview');
  el.textContent = '= ' + formatGap(val * unit);
}
document.getElementById('tmpl-gap-value').addEventListener('input', updateTmplGapPreview);
document.getElementById('tmpl-gap-unit').addEventListener('change', updateTmplGapPreview);
updateTmplGapPreview();

document.getElementById('btn-save-schedule').addEventListener('click', async () => {
  const mode = document.querySelector('input[name="sched-mode"]:checked').value;
  const type = document.querySelector('input[name="sched-type"]:checked').value;
  const contactsMode = document.querySelector('input[name="sched-contacts"]:checked').value;
  const gapMs = Number(document.getElementById('gap-value').value) * Number(document.getElementById('gap-unit').value);

  let contacts = 'all';
  if (contactsMode === 'select') {
    const checked = [...document.querySelectorAll('input[name="sched-contact-id"]:checked')].map(el => el.value);
    if (!checked.length) { showToast('Pilih sekurang-kurangnya satu contact', 'error'); return; }
    contacts = checked;
  }

  const templateGapMs = Number(document.getElementById('tmpl-gap-value').value) * Number(document.getElementById('tmpl-gap-unit').value);
  const body = { type, contacts, contactGapMs: gapMs, templateGapMs };

  if (mode === 'rotation') {
    const checked = [...document.querySelectorAll('input[name="rotation-tmpl-id"]:checked')].map(el => el.value);
    if (!checked.length) { showToast('Pilih template untuk rotation', 'error'); return; }
    body.useRotation = true;
    body.templateIds = checked;
  } else {
    const picked = document.querySelector('input[name="single-tmpl-id"]:checked');
    if (!picked) { showToast('Pilih template dahulu', 'error'); return; }
    const tmpl = allTemplates.find(t => t.id === picked.value);
    body.useRotation = false;
    body.templateIds = [picked.value];
    body.template = tmpl.text;
    body.mediaFile = tmpl.mediaFile || null;
  }

  if (type === 'one-time') {
    const dt = document.getElementById('sched-datetime').value;
    if (!dt) { showToast('Sila pilih tarikh & masa', 'error'); return; }
    body.datetime = dt;
  } else {
    const freq = document.getElementById('sched-frequency').value;
    const time = document.getElementById('sched-time').value;
    if (!time) { showToast('Sila pilih masa', 'error'); return; }
    const pattern = { frequency: freq, time };
    if (freq === 'weekly') {
      pattern.days = [...document.querySelectorAll('input[name="sched-day"]:checked')].map(el => Number(el.value));
      if (!pattern.days.length) { showToast('Pilih sekurang-kurangnya satu hari', 'error'); return; }
    }
    if (freq === 'monthly') {
      pattern.dayOfMonth = Number(document.getElementById('sched-day-of-month').value);
      if (!pattern.dayOfMonth) { showToast('Masukkan tarikh dalam bulan', 'error'); return; }
    }
    body.pattern = pattern;
  }

  try {
    const res = await fetch('/api/schedules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) { showToast(data.error, 'error'); return; }
    showToast('Jadual berjaya disimpan!');
    loadSchedules();
  } catch { showToast('Ralat simpan jadual', 'error'); }
});

async function loadSchedules() {
  const list = await fetch('/api/schedules').then(r => r.json());
  const el = document.getElementById('schedules-list');
  updateStats();
  if (!list.length) { el.innerHTML = '<p class="empty-pick">Tiada jadual lagi</p>'; return; }
  el.innerHTML = list.map(s => {
    const when = s.type === 'one-time'
      ? `Sekali: ${new Date(s.datetime).toLocaleString('ms-MY')}`
      : `Berulang ${formatPattern(s.pattern)}`;
    let tmplInfo = s.useRotation
      ? `🔄 Rotation ${s.templateIds?.length || 0} template (seterusnya: ${getRotationNextName(s)})`
      : escHtml((s.template || '').slice(0, 55)) + ((s.template || '').length > 55 ? '...' : '');
    return `
      <div class="schedule-card">
        <div class="sch-info">
          <div class="sch-title">${tmplInfo}</div>
          <div class="sch-detail">
            <span class="sch-chip">📆 ${when}</span>
            <span class="sch-chip">⏱ ${formatGap(s.contactGapMs || 4000)}/nombor</span>
            ${s.useRotation && s.templateGapMs ? `<span class="sch-chip">🔁 ${formatGap(s.templateGapMs)}/template</span>` : ''}
            <span class="sch-status ${s.status}">${s.status === 'active' ? '● Aktif' : '✓ Selesai'}</span>
          </div>
        </div>
        <div class="sch-actions">
          <button class="btn-blast" onclick="blastNow('${s.id}')">▶ Blast</button>
          <button class="btn-del" onclick="deleteSchedule('${s.id}')">🗑</button>
        </div>
      </div>
    `;
  }).join('');
}

function getRotationNextName(s) {
  const idx = (s.rotationIndex || 0) % (s.templateIds?.length || 1);
  const tmpl = allTemplates.find(t => t.id === s.templateIds?.[idx]);
  return escHtml(tmpl?.name || `#${idx + 1}`);
}

function formatPattern(p) {
  if (!p) return '';
  const days = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
  if (p.frequency === 'daily') return `setiap hari ${p.time}`;
  if (p.frequency === 'weekly') return `${p.days?.map(d => days[d]).join(', ')} ${p.time}`;
  if (p.frequency === 'monthly') return `tarikh ${p.dayOfMonth} setiap bulan ${p.time}`;
  return p.time;
}

async function deleteSchedule(id) {
  await fetch(`/api/schedules/${id}`, { method: 'DELETE' });
  loadSchedules();
  showToast('Jadual dibuang', 'error');
}

async function blastNow(id) {
  if (!confirm('Blast mesej sekarang?')) return;
  showToast('Mesej dimasukkan ke queue...');
  try {
    const res = await fetch(`/api/schedules/${id}/blast-now`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) { showToast(data.error, 'error'); return; }
    const gapInfo = data.templateGapMs
      ? `${data.templates} template × ${data.queued / data.templates | 0} contacts | Gap template: ${formatGap(data.templateGapMs)}`
      : `${data.queued} mesej | Gap: ${formatGap(data.gapMs)}`;
    showToast(`✓ Queue: ${gapInfo}`);
    loadQueue(); loadSchedules();
  } catch { showToast('Ralat semasa blast', 'error'); }
}

// ── Queue & Log ────────────────────────────────────────
async function loadQueue() {
  const list = await fetch('/api/schedules/queue').then(r => r.json()).catch(() => []);
  const el = document.getElementById('queue-list');
  document.getElementById('stat-queue').textContent = list.length;
  if (!list.length) { el.innerHTML = '<p class="empty-pick">Tiada mesej dalam queue</p>'; return; }
  el.innerHTML = list.map(q => `
    <div class="queue-item">
      <div>
        <div class="queue-name">${escHtml(q.nama)}</div>
        <div class="queue-phone">${escHtml(q.telefon)}</div>
      </div>
      <div class="queue-time">📅 ${new Date(q.sendAt).toLocaleString('ms-MY')}</div>
    </div>
  `).join('');
}

async function loadLogs() {
  const list = await fetch('/api/logs').then(r => r.json());
  const el = document.getElementById('logs-list');
  const dashEl = document.getElementById('dash-logs');

  const render = (items) => items.map(l => `
    <div class="log-entry">
      <div class="log-dot ${l.failed > 0 && !l.sent ? 'failed' : ''}"></div>
      <div class="log-body">
        <div class="log-time">${new Date(l.blastAt).toLocaleString('ms-MY')}</div>
        <div class="log-result">✅ ${l.sent} berjaya${l.failed ? ` &nbsp;❌ ${l.failed} gagal` : ''}</div>
        <div class="log-preview">${escHtml((l.template || '').slice(0, 80))}${(l.template || '').length > 80 ? '...' : ''}</div>
      </div>
    </div>
  `).join('');

  if (!list.length) {
    el.innerHTML = '<p class="empty-pick">Tiada log lagi</p>';
    dashEl.innerHTML = '<p class="empty-pick">Tiada log lagi</p>';
  } else {
    el.innerHTML = render(list);
    dashEl.innerHTML = render(list.slice(0, 3));
  }
}

// ── Dashboard stats ────────────────────────────────────
async function updateStats() {
  document.getElementById('stat-contacts').textContent = allContacts.length;
  document.getElementById('stat-templates').textContent = allTemplates.length;
  const schedules = await fetch('/api/schedules').then(r => r.json()).catch(() => []);
  document.getElementById('stat-schedules').textContent = schedules.filter(s => s.status === 'active').length;
}

document.getElementById('btn-clear-logs').addEventListener('click', async () => {
  if (!confirm('Pasti nak kosongkan semua log blast?')) return;
  await fetch('/api/logs', { method: 'DELETE' });
  loadLogs();
  showToast('Log dikosongkan', 'error');
});

// ── Utils ──────────────────────────────────────────────
function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function formatGap(ms) {
  if (!ms || ms < 1000) return ms + 'ms';
  if (ms < 60000) return (ms / 1000) + ' saat';
  if (ms < 3600000) return (ms / 60000).toFixed(1) + ' minit';
  if (ms < 86400000) return (ms / 3600000).toFixed(1) + ' jam';
  return (ms / 86400000).toFixed(1) + ' hari';
}

// ── Init ───────────────────────────────────────────────
checkStatus();
setInterval(checkStatus, 3000);
loadContacts();
loadTemplates();
loadSchedules();
loadLogs();
loadQueue();
setInterval(loadLogs, 10000);
setInterval(loadQueue, 30000);
setInterval(loadSchedules, 20000);
