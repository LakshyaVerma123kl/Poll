import axios from 'axios';
import { Match } from '../db.js';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// ── IPL 2026 Squad Knowledge Base ──
// Gives the AI actual roster context so it can reference real players
const IPL_SQUADS = {
  CSK: 'Ruturaj Gaikwad (c), MS Dhoni (wk), Devon Conway, Shivam Dube, Ravindra Jadeja, Deepak Chahar, Tushar Deshpande, Matheesha Pathirana, Rachin Ravindra, Maheesh Theekshana',
  MI: 'Hardik Pandya (c), Rohit Sharma, Jasprit Bumrah, Suryakumar Yadav, Ishan Kishan (wk), Tim David, Trent Boult, Dewald Brevis, Kumar Kartikeya',
  RCB: 'Virat Kohli, Rajat Patidar, Faf du Plessis (c), Glenn Maxwell, Dinesh Karthik (wk), Wanindu Hasaranga, Josh Hazlewood, Mohammed Siraj, Cameron Green',
  KKR: 'Shreyas Iyer (c), Andre Russell, Sunil Narine, Phil Salt (wk), Starc Mitchell, Varun Chakravarthy, Venkatesh Iyer, Rinku Singh, Nitish Rana',
  SRH: 'Pat Cummins (c), Travis Head, Heinrich Klaasen (wk), Abhishek Sharma, Bhuvneshwar Kumar, Marco Jansen, Shahbaz Ahmed, Jaydev Unadkat',
  DC: 'Rishabh Pant (c/wk), David Warner, Jake Fraser-McGurk, Axar Patel, Kuldeep Yadav, Anrich Nortje, Abishek Porel, Tristan Stubbs',
  RR: 'Sanju Samson (c/wk), Yashasvi Jaiswal, Jos Buttler, Shimron Hetmyer, Ravichandran Ashwin, Trent Boult, Yuzvendra Chahal, Sandeep Sharma',
  PBKS: 'Shikhar Dhawan (c), Jonny Bairstow (wk), Liam Livingstone, Sam Curran, Kagiso Rabada, Arshdeep Singh, Rahul Chahar, Jitesh Sharma',
  GT: 'Shubman Gill (c), Rashid Khan, David Miller, Wriddhiman Saha (wk), Mohammed Shami, Noor Ahmad, B. Sai Sudharsan, Shahrukh Khan',
  LSG: 'KL Rahul (c), Quinton de Kock (wk), Nicholas Pooran, Marcus Stoinis, Ravi Bishnoi, Mark Wood, Avesh Khan, Ayush Badoni',
};

// ── Venue Intelligence ──
const VENUE_INTEL = {
  'Wankhede Stadium, Mumbai': 'Fast outfield, short square boundaries (65m), high-scoring, dew plays major role in second innings. Seamers get early swing under lights. Avg 1st innings T20 score: 175+.',
  'MA Chidambaram Stadium, Chennai': 'Slow, low-bounce track that grips. Scores drop in 2nd innings. Spinners dominate middle overs with turn and variable bounce. Avg 1st innings: 155-165.',
  'Eden Gardens, Kolkata': 'Good pace and bounce early, slows down later. Big square boundaries favor dot balls. Dew factor significant. Avg 1st innings: 170.',
  'M Chinnaswamy Stadium, Bengaluru': 'Smallest ground in IPL (55m straight), flat batting paradise. Scores of 200+ common. Death bowling is the deciding factor, not pitch.',
  'Arun Jaitley Stadium, Delhi': 'True bounce, carries well to keeper. Good for stroke-play but also offers seam movement early. Avg 1st innings: 165-175.',
  'Rajiv Gandhi International Stadium, Hyderabad': 'Biggest boundaries in IPL (80m+). Rewards placement over power. Ground size means lower strike rates for big hitters.',
  'Narendra Modi Stadium, Ahmedabad': 'New pitch, true bounce, good for batting. Massive ground but outfield is fast. Evening dew helps chasers significantly.',
  'Sawai Mansingh Stadium, Jaipur': 'Slow, spin-assisting surface. Low bounce makes driving difficult. Wrist spinners historically dominate here.',
  'HPCA Stadium, Dharamshala': 'High altitude = ball travels 10% further. Seamers get late swing due to thin air. Short boundaries + altitude = high-scoring thriller.',
  'Ekana Cricket Stadium, Lucknow': 'Fresh surface with even bounce. Slower balls are effective at death. Moderate-scoring venue, 160-170 competitive.',
  'SVNS International Cricket Stadium, Raipur': 'Newer venue, good for batting under lights. True bounce, favors pace bowlers who hit hard lengths.',
  'New International Cricket Stadium, New Chandigarh': 'Brand new venue. Expected true bounce and good carry. Evening matches may have dew.',
};

function getVenueIntel(venue) {
  if (!venue || venue === 'TBA') return 'Venue TBA — no specific pitch data available.';
  for (const [key, intel] of Object.entries(VENUE_INTEL)) {
    if (venue.toLowerCase().includes(key.toLowerCase().split(',')[0].toLowerCase())) {
      return intel;
    }
  }
  return `${venue} — limited pitch data available, general conditions apply.`;
}

function getSquadInfo(team) {
  return IPL_SQUADS[team] || `${team} — international squad (key players from their national roster)`;
}

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
        const won = m.winner && (m.winner.toLowerCase() === teamName.toLowerCase() || m.winner.toLowerCase().includes(teamName.toLowerCase()));
        if (won) return 'W';
        if (m.winner && m.winner !== 'TBD' && m.winner !== 'Draw') return 'L';
        return 'D';
      }).reverse().join('-');
    } catch (e) {
      return 'Unknown';
    }
  };

  const form1 = await getForm(match.team1);
  const form2 = await getForm(match.team2);

  // Calculate Head-to-Head
  let h2hStr = 'No previous encounters in database';
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
        const w = (m.winner || '').toLowerCase();
        if (w === match.team1.toLowerCase() || w.includes(match.team1.toLowerCase())) t1Wins++;
        else if (w === match.team2.toLowerCase() || w.includes(match.team2.toLowerCase())) t2Wins++;
      });
      h2hStr = `${match.team1} ${t1Wins} - ${t2Wins} ${match.team2} (${h2hMatches.length} matches)`;
    }
  } catch (e) {
    // Ignore error
  }

  const venueIntel = getVenueIntel(match.venue);
  const squad1 = getSquadInfo(match.team1);
  const squad2 = getSquadInfo(match.team2);
  const format = match.category === 'ipl' ? 'T20 (IPL)' : match.category === 'icc-t20' ? 'T20I' : match.category === 'icc-odi' ? 'ODI' : 'Test';

  const systemPrompt = `You are Harsha Bhogle-level cricket analyst combined with a data scientist. You give SHARP, SPECIFIC tactical predictions — never generic fluff.

BANNED PHRASES (never use these):
- "home advantage", "home conditions", "home support"
- "spin-friendly pitch" (say WHICH spinner and WHY)
- "momentum" (say WHAT specifically changed)
- "key players will be crucial" (name them and say what they'll DO)
- "conditions will favor" (say HOW and against WHICH batsmen/bowlers specifically)

Your analysis must reference:
1. SPECIFIC players by name and their SPECIFIC matchup advantage
2. SPECIFIC venue characteristics (boundary size, avg score, dew, bounce) and how they affect specific bowlers/batsmen
3. A concrete tactical edge (e.g., "X's left-arm angle into the right-handers gives them 3 dot balls per over in the powerplay on average")

You respond ONLY in JSON format. No markdown, no explanation outside JSON.`;

  const userPrompt = `Predict this match:

${match.team1Full} vs ${match.team2Full}
🏟 ${match.venue}
📅 ${match.date} | ⏰ ${match.startTime || '19:30'} IST
🏆 ${match.tournament} | Format: ${format}

── VENUE INTELLIGENCE ──
${venueIntel}

── SQUAD CONTEXT ──
${match.team1}: ${squad1}
${match.team2}: ${squad2}

── FORM & H2H ──
${match.team1} recent form: ${form1}
${match.team2} recent form: ${form2}
Head-to-Head: ${h2hStr}

Give your prediction as JSON:
{"winner": "Full Team Name", "confidence": <51-82>, "reason": "<Your razor-sharp 30-50 word analysis naming specific players, their matchup edge, and how the venue conditions create that edge>"}

"winner" must be exactly "${match.team1Full}" or "${match.team2Full}".`;

  try {
    const { data } = await axios.post(GROQ_API_URL, {
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.6,
      max_tokens: 300,
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
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

    // Ensure winner is one of the two teams
    const validWinners = [match.team1Full.toLowerCase(), match.team2Full.toLowerCase()];
    if (!validWinners.includes(prediction.winner.toLowerCase())) {
      // Try to fix by matching closest
      if (prediction.winner.toLowerCase().includes(match.team1.toLowerCase())) {
        prediction.winner = match.team1Full;
      } else {
        prediction.winner = match.team2Full;
      }
    }

    return {
      winner: prediction.winner,
      confidence: Math.min(82, Math.max(51, prediction.confidence)),
      reason: prediction.reason,
      model: 'Llama 3.3 70B'
    };
  } catch (err) {
    console.error('[AI Prediction Error]', err.message);
    return { error: 'AI prediction failed', detail: err.message };
  }
}
