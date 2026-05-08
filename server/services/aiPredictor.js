import axios from 'axios';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Uses Groq's Llama 3.3 to generate an AI prediction for a cricket match.
 * Returns a structured prediction with winner, confidence, and reasoning.
 */
export async function getAIPrediction(match) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { error: 'AI predictions unavailable (no API key configured)' };
  }

  const prompt = `You are a cricket analytics expert. Predict the winner of this match:

Match: ${match.team1Full} vs ${match.team2Full}
Tournament: ${match.tournament}
Venue: ${match.venue}
Date: ${match.date}
Format: ${match.category === 'ipl' ? 'T20 (IPL)' : match.category === 'icc-t20' ? 'T20I' : match.category === 'icc-odi' ? 'ODI' : 'Test'}

Respond in this EXACT JSON format only, no markdown:
{"winner": "Team Name", "confidence": 65, "reason": "Brief 1-2 sentence analysis"}

Rules:
- "winner" must be exactly one of: "${match.team1Full}" or "${match.team2Full}"
- "confidence" must be a number between 51 and 85 (no match is certain)
- "reason" should mention form, conditions, or head-to-head
- Keep reasoning under 30 words`;

  try {
    const { data } = await axios.post(GROQ_API_URL, {
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 150,
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    const raw = data.choices?.[0]?.message?.content?.trim();
    if (!raw) throw new Error('Empty AI response');

    // Parse JSON from response (handle markdown code blocks)
    const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const prediction = JSON.parse(jsonStr);

    // Validate
    if (!prediction.winner || !prediction.confidence || !prediction.reason) {
      throw new Error('Invalid prediction structure');
    }

    return {
      winner: prediction.winner,
      confidence: Math.min(85, Math.max(51, prediction.confidence)),
      reason: prediction.reason,
      model: 'llama-3.3-70b'
    };
  } catch (err) {
    console.error('[AI Prediction Error]', err.message);
    return { error: 'AI prediction failed', detail: err.message };
  }
}
