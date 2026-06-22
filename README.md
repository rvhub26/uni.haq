# Auto Broadcast

A simple WhatsApp broadcast dashboard built with Node.js, Express, and Baileys.

## Requirements
- Node.js 18 or newer
- npm

## Install
```bash
npm install
```

## Run the system
```bash
npm start
```

The server will run at:
```text
http://localhost:3000
```

## Scan QR code
1. Open the dashboard in your browser.
2. Wait until the QR code appears.
3. Scan the QR code with your WhatsApp mobile app.
4. After the session is connected, the dashboard status will change to `connected`.

## How to use the dashboard
1. Add a contact using the form.
2. Enter the WhatsApp JID in this format:
   ```text
   6281234567890@s.whatsapp.net
   ```
3. Type a message and click **Send Broadcast** for immediate sending.
4. Use **Schedule Message** to choose a future time and set the frequency to `Once` or `Daily`.

## Schedule notes
- Scheduled messages are stored in JSON under `data/schedules.json`.
- For `Once`, the message is sent one time at the chosen date/time.
- For `Daily`, the message is sent every day at the selected time.

## Notes
- Contact data is stored in JSON files inside the `data` folder.
- Authentication session data is saved under `data/auth`.
