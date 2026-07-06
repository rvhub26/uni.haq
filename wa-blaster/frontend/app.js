// ── Auth ───────────────────────────────────────────────
async function checkAuth() {
  const data = await fetch('/api/auth/check').then(r => r.json());
  const overlay = document.getElementById('login-overlay');
  if (!data.loggedIn) {
    overlay.style.display = 'flex';
    return false;
  }
  overlay.style.display = 'none';
  document.getElementById('sidebar-username').textContent = data.username;
  if (data.role === 'admin') {
    document.getElementById('btn-user-mgmt').style.display = 'block';
  }
  return true;
}

async function doLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';

  if (!username || !password) {
    errEl.textContent = 'Sila masukkan username dan password';
    errEl.style.display = 'block';
    return;
  }

  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();

  if (!res.ok) {
    errEl.textContent = data.error || 'Log masuk gagal';
    errEl.style.display = 'block';
    return;
  }

  document.getElementById('login-overlay').style.display = 'none';
  document.getElementById('sidebar-username').textContent = data.username;
  if (data.role === 'admin') document.getElementById('btn-user-mgmt').style.display = 'block';
  showToast('Selamat datang, ' + data.username + '!');
  loadAll();
}

async function doLogout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  document.getElementById('login-overlay').style.display = 'flex';
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('sidebar-username').textContent = '—';
  document.getElementById('btn-user-mgmt').style.display = 'none';
  showToast('Dah log keluar');
}

async function showUserMgmt() {
  document.getElementById('user-mgmt-modal').style.display = 'flex';
  loadUsersList();
}

function closeUserMgmt() {
  document.getElementById('user-mgmt-modal').style.display = 'none';
}

async function loadUsersList() {
  const users = await fetch('/api/auth/users').then(r => r.json());
  const el = document.getElementById('users-list-mgmt');
  if (!users.length) { el.innerHTML = '<p class="empty-pick">Tiada pengguna</p>'; return; }
  el.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Username</th><th>Role</th><th>Dibuat</th><th></th></tr></thead>
        <tbody>
          ${users.map(u => `
            <tr class="contact-row">
              <td style="font-weight:600;">${escHtml(u.username)}</td>
              <td><span style="font-size:0.75rem;padding:2px 8px;border-radius:4px;background:${u.role==='admin'?'#a855f720':'#22c55e20'};color:${u.role==='admin'?'#a855f7':'#22c55e'};">${u.role}</span></td>
              <td style="color:#64748b;font-size:0.8rem;">${new Date(u.createdAt).toLocaleDateString('ms-MY')}</td>
              <td style="text-align:right;"><button class="btn-del" onclick="deleteUser('${u.id}','${escHtml(u.username)}')">🗑</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function addUser() {
  const username = document.getElementById('new-username').value.trim();
  const password = document.getElementById('new-password').value;
  const role = document.getElementById('new-role').value;
  if (!username || !password) { showToast('Isi username dan password', 'error'); return; }

  const res = await fetch('/api/auth/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, role }),
  });
  const data = await res.json();
  if (!res.ok) { showToast(data.error, 'error'); return; }

  document.getElementById('new-username').value = '';
  document.getElementById('new-password').value = '';
  loadUsersList();
  showToast('Pengguna ' + username + ' berjaya ditambah');
}

async function deleteUser(id, username) {
  if (!confirm(`Buang pengguna "${username}"?`)) return;
  const res = await fetch(`/api/auth/users/${id}`, { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok) { showToast(data.error, 'error'); return; }
  loadUsersList();
  showToast('Pengguna dibuang', 'error');
}

// ── Tab navigation ────────────────────────────────────
const TAB_GROUP = {
  dashboard: 'uniblast', contacts: 'uniblast', templates: 'uniblast', jadual: 'uniblast',
  queue: 'uniblast', laporan: 'uniblast', peranti: 'uniblast',
  'bot-closing': 'unibot',
};

function toggleNavGroup(name) {
  ['uniblast', 'unibot'].forEach(g => {
    const items = document.getElementById(`navgroup-${g}`);
    const chevron = document.getElementById(`chevron-${g}`);
    if (!items || !chevron) return;
    const shouldExpand = g === name ? items.classList.contains('collapsed') : false;
    items.classList.toggle('collapsed', !shouldExpand);
    chevron.textContent = shouldExpand ? '▾' : '▸';
  });
}

function expandNavGroupFor(tabName) {
  const group = TAB_GROUP[tabName];
  if (!group) return;
  ['uniblast', 'unibot'].forEach(g => {
    const items = document.getElementById(`navgroup-${g}`);
    const chevron = document.getElementById(`chevron-${g}`);
    if (!items || !chevron) return;
    const expand = g === group;
    items.classList.toggle('collapsed', !expand);
    chevron.textContent = expand ? '▾' : '▸';
  });
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`tab-${tabName}`)?.classList.add('active');
  document.querySelector(`.nav-item[data-tab="${tabName}"]`)?.classList.add('active');
  expandNavGroupFor(tabName);
  if (tabName === 'laporan') loadLaporan();
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
    const waLabel = document.getElementById('wa-status-label');

    if (!data || data.status === 'no_device') {
      if (badge) { badge.textContent = 'Tiada Peranti'; badge.className = 'badge disconnected'; }
      if (waLabel) waLabel.textContent = 'Tambah peranti WhatsApp dahulu';
      return;
    }

    const label = data.connected ? 'Connected ✓'
      : data.status === 'qr' ? 'Scan QR'
      : data.status === 'connecting' ? 'Menyambung...' : 'Tidak Bersambung';
    const cls = data.connected ? 'connected' : data.status === 'connecting' ? 'connecting' : 'disconnected';

    if (badge) { badge.textContent = label; badge.className = `badge ${cls}`; }
    if (waLabel) waLabel.textContent = data.connected ? 'Bersambung dengan WhatsApp' : 'Belum bersambung';

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
let allBlacklist = [];
let allReplies = [];

async function loadContacts() {
  [allContacts, allBlacklist, allReplies] = await Promise.all([
    fetch('/api/contacts').then(r => r.json()),
    fetch('/api/blacklist').then(r => r.json()),
    fetch('/api/reports/replies').then(r => r.json()),
  ]);
  const search = document.getElementById('contact-search')?.value || '';
  renderContactGroups(filterContacts(allContacts, search));
  renderBlacklist();
  renderContactSelectList();
  renderKumpulanSelectList();
  updateStats();
}

function filterContacts(list, query) {
  if (!query.trim()) return list;
  const q = query.toLowerCase();
  return list.filter(c =>
    c.nama.toLowerCase().includes(q) || c.telefon.includes(q)
  );
}

document.getElementById('contact-search').addEventListener('input', (e) => {
  const val = e.target.value.trim();
  const filtered = filterContacts(allContacts, val);
  renderContactGroups(filtered);

  // Tunjuk butang blacklist terus bila ada input
  const btn = document.getElementById('btn-blacklist-from-search');
  btn.style.display = val ? 'block' : 'none';
});

document.getElementById('btn-blacklist-from-search').addEventListener('click', async () => {
  const val = document.getElementById('contact-search').value.trim();
  if (!val) return;

  // Cuba cari dalam contacts dulu
  const found = allContacts.find(c => c.telefon.includes(val) || c.nama.toLowerCase().includes(val.toLowerCase()));
  const telefon = found ? found.telefon : val.replace(/\D/g, '').replace(/^0/, '60');
  const nama = found ? found.nama : val;

  if (!telefon) { showToast('Masukkan nombor yang sah', 'error'); return; }

  await fetch('/api/blacklist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ telefon, nama }),
  });

  document.getElementById('contact-search').value = '';
  document.getElementById('btn-blacklist-from-search').style.display = 'none';
  loadContacts();
  showToast(`🚫 ${nama} (${telefon}) ditambah ke blacklist`, 'error');
});

function getGroups(list) {
  const map = {};
  list.forEach(c => {
    const k = c.kumpulan || 'Umum';
    if (!map[k]) map[k] = [];
    map[k].push(c);
  });
  return map;
}

let filterHistoryOnly = false;

function renderContactGroups(list) {
  const displayList = filterHistoryOnly ? list.filter(c => c.hasHistory) : list;
  const historyCount = list.filter(c => c.hasHistory).length;

  document.getElementById('contact-count').textContent = displayList.length;

  const historyBadge = document.getElementById('history-count-badge');
  if (historyBadge) historyBadge.textContent = `${historyCount} ada history`;

  const filterBtn = document.getElementById('btn-filter-history');
  if (filterBtn) {
    filterBtn.style.background = filterHistoryOnly ? '#22c55e33' : '#1e293b';
    filterBtn.style.color = filterHistoryOnly ? '#22c55e' : '#94a3b8';
    filterBtn.style.border = filterHistoryOnly ? '1px solid #22c55e66' : '1px solid #334155';
    filterBtn.textContent = filterHistoryOnly ? '✅ Ada History Sahaja' : '🔍 Tapis: Ada History';
  }

  const el = document.getElementById('contacts-groups');
  if (!displayList.length) {
    el.innerHTML = filterHistoryOnly
      ? '<p class="empty-pick" style="padding:20px 0;">Tiada contacts yang pernah chat dengan nombor ini.</p>'
      : '<p class="empty-pick" style="padding:20px 0;">Tiada contacts lagi. Upload Excel untuk mula.</p>';
    return;
  }
  const groups = getGroups(displayList);
  const blacklistSet = new Set(allBlacklist.map(b => b.telefon));
  const repliedSet = new Set(allReplies.map(r => r.telefon));

  el.innerHTML = Object.entries(groups).map(([nama, contacts]) => `
    <div class="card" style="margin-bottom:16px;">
      <div class="card-header" style="margin-bottom:12px;">
        <h2>📁 ${escHtml(nama)} <span class="count-badge">${contacts.length}</span></h2>
        <button class="btn-danger" style="font-size:0.78rem;padding:5px 12px;" onclick="deleteGroup('${escHtml(nama)}')">🗑 Buang Kumpulan</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Nama</th><th>Telefon</th><th>History</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${contacts.map((c, i) => {
              const isBanned = blacklistSet.has(c.telefon);
              const hasReplied = repliedSet.has(c.telefon);
              return `
              <tr class="contact-row" style="${isBanned ? 'opacity:0.5;' : ''}">
                <td style="color:#94a3b8;font-size:0.8rem;">${i + 1}</td>
                <td>${escHtml(c.nama)} ${isBanned ? '<span style="color:#ef4444;font-size:0.75rem;">🚫 blacklist</span>' : ''}</td>
                <td>${escHtml(c.telefon)}</td>
                <td>${c.hasHistory
                  ? '<span style="color:#22c55e;font-size:0.8rem;font-weight:600;">✅ Ada</span>'
                  : '<span style="color:#f59e0b;font-size:0.8rem;">⚠️ Tiada</span>'
                }</td>
                <td>
                  ${hasReplied
                    ? `<span style="color:#22c55e;font-size:0.78rem;font-weight:600;">💬 Dah Balas</span>`
                    : `<button style="font-size:0.75rem;padding:3px 8px;background:#f59e0b22;color:#f59e0b;border:1px solid #f59e0b44;border-radius:5px;cursor:pointer;" onclick="markReplied('${c.telefon}','${escHtml(c.nama)}')">+ Tandakan Balas</button>`
                  }
                </td>
                <td style="text-align:right;display:flex;gap:6px;justify-content:flex-end;">
                  ${isBanned
                    ? `<button class="btn-secondary" style="font-size:0.78rem;padding:5px 10px;" onclick="unblacklist('${c.telefon}')">✅ Unblock</button>`
                    : `<button style="font-size:0.78rem;padding:5px 10px;background:#ef444422;color:#ef4444;border:1px solid #ef444455;border-radius:6px;cursor:pointer;" onclick="addBlacklist('${c.telefon}','${escHtml(c.nama)}')">🚫 Blacklist</button>`
                  }
                  <button class="btn-del" onclick="deleteContact('${c.id}')">🗑</button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
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
        <div class="pick-sub">${escHtml(c.telefon)} · ${escHtml(c.kumpulan || 'Umum')}</div>
      </label>
    </div>
  `).join('');
}

function renderKumpulanSelectList() {
  const el = document.getElementById('kumpulan-select-list');
  const groups = Object.keys(getGroups(allContacts));
  if (!groups.length) { el.innerHTML = '<p class="empty-pick">Tiada kumpulan</p>'; return; }
  el.innerHTML = groups.map(k => `
    <div class="pick-item">
      <input type="checkbox" name="sched-kumpulan" value="${escHtml(k)}" id="kg_${escHtml(k)}" />
      <label for="kg_${escHtml(k)}">
        <div class="pick-name">📁 ${escHtml(k)}</div>
        <div class="pick-sub">${getGroups(allContacts)[k].length} contacts</div>
      </label>
    </div>
  `).join('');
}

async function deleteContact(id) {
  await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
  loadContacts();
  showToast('Contact dibuang', 'error');
}

async function markReplied(telefon, nama) {
  await fetch('/api/reports/replies/manual', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ telefon, nama }),
  });
  loadContacts();
  showToast(`💬 ${nama} ditandakan sebagai dah balas`);
}

async function addBlacklist(telefon, nama) {
  await fetch('/api/blacklist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ telefon, nama }),
  });
  loadContacts();
  showToast(`🚫 ${nama} ditambah ke blacklist`, 'error');
}

async function unblacklist(telefon) {
  await fetch(`/api/blacklist/${encodeURIComponent(telefon)}`, { method: 'DELETE' });
  loadContacts();
  showToast('✅ Nombor dikeluarkan dari blacklist');
}

function renderBlacklist() {
  const el = document.getElementById('blacklist-list');
  const count = document.getElementById('blacklist-count');
  count.textContent = allBlacklist.length;

  if (!allBlacklist.length) {
    el.innerHTML = '<p class="empty-pick">Tiada nombor dalam blacklist</p>';
    return;
  }

  el.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Nama</th><th>Telefon</th><th>Tarikh</th><th></th></tr></thead>
        <tbody>
          ${allBlacklist.map(b => `
            <tr class="contact-row">
              <td>${escHtml(b.nama)}</td>
              <td>${escHtml(b.telefon)}</td>
              <td style="color:#94a3b8;font-size:0.8rem;">${new Date(b.addedAt).toLocaleDateString('ms-MY')}</td>
              <td style="text-align:right;">
                <button class="btn-secondary" style="font-size:0.75rem;padding:4px 8px;" onclick="unblacklist('${b.telefon}')">✅ Unblock</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function deleteGroup(nama) {
  if (!confirm(`Pasti nak buang semua contacts dalam kumpulan "${nama}"?`)) return;
  await fetch(`/api/contacts/group/${encodeURIComponent(nama)}`, { method: 'DELETE' });
  loadContacts();
  showToast(`Kumpulan "${nama}" dibuang`, 'error');
}

document.getElementById('excel-input').addEventListener('change', async (e) => {
  const file = e.target.files[0]; if (!file) return;
  const statusEl = document.getElementById('upload-status');
  const kumpulan = document.getElementById('kumpulan-name-input').value.trim();
  if (!kumpulan) {
    showToast('Sila isi nama kumpulan dahulu', 'error');
    e.target.value = '';
    return;
  }
  statusEl.textContent = 'Memproses...';
  const fd = new FormData();
  fd.append('file', file);
  fd.append('kumpulan', kumpulan);
  try {
    const res = await fetch('/api/contacts/upload', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) { statusEl.textContent = '❌ ' + data.error; showToast(data.error, 'error'); }
    else {
      statusEl.textContent = `✅ ${data.berjaya} contacts diimport ke kumpulan "${kumpulan}"` + (data.gagal ? ` (${data.gagal} gagal)` : '');
      showToast(`${data.berjaya} contacts diimport!`);
      document.getElementById('kumpulan-name-input').value = '';
      allContacts = data.contacts;
      renderContactGroups(allContacts);
      renderContactSelectList();
      renderKumpulanSelectList();
      updateStats();
    }
  } catch { statusEl.textContent = '❌ Ralat upload'; showToast('Ralat upload', 'error'); }
  e.target.value = '';
});

document.getElementById('btn-clear-all').addEventListener('click', async () => {
  if (!confirm('Pasti nak kosongkan SEMUA contacts?')) return;
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


function toggleKumpulanList(radio) {
  const el = document.getElementById('kumpulan-select-list');
  if (radio.value === 'kumpulan') {
    renderKumpulanSelectList(); // render semula pastikan data terkini
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
}

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

// Batch mode — baca state dari checkbox (HTML-defined, zero JS dependency)
function isBatchEnabled() {
  const cb = document.getElementById('batch-toggle-cb');
  return cb ? cb.checked : false;
}

function updateBatchPreview() {
  const sizeEl = document.getElementById('batch-size');
  const gapValEl = document.getElementById('batch-gap-value');
  const gapUnitEl = document.getElementById('batch-gap-unit');
  if (!sizeEl || !gapValEl || !gapUnitEl) return;
  const size = parseInt(sizeEl.value) || 50;
  const gapVal = Number(gapValEl.value) || 12;
  const gapUnit = Number(gapUnitEl.value);
  const gapMs = gapVal * gapUnit;
  const total = allContacts.length;
  const batches = Math.ceil(total / size);
  const previewEl = document.getElementById('batch-preview');
  if (!previewEl) return;

  const totalTime = (batches - 1) * gapMs;
  const totalHours = Math.round(totalTime / 3600000 * 10) / 10;

  // Bina timeline ringkas
  let timeline = '';
  for (let i = 0; i < Math.min(batches, 4); i++) {
    const from = i * size + 1;
    const to = Math.min((i + 1) * size, total);
    timeline += `<div style="margin-bottom:3px;">Batch ${i + 1}: Nombor ${from}–${to}${i < batches - 1 ? ` → rehat ${formatGap(gapMs)}` : ' (habis)'}</div>`;
  }
  if (batches > 4) timeline += `<div style="color:#475569;">... dan ${batches - 4} batch lagi</div>`;

  previewEl.innerHTML = `
    <div style="color:#22c55e;font-weight:600;margin-bottom:8px;">Anggaran: ${total} contacts → ${batches} batch × maks ${size} nombor</div>
    <div style="font-size:0.8rem;line-height:1.7;">${timeline}</div>
    <div style="margin-top:8px;color:#64748b;font-size:0.78rem;">Masa selesai keseluruhan: ~${totalHours} jam</div>
  `;
}


document.getElementById('btn-save-schedule').addEventListener('click', async () => {
  const mode = document.querySelector('input[name="sched-mode"]:checked').value;
  const contactsMode = document.querySelector('input[name="sched-contacts"]:checked').value;
  const gapMs = Number(document.getElementById('gap-value').value) * Number(document.getElementById('gap-unit').value);

  let contacts = 'all';
  if (contactsMode === 'kumpulan') {
    const checked = [...document.querySelectorAll('input[name="sched-kumpulan"]:checked')].map(el => el.value);
    if (!checked.length) { showToast('Pilih sekurang-kurangnya satu kumpulan', 'error'); return; }
    contacts = { kumpulan: checked };
  }

  const templateGapMs = Number(document.getElementById('tmpl-gap-value').value) * Number(document.getElementById('tmpl-gap-unit').value);

  // Batch blast settings
  const batchEnabled = isBatchEnabled();
  const batchSize = batchEnabled ? parseInt(document.getElementById('batch-size').value) || 50 : 0;
  const batchGapMs = batchEnabled
    ? Number(document.getElementById('batch-gap-value').value) * Number(document.getElementById('batch-gap-unit').value)
    : 0;

  const historyOnly = document.getElementById('sched-history-only')?.value === 'true';
  const body = { type: 'one-time', contacts, contactGapMs: gapMs, templateGapMs, batchSize, batchGapMs, historyOnly };

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

  const dtVal = document.getElementById('sched-datetime').value;
  body.datetime = dtVal ? new Date(dtVal).toISOString() : new Date().toISOString();

  try {
    const res = await fetch('/api/schedules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) { showToast(data.error, 'error'); return; }
    showToast('Jadual berjaya disimpan!');
    const cb = document.getElementById('batch-toggle-cb');
    if (cb) { cb.checked = false; onBatchToggle(false); }
    loadSchedules();
  } catch { showToast('Ralat simpan jadual', 'error'); }
});

async function loadSchedules() {
  const list = await fetch('/api/schedules').then(r => r.json());
  const el = document.getElementById('schedules-list');
  updateStats();
  if (!list.length) { el.innerHTML = '<p class="empty-pick">Tiada jadual lagi</p>'; return; }
  el.innerHTML = list.map(s => {
    const when = s.datetime
      ? `Mula: ${new Date(s.datetime).toLocaleString('ms-MY')}`
      : '—';
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
            ${s.batchSize ? `<span class="sch-chip" style="background:#22c55e20;color:#22c55e;">🛡 ${s.batchSize}/batch · ${formatGap(s.batchGapMs)}</span>` : ''}
            ${s.historyOnly ? `<span class="sch-chip" style="background:#3b82f620;color:#60a5fa;">✅ History Sahaja</span>` : ''}
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
    const batchInfo = data.batchSize ? ` | 🛡 ${data.batches} batch × ${data.batchSize} (gap ${formatGap(data.batchGapMs)})` : '';
    const gapInfo = data.templateGapMs
      ? `${data.templates} template × ${(data.queued / data.templates) | 0} contacts`
      : `${data.queued} mesej`;
    showToast(`✓ Queue: ${gapInfo}${batchInfo}`);
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

  const render = (items) => items.map(l => {
    const details = l.details || [];
    const detailsHtml = details.map(d => `
      <div style="display:flex;align-items:center;gap:6px;padding:3px 0;font-size:0.82rem;">
        <span>${d.status === 'sent' ? '✅' : '❌'}</span>
        <span style="color:${d.status === 'sent' ? '#22c55e' : '#ef4444'};font-weight:600;">${escHtml(d.nama)}</span>
        <span style="color:#64748b;">${escHtml(d.telefon)}</span>
      </div>
    `).join('');
    return `
    <div class="log-entry">
      <div class="log-dot ${l.failed > 0 && !l.sent ? 'failed' : ''}"></div>
      <div class="log-body" style="width:100%;">
        <div class="log-time">${new Date(l.blastAt).toLocaleString('ms-MY')}</div>
        <div class="log-result">✅ ${l.sent} berjaya${l.failed ? ` &nbsp;❌ ${l.failed} gagal` : ''}</div>
        ${detailsHtml}
        <div class="log-preview" style="margin-top:4px;">${escHtml((l.template || '').slice(0, 60))}${(l.template || '').length > 60 ? '...' : ''}</div>
      </div>
    </div>`;
  }).join('');

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

// ── Laporan ────────────────────────────────────────────
let salesSelectedContact = { telefon: '', nama: '' };

async function loadLaporan() {
  const [stats, replies, sales] = await Promise.all([
    fetch('/api/reports/stats').then(r => r.json()),
    fetch('/api/reports/replies').then(r => r.json()),
    fetch('/api/reports/sales').then(r => r.json()),
  ]);
  renderLaporanStats(stats);
  renderReplies(replies);
  renderSales(sales);
}

function renderLaporanStats(s) {
  document.getElementById('rpt-total').textContent = s.total.toLocaleString();
  document.getElementById('rpt-berjaya').textContent = s.berjaya.toLocaleString();
  document.getElementById('rpt-pct-berjaya').textContent = s.pctBerjaya + '%';
  document.getElementById('rpt-failed').textContent = s.failed.toLocaleString();
  document.getElementById('rpt-pct-failed').textContent = s.pctFailed + '%';
  document.getElementById('rpt-replied').textContent = s.repliedCount.toLocaleString();
  document.getElementById('rpt-pct-replied').textContent = s.pctReplied + '%';
  document.getElementById('rpt-sales-rm').textContent = 'RM ' + parseFloat(s.totalRM).toLocaleString('ms-MY', { minimumFractionDigits: 2 });
  document.getElementById('rpt-sales-count').textContent = s.salesCount + ' jualan';
  document.getElementById('rpt-reply-count').textContent = s.repliedCount;
}

function renderReplies(replies) {
  const el = document.getElementById('rpt-replies-list');
  if (!replies.length) {
    el.innerHTML = '<p class="empty-pick">Tiada balas lagi. Sistem akan detect bila contact reply.</p>';
    return;
  }
  el.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Nama</th><th>Telefon</th><th>Balas Pada</th><th></th></tr></thead>
        <tbody>
          ${replies.map(r => `
            <tr class="contact-row">
              <td>${escHtml(r.nama)}</td>
              <td>${escHtml(r.telefon)}</td>
              <td style="color:#94a3b8;font-size:0.8rem;">${new Date(r.repliedAt).toLocaleString('ms-MY')}</td>
              <td style="text-align:right;">
                <button class="btn-primary" style="font-size:0.78rem;padding:5px 10px;" onclick="prefillSaleFromReply('${r.telefon}','${escHtml(r.nama)}')">💰 Rekod Jualan</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function prefillSaleFromReply(telefon, nama) {
  document.getElementById('sales-nama').value = nama + ' (' + telefon + ')';
  document.getElementById('sales-amount').value = '';
  document.getElementById('sales-notes').value = '';
  document.getElementById('sales-amount').focus();
  document.getElementById('sales-form-section').scrollIntoView({ behavior: 'smooth' });
  showToast('Form diisi dengan contact ' + nama);
}

async function addSale() {
  const nama = document.getElementById('sales-nama').value.trim();
  const amount = parseFloat(document.getElementById('sales-amount').value);
  const notes = document.getElementById('sales-notes').value.trim();

  if (!nama) { showToast('Sila masukkan nama pelanggan', 'error'); return; }
  if (!amount || amount <= 0) { showToast('Sila masukkan jumlah RM yang sah', 'error'); return; }

  await fetch('/api/reports/sales', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nama, amount, notes }),
  });

  document.getElementById('sales-nama').value = '';
  document.getElementById('sales-amount').value = '';
  document.getElementById('sales-notes').value = '';
  loadLaporan();
  showToast('💰 Rekod jualan RM ' + amount.toFixed(2) + ' disimpan');
}

async function deleteSale(id) {
  await fetch(`/api/reports/sales/${id}`, { method: 'DELETE' });
  loadLaporan();
  showToast('Rekod jualan dibuang', 'error');
}

function renderSales(sales) {
  const totalEl = document.getElementById('rpt-sales-total');
  const el = document.getElementById('rpt-sales-list');
  const total = sales.reduce((s, sale) => s + (sale.amount || 0), 0);
  totalEl.textContent = 'RM ' + total.toLocaleString('ms-MY', { minimumFractionDigits: 2 });

  if (!sales.length) {
    el.innerHTML = '<p class="empty-pick">Tiada rekod jualan lagi</p>';
    return;
  }
  el.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Nama</th><th>RM</th><th>Nota</th><th>Tarikh</th><th></th></tr></thead>
        <tbody>
          ${sales.map(s => `
            <tr class="contact-row">
              <td>${escHtml(s.nama)}</td>
              <td style="color:#a855f7;font-weight:600;">RM ${parseFloat(s.amount).toLocaleString('ms-MY', { minimumFractionDigits: 2 })}</td>
              <td style="color:#94a3b8;font-size:0.85rem;">${escHtml(s.notes || '—')}</td>
              <td style="color:#64748b;font-size:0.8rem;">${new Date(s.date).toLocaleDateString('ms-MY')}</td>
              <td style="text-align:right;"><button class="btn-del" onclick="deleteSale('${s.id}')">🗑</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ── Device Management ──────────────────────────────────
let devicesList = [];

async function loadDevices() {
  devicesList = await fetch('/api/devices').then(r => r.json()).catch(() => []);
  renderDeviceSelector();
  renderDevicesList();
}

function renderDeviceSelector() {
  const current = devicesList.find(d => d.isCurrent) || devicesList[0];
  const nameEl = document.getElementById('device-selector-name');
  const dotEl = document.getElementById('device-status-dot');

  if (!current) {
    nameEl.textContent = 'Tiada peranti — klik untuk tambah';
    dotEl.style.background = '#ef4444';
    return;
  }

  nameEl.textContent = current.name;
  dotEl.style.background = current.connected ? '#22c55e'
    : current.status === 'qr' ? '#f59e0b'
    : current.status === 'connecting' ? '#3b82f6'
    : '#ef4444';
}

function renderDevicesList() {
  const el = document.getElementById('devices-list-mgmt');
  if (!el) return;

  if (!devicesList.length) {
    el.innerHTML = '<p class="empty-pick">Tiada peranti lagi. Tambah nombor WhatsApp untuk mula.</p>';
    return;
  }

  el.innerHTML = devicesList.map(d => {
    const statusColor = d.connected ? '#22c55e' : d.status === 'qr' ? '#f59e0b' : d.status === 'connecting' ? '#3b82f6' : '#ef4444';
    const statusText = d.connected ? 'Connected' : d.status === 'qr' ? 'Scan QR' : d.status === 'connecting' ? 'Menyambung...' : 'Tidak Bersambung';

    return `
    <div style="background:#0f172a;border:1px solid ${d.isCurrent ? '#22c55e40' : '#1e293b'};border-radius:10px;padding:14px;margin-bottom:10px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <span style="width:10px;height:10px;border-radius:50%;background:${statusColor};flex-shrink:0;"></span>
        <span style="color:#f1f5f9;font-weight:600;flex:1;">${escHtml(d.name)}</span>
        ${d.isCurrent ? '<span style="font-size:0.7rem;padding:2px 8px;background:#22c55e20;color:#22c55e;border-radius:4px;">AKTIF</span>' : ''}
        <span style="font-size:0.78rem;color:${statusColor};">${statusText}</span>
      </div>

      ${d.status === 'qr' && d.qr ? `
        <div style="text-align:center;margin-bottom:10px;">
          <p style="font-size:0.78rem;color:#64748b;margin-bottom:8px;">Scan dengan WhatsApp → Peranti Terpaut → Tambah Peranti</p>
          <img src="${d.qr}" style="width:180px;height:180px;border-radius:8px;" />
        </div>
      ` : ''}

      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        ${!d.isCurrent ? `<button onclick="selectDevice('${d.id}')" class="btn-primary" style="font-size:0.78rem;padding:5px 12px;">Guna Peranti Ini</button>` : ''}
        ${!d.connected && d.status !== 'qr' ? `<button onclick="reconnectDevice('${d.id}')" class="btn-secondary" style="font-size:0.78rem;padding:5px 12px;">Sambung Semula</button>` : ''}
        <button onclick="deleteDevice('${d.id}','${escHtml(d.name)}')" class="btn-danger" style="font-size:0.78rem;padding:5px 12px;">🗑 Buang</button>
      </div>
    </div>
  `}).join('');
}

function showDeviceMgmt() {
  document.getElementById('device-mgmt-modal').style.display = 'flex';
  loadDevices();
}

function closeDeviceMgmt() {
  document.getElementById('device-mgmt-modal').style.display = 'none';
}

async function addDevice() {
  const name = document.getElementById('new-device-name').value.trim();
  if (!name) { showToast('Sila masukkan nama peranti', 'error'); return; }

  const res = await fetch('/api/devices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  const data = await res.json();
  if (!res.ok) { showToast(data.error, 'error'); return; }

  document.getElementById('new-device-name').value = '';
  showToast(`Peranti "${name}" ditambah. Tunggu QR muncul...`);

  // Poll for QR
  let attempts = 0;
  const poll = setInterval(async () => {
    await loadDevices();
    const dev = devicesList.find(d => d.id === data.id);
    if (dev?.status === 'qr' || dev?.connected || attempts++ > 15) clearInterval(poll);
  }, 2000);
}

async function selectDevice(deviceId) {
  const res = await fetch(`/api/devices/${deviceId}/select`, { method: 'POST' });
  if (!res.ok) { showToast('Gagal tukar peranti', 'error'); return; }
  await loadDevices();
  loadAll();
  showToast('Peranti ditukar');
}

async function reconnectDevice(deviceId) {
  await fetch(`/api/devices/${deviceId}/connect`, { method: 'POST' });
  showToast('Cuba sambung semula...');
  setTimeout(loadDevices, 3000);
}

async function deleteDevice(deviceId, name) {
  if (!confirm(`Buang peranti "${name}"? Semua data contacts dan jadual untuk peranti ini akan dipadam.`)) return;
  const res = await fetch(`/api/devices/${deviceId}`, { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok) { showToast(data.error, 'error'); return; }
  await loadDevices();
  if (data.newDeviceId) loadAll();
  showToast(`Peranti "${name}" dibuang`, 'error');
}

// ── Init ───────────────────────────────────────────────
function loadAll() {
  checkStatus();
  loadContacts();
  loadTemplates();
  loadSchedules();
  loadLogs();
  loadQueue();
  loadDevices();
}

async function init() {
  const authed = await checkAuth();
  if (authed) {
    await loadDevices();
    loadAll();
  }
  setInterval(checkStatus, 3000);
  setInterval(loadDevices, 5000);
  setInterval(loadLogs, 10000);
  setInterval(loadQueue, 30000);
  setInterval(loadSchedules, 20000);
}

init();

// ── Wire semua static buttons ──
(function wireButtons() {
  // Sidebar — <a> tag, prevent default jump
  document.getElementById('device-selector-btn')?.addEventListener('click', e => { e.preventDefault(); showDeviceMgmt(); });
  document.getElementById('btn-user-mgmt')?.addEventListener('click', showUserMgmt);
  document.getElementById('btn-logout')?.addEventListener('click', doLogout);

  // Login — guna form submit (paling reliable, bukan button click)
  document.getElementById('login-form')?.addEventListener('submit', e => { e.preventDefault(); doLogin(); });

  // Device modal
  document.getElementById('btn-close-device-mgmt')?.addEventListener('click', closeDeviceMgmt);
  document.getElementById('btn-add-device')?.addEventListener('click', addDevice);

  // User modal
  document.getElementById('btn-close-user-mgmt')?.addEventListener('click', closeUserMgmt);
  document.getElementById('btn-add-user')?.addEventListener('click', addUser);

  // Filter history
  document.getElementById('btn-filter-history')?.addEventListener('click', () => {
    filterHistoryOnly = !filterHistoryOnly;
    renderContactGroups(filterContacts(allContacts, document.getElementById('contact-search')?.value || ''));
  });

  // Laporan
  document.getElementById('btn-refresh-laporan')?.addEventListener('click', loadLaporan);
  document.getElementById('btn-add-sale')?.addEventListener('click', addSale);
})();
