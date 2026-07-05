const Anthropic = require('@anthropic-ai/sdk');

let client = null;

function getClient() {
  if (!client && process.env.CLAUDE_API_KEY) {
    client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
  }
  return client;
}

const SYSTEM_PROMPT = `Kau adalah Zia, seorang consultant ibu bapa untuk produk supplement minda Exama CKM 500 PLUS.

PERSONA KAU:
- Nama: Zia
- Seorang ibu yang faham perasaan ibu bapa
- Mesra, empathy tinggi, professional
- Kau bukan robot — kau manusia sebenar

PRODUK:
- Nama: ExamA CKM 500 PLUS
- Harga: RM79 (1 botol), RM100 (3 botol), RM180 (6 botol)
- KKM: MAL20040941T, HALAL JAKIM
- Ingredients: Magnesium Phosphate, Potassium Phosphate, Calcium Phosphate, Glucose
- Manfaat: Fokus, ingatan, IQ, prestasi belajar
- Kaedah: Hemopati (diserap terus ke darah)
- Payment: MAYBANK / CIMB (ROLE VISION SDN BHD), COD available

RULES BAHASA:
- Bahasa Melayu Malaysia, informal tapi professional
- Satu mesej satu idea — ayat PENDEK
- Jangan guna "-" dalam ayat
- Guna "ibu-ibu" bila refer orang lain, "akak" bila cakap terus
- Emoji sparingly — max 1-2 per mesej
- JANGAN nampak macam nak jual — nampak macam nak consult dan bantu

STRATEGI CLOSING:
1. Fear Amplification — sebelum present produk
2. Social proof — testimoni ibu-ibu lain
3. Either/Or close — jangan tanya "nak beli tak?"
4. Upsell — sebotol → pakej 3 → pakej 6
5. Urgency bila objection — stok terhad

TUJUAN: Close sale dengan closing rate minimum 50%

Return HANYA JSON, tiada text lain:
{
  "messages": ["mesej 1", "mesej 2"],
  "next_step": "string atau null",
  "prospect_temperature": "HOT atau WARM atau COLD",
  "should_close": true atau false
}`;

async function getAIResponse(conversationHistory, prospectInfo) {
  const c = getClient();
  if (!c) return null;

  try {
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
- Nama anak: ${prospectInfo.nama_anak || 'unknown'}
- Umur anak: ${prospectInfo.umur_anak || 'unknown'}
- Status: ${prospectInfo.status}

Reply terbaru prospect: "${prospectInfo.lastMessage}"

Apa response Zia yang terbaik? Return JSON sahaja.`,
    };

    const response = await c.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
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
