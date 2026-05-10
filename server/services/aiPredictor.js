import axios from 'axios';
import { Match } from '../db.js';

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

  const getForm = async (teamName) => {
    try {
      const pastMatches = await Match.find({ 
        status: 'completed', 
        $or: [{ team1: teamName }, { team2: teamName }] 
      }).sort({ date: -1 }).limit(5);

      if (pastMatches.length === 0) return 'No recent data';
      return pastMatches.map(m => {
        if (m.winner === teamName) return 'W';
        if (m.winner && m.winner !== teamName && m.winner !== 'TBD' && m.winner !== 'Draw') return 'L';
        return 'D';
      }).reverse().join('-');
    } catch (e) {
      return 'Unknown';
    }
  };

  const form1 = await getForm(match.team1);
  const form2 = await getForm(match.team2);

  // Calculate Head-to-Head
  let h2hStr = 'No recent encounters in database';
  try {
    const h2hMatches = await Match.find({
      status: 'completed',
      $or: [
        { team1: match.team1, team2: match.team2 },
        { team1: match.team2, team2: match.team1 }
      ]
    });
    if (h2hMatches.length > 0) {
      let t1Wins = 0; let t2Wins = 0;
      h2hMatches.forEach(m => {
        if (m.winner === match.team1) t1Wins++;
        else if (m.winner === match.team2) t2Wins++;
      });
      h2hStr = `${match.team1} ${t1Wins} - ${t2Wins} ${match.team2} (out of ${h2hMatches.length} matches)`;
    }
  } catch (e) {
    // Ignore error
  }

  const prompt = `You are a world-class cricket analytics expert. Your task is to predict the winner of this upcoming cricket match:

Match: ${match.team1Full} vs ${match.team2Full}
Tournament: ${match.tournament}
Venue: ${match.venue}
Date: ${match.date}
Format: ${match.category === 'ipl' ? 'T20 (IPL)' : match.category === 'icc-t20' ? 'T20I' : match.category === 'icc-odi' ? 'ODI' : 'Test'}

[LIVE STATS FROM DATABASE]
${match.team1} Recent Form (Last 5): ${form1}
${match.team2} Recent Form (Last 5): ${form2}
Head-to-Head (Recent): ${h2hStr}

Based on your extensive historical knowledge AND the [LIVE STATS] provided above, carefully analyze the following factors:
1. The injected Head-to-Head and Recent Form statistics (prioritize these over historical biases).
2. Pitch and weather conditions typically expected at ${match.venue}.
3. General team strengths and weaknesses.

Respond in this EXACT JSON format only, no markdown:
{"winner": "Team Name", "confidence": 65, "reason": "Detailed 2-3 sentence analysis of pitch conditions, head-to-head, and key match-ups."}

Rules:
- "winner" must be exactly one of: "${match.team1Full}" or "${match.team2Full}"
- "confidence" must be a realistic number between 51 and 85 (no match is certain).
- "reason" must be highly analytical, explicitly mentioning the specific venue behavior (e.g., spin-friendly, high-scoring) and team matchups. Keep it under 40 words.`;

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
