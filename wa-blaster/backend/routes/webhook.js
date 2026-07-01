const router = require('express').Router();
const { readJSON, writeJSON, readUserJSON, readDeviceJSON, writeDeviceJSON } = require('../store');

const VERIFY_TOKEN = 'unihaq2026';

// Meta verify webhook — GET request
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[Webhook] Meta verified successfully');
    return res.status(200).send(challenge);
  }
  console.log('[Webhook] Verify failed — token mismatch');
  res.status(403).send('Forbidden');
});

// Cari device berdasarkan phone_number_id
function findDeviceByPhoneNumberId(phoneNumberId) {
  try {
    const users = readJSON('users.json');
    for (const user of users) {
      const devices = readUserJSON(user.id, 'devices.json');
      for (const device of devices) {
        if (device.type !== 'meta') continue;
        const creds = require('../store').readDeviceJSONObject(user.id, device.id, 'meta-creds.json');
        if (creds.phoneNumberId === phoneNumberId) {
          return { userId: user.id, deviceId: device.id };
        }
      }
    }
  } catch {}
  return null;
}

// Meta incoming messages — POST request
router.post('/', (req, res) => {
  const body = req.body;
  if (body.object !== 'whatsapp_business_account') return res.status(404).send('Not found');

  body.entry?.forEach(entry => {
    entry.changes?.forEach(change => {
      const value = change.value;
      const phoneNumberId = value.metadata?.phone_number_id;
      const device = phoneNumberId ? findDeviceByPhoneNumberId(phoneNumberId) : null;

      // Delivery status updates (sent/delivered/read/failed)
      if (value.statuses) {
        value.statuses.forEach(s => {
          console.log(`[Webhook] Status: ${s.status} → ${s.recipient_id}`);
          if (!device) return;

          // Update queue item status
          const queue = readDeviceJSON(device.userId, device.deviceId, 'queue.json');
          const item = queue.find(q => q.telefon === s.recipient_id && q.status === 'sent');
          if (item) {
            if (s.status === 'delivered') item.deliveredAt = new Date().toISOString();
            if (s.status === 'read') item.readAt = new Date().toISOString();
            if (s.status === 'failed') { item.failed = true; item.failedAt = new Date().toISOString(); }
            writeDeviceJSON(device.userId, device.deviceId, 'queue.json', queue);
          }
        });
      }

      // Incoming messages (reply dari prospek)
      if (value.messages) {
        value.messages.forEach(msg => {
          const dari = msg.from;
          const teks = msg.text?.body || '[media]';
          console.log(`[Webhook] Mesej masuk dari ${dari}: ${teks}`);

          if (!device) return;
          const { readDeviceJSONObject: readObj, writeDeviceJSON: writeD } = require('../store');
          const contacts = readDeviceJSON(device.userId, device.deviceId, 'contacts.json');
          const contact = contacts.find(c => c.telefon === dari);
          if (!contact) return;

          const replies = readObj(device.userId, device.deviceId, 'replies.json');
          if (!replies[dari]) {
            replies[dari] = { nama: contact.nama, replied: true, repliedAt: new Date().toISOString() };
            writeD(device.userId, device.deviceId, 'replies.json', replies);
          }
        });
      }
    });
  });

  res.status(200).send('EVENT_RECEIVED');
});

module.exports = router;
