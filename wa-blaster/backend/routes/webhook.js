const router = require('express').Router();
const metaCredentialsRepo = require('../repos/metaCredentials');
const devicesRepo = require('../repos/devices');
const queueRepo = require('../repos/queue');
const inbound = require('../inbound');

const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'unihaq2026';

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

// Meta incoming messages — POST request
router.post('/', async (req, res) => {
  const body = req.body;
  if (body.object !== 'whatsapp_business_account') return res.status(404).send('Not found');

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value;
      const phoneNumberId = value.metadata?.phone_number_id;
      const device = phoneNumberId ? await metaCredentialsRepo.findDeviceByPhoneNumberId(phoneNumberId) : null;
      const deviceId = device?.device_id || null;

      // Delivery status updates (sent/delivered/read/failed)
      if (value.statuses) {
        for (const s of value.statuses) {
          console.log(`[Webhook] Status: ${s.status} → ${s.recipient_id}`);
          if (!deviceId) continue;
          await queueRepo.markDeliveryStatus(deviceId, s.recipient_id, s.status).catch(() => {});
        }
      }

      // Incoming messages (reply dari prospek)
      if (value.messages) {
        for (const msg of value.messages) {
          const dari = msg.from;
          const teks = msg.text?.body || '';
          const isImage = !!msg.image;
          console.log(`[Webhook] Mesej masuk dari ${dari}: ${teks || '[media]'}`);

          if (!deviceId) continue;
          const device = await devicesRepo.getById(deviceId);
          try {
            await inbound.handleInboundMessage({
              userId: device?.user_id, deviceId, from: dari, text: teks.trim(), isImage, waMessageId: msg.id,
            });
          } catch {}
        }
      }
    }
  }

  res.status(200).send('EVENT_RECEIVED');
});

module.exports = router;
