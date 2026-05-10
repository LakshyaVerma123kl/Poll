import axios from 'axios';
import { Match } from '../db.js';
import { getIplStandings } from './pointsTableScraper.js';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// ── IPL 2026 Squad Knowledge Base ──
// Gives the AI actual roster context so it can reference real players
const IPL_SQUADS = {
  CSK: 'Ruturaj Gaikwad (c), MS Dhoni (wk), Ravindra Jadeja, Shivam Dube, Matheesha Pathirana, Rachin Ravindra, Anshul Kamboj, Prashant Veer, Kartik Sharma, Deepak Chahar',
  MI: 'Hardik Pandya (c), Rohit Sharma, Jasprit Bumrah, Suryakumar Yadav, Ishan Kishan (wk), Quinton de Kock, Tim David, Gerald Coetzee, Piyush Chawla',
  RCB: 'Virat Kohli, Faf du Plessis (c), Rajat Patidar, Glenn Maxwell, Mohammed Siraj, Bhuvneshwar Kumar, Will Jacks, Cameron Green',
  KKR: 'Shreyas Iyer (c), Andre Russell, Sunil Narine, Phil Salt (wk), Mitchell Starc, Rinku Singh, Varun Chakravarthy, Venkatesh Iyer, Cameron Green',
  SRH: 'Pat Cummins (c), Travis Head, Heinrich Klaasen (wk), Abhishek Sharma, Eshan Malinga, Shahbaz Ahmed, Nitish Reddy, T Natarajan',
  DC: 'Rishabh Pant (c/wk), KL Rahul, Jake Fraser-McGurk, Axar Patel, Kuldeep Yadav, Tristan Stubbs, Mukesh Kumar, Khaleel Ahmed',
  RR: 'Sanju Samson (c/wk), Yashasvi Jaiswal, Jos Buttler, Riyan Parag, Vaibhav Sooryavanshi, Trent Boult, Yuzvendra Chahal, Sandeep Sharma, Avesh Khan',
  PBKS: 'Sam Curran (c), Shashank Singh, Ashutosh Sharma, Arshdeep Singh, Kagiso Rabada, Liam Livingstone, Jonny Bairstow, Harshal Patel',
  GT: 'Shubman Gill (c), Rashid Khan, B Sai Sudharsan, David Miller, Mohammed Shami, Kagiso Rabada, Rahul Tewatia, Spencer Johnson',
  LSG: 'Nicholas Pooran (c), Mayank Yadav, Ravi Bishnoi, Prince Yadav, Marcus Stoinis, Ayush Badoni, Mohsin Khan'
};

// ── IPL 2026 Top Performers (Context) ──
const IPL_2026_STATS = `
Orange Cap Contenders (Top Scorers): Heinrich Klaasen (SRH - 494 runs), Abhishek Sharma (SRH - 475 runs), KL Rahul (DC - 468 runs), Shubman Gill (GT - 462 runs), Vaibhav Sooryavanshi (RR - 440 runs).
Purple Cap Contenders (Top Wicket Takers): Kagiso Rabada (GT - 18 wkts), Bhuvneshwar Kumar (RCB - 17 wkts), Anshul Kamboj (CSK - 17 wkts), Prince Yadav (LSG - 16 wkts), Eshan Malinga (SRH - 16 wkts).
`;

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
        category: match.category, // Differentiate formats
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
      category: match.category, // Differentiate formats
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

  // Get dynamic IPL standings if applicable
  let standingsStr = '';
  if (match.category === 'ipl') {
    try {
      const { standings } = await getIplStandings();
      if (standings && standings.length > 0) {
        const t1Stand = standings.find(s => s.team === match.team1 || match.team1Full.toLowerCase().includes(s.team.toLowerCase()));
        const t2Stand = standings.find(s => s.team === match.team2 || match.team2Full.toLowerCase().includes(s.team.toLowerCase()));
        
        if (t1Stand && t2Stand) {
          standingsStr = `CURRENT STANDINGS:\n${match.team1}: Rank ${t1Stand.rank} (${t1Stand.pts} pts, NRR ${t1Stand.nrr})\n${match.team2}: Rank ${t2Stand.rank} (${t2Stand.pts} pts, NRR ${t2Stand.nrr})\n`;
        }
      }
    } catch (e) {
      // Ignore error
    }
  }

  const systemPrompt = `You are a Harsha Bhogle-level cricket analyst combined with a data scientist. You give SHARP, SPECIFIC tactical predictions — never generic fluff.

BANNED PHRASES (never use these):
- "home advantage", "home conditions", "home support"
- "spin-friendly pitch" (say WHICH spinner and WHY)
- "momentum" (say WHAT specifically changed)
- "key players will be crucial" (name them and say what they'll DO)
- "conditions will favor" (say HOW and against WHICH batsmen/bowlers specifically)

Your analysis must incorporate:
1. SPECIFIC player form (e.g. current Orange/Purple cap contenders, if available).
2. Tournament context (points table rank, desperation to win).
3. SPECIFIC venue characteristics (boundary size, dew, bounce) and how they affect specific matchups.
4. A concrete tactical edge (e.g., "X's left-arm angle into the right-handers gives them 3 dot balls per over in the powerplay on average").

You respond ONLY in JSON format. No markdown, no explanation outside JSON.`;

  const userPrompt = `Predict this match:

${match.team1Full} vs ${match.team2Full}
🏟 ${match.venue}
📅 ${match.date} | ⏰ ${match.startTime || '19:30'} IST
🏆 ${match.tournament} | Format: ${format}

── VENUE INTELLIGENCE ──
${venueIntel}

${match.category === 'ipl' ? `── IPL 2026 STATS CONTEXT ──\n${IPL_2026_STATS}\n` : ''}
${standingsStr}

── SQUAD CONTEXT ──
${match.team1}: ${squad1}
${match.team2}: ${squad2}

── FORM & H2H (Specific to this format) ──
${match.team1} recent form: ${form1}
${match.team2} recent form: ${form2}
Head-to-Head: ${h2hStr}

Give your prediction as JSON:
{"winner": "Full Team Name", "confidence": <51-82>, "reason": "<Your razor-sharp 40-60 word analysis naming specific players, their matchup edge, form stats, and how the venue conditions create that edge>"}

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
