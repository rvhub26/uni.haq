const axios = require('axios');

const BASE = 'https://api.telegram.org';

async function send(text, token, chatId) {
  const tk  = token || process.env.TELEGRAM_BOT_TOKEN;
  const cid = chatId || process.env.TELEGRAM_CHAT_ID;
  if (!tk || !cid) return;

  try {
    await axios.post(`${BASE}/bot${tk}/sendMessage`, {
      chat_id: cid,
      text,
      parse_mode: 'HTML',
    });
  } catch (err) {
    console.error('[Telegram] Error:', err.response?.data || err.message);
  }
}

// Real time — bila order close
async function notifyNewOrder(prospect, order, product, settings = null, tiers = []) {
  const token  = settings?.telegram_bot_token;
  const chatId = settings?.telegram_chat_id;

  const tierLabel = (tiers.find(t => t.tierKey === order?.pakej) || {}).label || order?.pakej || '-';

  const text = `🔔 <b>ORDER BARU MASUK!</b>

👤 Nama: ${prospect.nama || '-'}
📱 No Fon: ${prospect.phone_number}
📦 Produk: ${product?.nama_produk || 'Produk'} — ${tierLabel}
💰 Total: RM${order?.total_price || '-'}
🏦 Payment: ${order?.payment_method?.toUpperCase() || '-'}
🏠 Alamat: ${order?.delivery_address || 'COD — tunggu details'}

⏰ ${new Date().toLocaleString('ms-MY')}`;

  await send(text, token, chatId);
}

// Daily report — 12 malam via cron
async function sendDailyReport(stats, adSpend, settings = null) {
  const token  = settings?.telegram_bot_token;
  const chatId = settings?.telegram_chat_id;

  const total = stats.total || 0;
  const close = stats.close || 0;
  const warm  = stats.warm  || 0;
  const cold  = stats.cold  || 0;
  const sales = parseFloat(stats.total_sales || 0);
  const spend = parseFloat(adSpend || 0);

  const closingRate = total > 0 ? ((close / total) * 100).toFixed(1) : '0.0';
  const roi = spend > 0 ? (sales / spend).toFixed(2) : 'N/A';

  const text = `📊 <b>LAPORAN UNIBOT</b>
📅 ${new Date().toLocaleDateString('ms-MY')}

———————————————
🔥 Total Lead: ${total}
✅ Close: ${close}
☀️ Warm: ${warm}
❄️ Cold: ${cold}
———————————————
🎯 Closing Rate: ${closingRate}%
💰 Total Sales: RM${sales.toFixed(2)}
📢 Ad Spend: RM${spend.toFixed(2)}
📈 ROI: ${roi}x
———————————————`;

  await send(text, token, chatId);
}

module.exports = { send, notifyNewOrder, sendDailyReport };
