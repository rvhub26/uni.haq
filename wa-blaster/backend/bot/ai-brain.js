const Anthropic = require('@anthropic-ai/sdk');
const { renderTemplate } = require('./templateRenderer');

let client = null;

function getClient() {
  if (!client && process.env.CLAUDE_API_KEY) {
    client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
  }
  return client;
}

const FALLBACK_PROMPT = `Kau adalah {{persona}}, seorang consultant kesihatan untuk produk {{namaProduk}}.
Harga: {{hargaLadder}}
Bahasa Melayu Malaysia, mesra dan professional. Jangan dakwa penyembuhan/rawatan.
Return HANYA JSON: {"messages": ["mesej 1"], "next_step": "string atau null", "prospect_temperature": "HOT atau WARM atau COLD", "should_close": true atau false}`;

function buildHargaLadder(tiers) {
  return tiers.map(t => `${t.label} RM${t.price} (${t.quantity * 30} hari)`).join(', ');
}

async function getAIResponse(conversationHistory, prospectInfo, product, tiers, brainConfig) {
  const c = getClient();
  if (!c) return null;

  try {
    const persona = brainConfig.persona_name;
    const systemPrompt = renderTemplate(brainConfig.ai_system_prompt || FALLBACK_PROMPT, {
      persona,
      namaProduk: product.nama_produk,
      hargaLadder: buildHargaLadder(tiers),
    });

    // Format conversation history untuk Claude
    const formattedHistory = conversationHistory.map(conv => ({
      role: conv.direction === 'inbound' ? 'user' : 'assistant',
      content: conv.message || '',
    }));

    const userMessage = {
      role: 'user',
      content: `Info prospect semasa:
- Angle: ${prospectInfo.angle || 'belum detect'}
- Step: ${prospectInfo.current_step}
- Tempoh masalah: ${prospectInfo.tempoh_masalah || 'unknown'}
- Status: ${prospectInfo.status}

Reply terbaru prospect: "${prospectInfo.lastMessage}"

Apa response ${persona} yang terbaik? Return JSON sahaja.`,
    };

    const response = await c.messages.create({
      model: brainConfig.ai_model || 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [...formattedHistory, userMessage],
    });

    const text = response.content[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error('[AI Brain] Error:', err.message);
    return null;
  }
}

module.exports = { getAIResponse };
