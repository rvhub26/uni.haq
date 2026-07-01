const router = require('express').Router();

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

// Meta incoming messages — POST request
router.post('/', (req, res) => {
  const body = req.body;
  if (body.object === 'whatsapp_business_account') {
    body.entry?.forEach(entry => {
      entry.changes?.forEach(change => {
        const value = change.value;
        // Status updates
        if (value.statuses) {
          value.statuses.forEach(s => {
            console.log(`[Webhook] Status: ${s.status} → ${s.recipient_id}`);
          });
        }
        // Incoming messages
        if (value.messages) {
          value.messages.forEach(msg => {
            console.log(`[Webhook] Mesej masuk dari ${msg.from}: ${msg.text?.body || '[media]'}`);
          });
        }
      });
    });
    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.status(404).send('Not found');
  }
});

module.exports = router;
