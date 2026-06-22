const statusBadge = document.getElementById('statusBadge');
const connectionMessage = document.getElementById('connectionMessage');
const qrContainer = document.getElementById('qrContainer');
const qrImage = document.getElementById('qrImage');
const contactList = document.getElementById('contactList');
const historyList = document.getElementById('historyList');
const scheduleList = document.getElementById('scheduleList');
const contactForm = document.getElementById('contactForm');
const broadcastForm = document.getElementById('broadcastForm');
const scheduleForm = document.getElementById('scheduleForm');

let pollTimer = null;

function updateStatusUI(data) {
  statusBadge.textContent = data.status;
  statusBadge.className = `badge ${data.status}`;

  if (data.status === 'connected') {
    connectionMessage.textContent = 'WhatsApp is connected and ready to send messages.';
  } else if (data.status === 'qr') {
    connectionMessage.textContent = 'Scan the QR code to connect WhatsApp.';
    qrContainer.classList.remove('hidden');
    qrImage.src = data.qrCode;
  } else if (data.status === 'reconnecting') {
    connectionMessage.textContent = 'Connection lost. Reconnecting...';
    qrContainer.classList.add('hidden');
  } else if (data.status === 'connecting') {
    connectionMessage.textContent = 'Connecting to WhatsApp...';
    qrContainer.classList.add('hidden');
  } else if (data.status === 'error') {
    connectionMessage.textContent = data.error || 'Unable to connect.';
    qrContainer.classList.add('hidden');
  } else {
    connectionMessage.textContent = 'Waiting for connection...';
    qrContainer.classList.add('hidden');
  }
}

function renderContacts(contacts) {
  contactList.innerHTML = '';

  if (!contacts.length) {
    contactList.innerHTML = '<li>No contacts added yet.</li>';
    return;
  }

  contacts.forEach((contact) => {
    const item = document.createElement('li');
    item.className = 'contact-item';

    item.innerHTML = `
      <div>
        <strong>${contact.name}</strong>
        <div>${contact.jid}</div>
      </div>
      <button class="delete-btn" data-id="${contact.id}">Delete</button>
    `;

    contactList.appendChild(item);
  });
}

function renderHistory(history) {
  historyList.innerHTML = '';

  if (!history.length) {
    historyList.innerHTML = '<li>No broadcast history yet.</li>';
    return;
  }

  history.forEach((entry) => {
    const item = document.createElement('li');
    item.className = 'history-item';

    item.innerHTML = `
      <div>
        <strong>${entry.success}/${entry.total} sent</strong>
        <div>${entry.message}</div>
      </div>
      <span>${new Date(entry.sentAt).toLocaleString()}</span>
    `;

    historyList.appendChild(item);
  });
}

function renderSchedules(schedules) {
  scheduleList.innerHTML = '';

  if (!schedules.length) {
    scheduleList.innerHTML = '<li>No scheduled posts yet.</li>';
    return;
  }

  schedules.forEach((schedule) => {
    const item = document.createElement('li');
    item.className = 'schedule-item';

    item.innerHTML = `
      <div>
        <strong>${schedule.frequency}</strong>
        <div>${schedule.message}</div>
        <div>${new Date(schedule.scheduledAt).toLocaleString()}</div>
      </div>
      <button class="delete-btn" data-schedule-id="${schedule.id}">Delete</button>
    `;

    scheduleList.appendChild(item);
  });
}

async function loadDashboard() {
  try {
    const [statusRes, contactsRes, historyRes, schedulesRes] = await Promise.all([
      fetch('/api/status'),
      fetch('/api/contacts'),
      fetch('/api/history'),
      fetch('/api/schedules'),
    ]);

    const status = await statusRes.json();
    const contacts = await contactsRes.json();
    const history = await historyRes.json();
    const schedules = await schedulesRes.json();

    updateStatusUI(status);
    renderContacts(contacts);
    renderHistory(history);
    renderSchedules(schedules);
  } catch (error) {
    console.error(error);
  }
}

contactForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const name = document.getElementById('contactName').value.trim();
  const jid = document.getElementById('contactJid').value.trim();

  if (!name || !jid) {
    return;
  }

  const response = await fetch('/api/contacts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, jid }),
  });

  if (response.ok) {
    contactForm.reset();
    loadDashboard();
  }
});

broadcastForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const message = document.getElementById('messageText').value.trim();

  if (!message) {
    return;
  }

  const response = await fetch('/api/broadcast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });

  const result = await response.json();

  if (response.ok) {
    broadcastForm.reset();
    loadDashboard();
    alert(`Broadcast sent: ${result.success}/${result.total}`);
  } else {
    alert(result.error || 'Broadcast failed.');
  }
});

scheduleForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const message = document.getElementById('scheduleMessage').value.trim();
  const scheduledAt = document.getElementById('scheduleTime').value;
  const frequency = document.getElementById('scheduleFrequency').value;

  if (!message || !scheduledAt) {
    return;
  }

  const response = await fetch('/api/schedules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, scheduledAt, frequency }),
  });

  const result = await response.json();

  if (response.ok) {
    scheduleForm.reset();
    loadDashboard();
    alert(`Scheduled successfully for ${new Date(result.scheduledAt).toLocaleString()}`);
  } else {
    alert(result.error || 'Unable to schedule message.');
  }
});

contactList.addEventListener('click', async (event) => {
  const target = event.target;

  if (target.classList.contains('delete-btn') && target.dataset.id) {
    const id = target.dataset.id;
    const response = await fetch(`/api/contacts/${id}`, { method: 'DELETE' });

    if (response.ok) {
      loadDashboard();
    }
  }
});

scheduleList.addEventListener('click', async (event) => {
  const target = event.target;

  if (target.classList.contains('delete-btn') && target.dataset.scheduleId) {
    const id = target.dataset.scheduleId;
    const response = await fetch(`/api/schedules/${id}`, { method: 'DELETE' });

    if (response.ok) {
      loadDashboard();
    }
  }
});

function startPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
  }

  pollTimer = setInterval(() => {
    loadDashboard();
  }, 2000);
}

loadDashboard();
startPolling();
