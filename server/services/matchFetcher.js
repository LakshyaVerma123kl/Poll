import axios from 'axios';
import * as cheerio from 'cheerio';
import { getDb } from '../db.js';

// ============================================================
// MULTI-FALLBACK MATCH FETCHER ENGINE
// Layer 1: CricAPI /currentMatches (live/recent)
// Layer 2: CricAPI /matches with pagination (upcoming schedule)
// Layer 3: Cricbuzz scraper (live scores)
// Layer 4: Hardcoded verified fallback data
// ============================================================

const AXIOS_OPTS = { timeout: 8000 };

// Team shortname mapping for clean display
const TEAM_SHORT = {
  'Chennai Super Kings': 'CSK', 'Mumbai Indians': 'MI',
  'Royal Challengers Bengaluru': 'RCB', 'Kolkata Knight Riders': 'KKR',
  'Sunrisers Hyderabad': 'SRH', 'Delhi Capitals': 'DC',
  'Rajasthan Royals': 'RR', 'Punjab Kings': 'PBKS',
  'Gujarat Titans': 'GT', 'Lucknow Super Giants': 'LSG',
  'India': 'IND', 'Australia': 'AUS', 'England': 'ENG',
  'Pakistan': 'PAK', 'South Africa': 'SA', 'New Zealand': 'NZ',
  'Sri Lanka': 'SL', 'Bangladesh': 'BAN', 'West Indies': 'WI',
  'Afghanistan': 'AFG', 'Zimbabwe': 'ZIM', 'Ireland': 'IRE',
  'Nepal': 'NEP', 'Oman': 'OMAN', 'Netherlands': 'NED',
  'Scotland': 'SCO', 'Namibia': 'NAM', 'UAE': 'UAE',
};

function getShortName(fullName) {
  if (!fullName) return 'TBD';
  if (TEAM_SHORT[fullName]) return TEAM_SHORT[fullName];
  // Try partial match
  for (const [full, short] of Object.entries(TEAM_SHORT)) {
    if (fullName.includes(full) || full.includes(fullName)) return short;
  }
  return fullName.substring(0, 3).toUpperCase();
}

function isWomensMatch(name) {
  return /\b(women|wmns|wodi|wt20|w-t20|women's)\b/i.test(name) || /-w\b/i.test(name);
}

function categorizeMatch(name, matchType) {
  const n = (name || '').toLowerCase();
  const mt = (matchType || '').toLowerCase();

  if (n.includes('ipl') || n.includes('indian premier league')) return 'ipl';
  
  const isDomestic = n.includes('unofficial') || /\b([a-z]+ a)\b/i.test(n) || n.includes('domestic') || n.includes('u19');
  if (isDomestic) return 'domestic';

  if (mt === 't20' || mt === 't20i') return 'icc-t20';
  if (mt === 'odi') return 'icc-odi';
  if (mt === 'test') return 'icc-test';
  return 'domestic';
}

function mapApiMatch(m) {
  const name = m.name || '';
  if (isWomensMatch(name)) return null;

  const team1Full = m.teams?.[0] || 'TBD';
  const team2Full = m.teams?.[1] || 'TBD';

  return {
    id: m.id,
    team1: m.teamInfo?.[0]?.shortname || getShortName(team1Full),
    team1Full,
    team2: m.teamInfo?.[1]?.shortname || getShortName(team2Full),
    team2Full,
    date: m.date,
    startTime: m.dateTimeGMT ? new Date(m.dateTimeGMT).toISOString().substring(11, 16) : '19:30',
    venue: m.venue || 'TBA',
    status: m.matchStarted ? (m.matchEnded ? 'completed' : 'live') : 'upcoming',
    winner: m.matchEnded ? (m.status || null) : null,
    tournament: name,
    category: categorizeMatch(name, m.matchType)
  };
}

// ======================== LAYER 1 ========================
// CricAPI /currentMatches — live and recently completed
async function fetchCurrentMatches(apiKey) {
  console.log('[Layer 1] Fetching /currentMatches...');
  const { data } = await axios.get(
    `https://api.cricapi.com/v1/currentMatches?apikey=${apiKey}&offset=0`, AXIOS_OPTS
  );
  if (data.status !== 'success' || !data.data) throw new Error('currentMatches failed');
  console.log(`[Layer 1] Got ${data.data.length} current matches (${data.info?.hitsUsed || '?'} API hit)`);
  return data.data.map(mapApiMatch).filter(Boolean);
}

// ======================== LAYER 2 ========================
// CricAPI /matches — full schedule with pagination
async function fetchScheduledMatches(apiKey, maxPages = 3) {
  console.log('[Layer 2] Fetching /matches (scheduled)...');
  let all = [];
  for (let page = 0; page < maxPages; page++) {
    const offset = page * 25;
    const { data } = await axios.get(
      `https://api.cricapi.com/v1/matches?apikey=${apiKey}&offset=${offset}`, AXIOS_OPTS
    );
    if (data.status !== 'success' || !data.data || data.data.length === 0) break;
    all = all.concat(data.data);
    console.log(`[Layer 2] Page ${page + 1}: +${data.data.length} matches (total: ${all.length})`);
    // Stop if we've fetched all rows or no more
    if (all.length >= (data.info?.totalRows || 0)) break;
    // Conservative: limit pages to save API hits
  }
  return all.map(mapApiMatch).filter(Boolean);
}

// ======================== LAYER 3 ========================
// Cricbuzz scraper
async function scrapeCricbuzz() {
  console.log('[Layer 3] Scraping Cricbuzz...');
  const { data } = await axios.get('https://www.cricbuzz.com/cricket-match/live-scores', {
    ...AXIOS_OPTS,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  const $ = cheerio.load(data);
  const matches = [];

  $('.cb-mtch-lst').each((i, el) => {
    const matchName = $(el).find('.cb-hm-text').text() || '';
    const statusText = $(el).find('.cb-text-live, .cb-text-complete, .cb-text-preview').text() || '';

    if (!matchName.includes(' vs ')) return;
    if (isWomensMatch(matchName)) return;

    const parts = matchName.split(' vs ');
    const t1 = parts[0].trim();
    const t2 = parts[1].split(',')[0].trim();
    const id = 'scrape_' + Buffer.from(matchName).toString('base64').substring(0, 12);
    const statusLower = statusText.toLowerCase();

    matches.push({
      id,
      team1: getShortName(t1), team1Full: t1,
      team2: getShortName(t2), team2Full: t2,
      date: new Date().toISOString().split('T')[0],
      startTime: '19:30',
      venue: 'TBA',
      status: statusLower.includes('live') ? 'live' :
              statusLower.includes('won') ? 'completed' : 'upcoming',
      winner: statusLower.includes('won') ? statusText.split(' won ')[0].trim() : null,
      tournament: 'Live Matches',
      category: categorizeMatch(matchName, 't20')
    });
  });

  if (matches.length === 0) throw new Error('Cricbuzz scrape returned 0 matches');
  console.log(`[Layer 3] Scraped ${matches.length} matches from Cricbuzz`);
  return matches;
}

// ======================== LAYER 4 ========================
// Hardcoded verified fallback
const fallbackMatches = [
  // IPL 2026 remaining league matches
  { id: 'ipl-2026-m68', team1: 'DC', team1Full: 'Delhi Capitals', team2: 'KKR', team2Full: 'Kolkata Knight Riders', date: '2026-05-08', startTime: '19:30', venue: 'Arun Jaitley Stadium, Delhi', status: 'upcoming', winner: null, tournament: 'IPL 2026', category: 'ipl' },
  { id: 'ipl-2026-m69', team1: 'RR', team1Full: 'Rajasthan Royals', team2: 'GT', team2Full: 'Gujarat Titans', date: '2026-05-09', startTime: '19:30', venue: 'Sawai Mansingh Stadium, Jaipur', status: 'upcoming', winner: null, tournament: 'IPL 2026', category: 'ipl' },
  { id: 'ipl-2026-m70a', team1: 'CSK', team1Full: 'Chennai Super Kings', team2: 'LSG', team2Full: 'Lucknow Super Giants', date: '2026-05-10', startTime: '15:30', venue: 'MA Chidambaram Stadium, Chennai', status: 'upcoming', winner: null, tournament: 'IPL 2026', category: 'ipl' },
  { id: 'ipl-2026-m70b', team1: 'RCB', team1Full: 'Royal Challengers Bengaluru', team2: 'MI', team2Full: 'Mumbai Indians', date: '2026-05-10', startTime: '19:30', venue: 'SVNS International Cricket Stadium, Raipur', status: 'upcoming', winner: null, tournament: 'IPL 2026', category: 'ipl' },
  { id: 'ipl-2026-m71', team1: 'PBKS', team1Full: 'Punjab Kings', team2: 'DC', team2Full: 'Delhi Capitals', date: '2026-05-11', startTime: '19:30', venue: 'HPCA Stadium, Dharamshala', status: 'upcoming', winner: null, tournament: 'IPL 2026', category: 'ipl' },
  { id: 'ipl-2026-m72', team1: 'GT', team1Full: 'Gujarat Titans', team2: 'SRH', team2Full: 'Sunrisers Hyderabad', date: '2026-05-12', startTime: '19:30', venue: 'Narendra Modi Stadium, Ahmedabad', status: 'upcoming', winner: null, tournament: 'IPL 2026', category: 'ipl' },
  { id: 'ipl-2026-m73', team1: 'RCB', team1Full: 'Royal Challengers Bengaluru', team2: 'KKR', team2Full: 'Kolkata Knight Riders', date: '2026-05-13', startTime: '19:30', venue: 'SVNS International Cricket Stadium, Raipur', status: 'upcoming', winner: null, tournament: 'IPL 2026', category: 'ipl' },
  { id: 'ipl-2026-m74', team1: 'PBKS', team1Full: 'Punjab Kings', team2: 'MI', team2Full: 'Mumbai Indians', date: '2026-05-14', startTime: '19:30', venue: 'HPCA Stadium, Dharamshala', status: 'upcoming', winner: null, tournament: 'IPL 2026', category: 'ipl' },
  { id: 'ipl-2026-m75', team1: 'LSG', team1Full: 'Lucknow Super Giants', team2: 'CSK', team2Full: 'Chennai Super Kings', date: '2026-05-15', startTime: '19:30', venue: 'Ekana Cricket Stadium, Lucknow', status: 'upcoming', winner: null, tournament: 'IPL 2026', category: 'ipl' },
  { id: 'ipl-2026-m76', team1: 'KKR', team1Full: 'Kolkata Knight Riders', team2: 'MI', team2Full: 'Mumbai Indians', date: '2026-05-20', startTime: '19:30', venue: 'Eden Gardens, Kolkata', status: 'upcoming', winner: null, tournament: 'IPL 2026', category: 'ipl' },
  { id: 'ipl-2026-m77', team1: 'MI', team1Full: 'Mumbai Indians', team2: 'RR', team2Full: 'Rajasthan Royals', date: '2026-05-24', startTime: '19:30', venue: 'Wankhede Stadium, Mumbai', status: 'upcoming', winner: null, tournament: 'IPL 2026', category: 'ipl' },
  // IPL Playoffs
  { id: 'ipl-2026-q1', team1: 'TBD', team1Full: 'Qualifier 1 - Team 1', team2: 'TBD', team2Full: 'Qualifier 1 - Team 2', date: '2026-05-26', startTime: '19:30', venue: 'HPCA Stadium, Dharamshala', status: 'upcoming', winner: null, tournament: 'IPL 2026 - Qualifier 1', category: 'ipl' },
  { id: 'ipl-2026-elim', team1: 'TBD', team1Full: 'Eliminator - Team 1', team2: 'TBD', team2Full: 'Eliminator - Team 2', date: '2026-05-27', startTime: '19:30', venue: 'New International Cricket Stadium, New Chandigarh', status: 'upcoming', winner: null, tournament: 'IPL 2026 - Eliminator', category: 'ipl' },
  { id: 'ipl-2026-q2', team1: 'TBD', team1Full: 'Qualifier 2 - Team 1', team2: 'TBD', team2Full: 'Qualifier 2 - Team 2', date: '2026-05-29', startTime: '19:30', venue: 'New International Cricket Stadium, New Chandigarh', status: 'upcoming', winner: null, tournament: 'IPL 2026 - Qualifier 2', category: 'ipl' },
  { id: 'ipl-2026-final', team1: 'TBD', team1Full: 'IPL Final - Team 1', team2: 'TBD', team2Full: 'IPL Final - Team 2', date: '2026-05-31', startTime: '19:30', venue: 'Narendra Modi Stadium, Ahmedabad', status: 'upcoming', winner: null, tournament: 'IPL 2026 - FINAL', category: 'ipl' },
  // ICC T20 World Cup 2026 (Completed)
  { id: 'icc-t20wc-sf1', team1: 'NZ', team1Full: 'New Zealand', team2: 'SA', team2Full: 'South Africa', date: '2026-03-04', startTime: '19:30', venue: 'Eden Gardens, Kolkata', status: 'completed', winner: 'New Zealand', tournament: 'T20 World Cup 2026 - Semi Final 1', category: 'icc-t20' },
  { id: 'icc-t20wc-sf2', team1: 'IND', team1Full: 'India', team2: 'ENG', team2Full: 'England', date: '2026-03-05', startTime: '19:30', venue: 'Wankhede Stadium, Mumbai', status: 'completed', winner: 'India', tournament: 'T20 World Cup 2026 - Semi Final 2', category: 'icc-t20' },
  { id: 'icc-t20wc-final', team1: 'IND', team1Full: 'India', team2: 'NZ', team2Full: 'New Zealand', date: '2026-03-08', startTime: '19:30', venue: 'Narendra Modi Stadium, Ahmedabad', status: 'completed', winner: 'India', tournament: 'T20 World Cup 2026 - FINAL 🏆', category: 'icc-t20' },
  // India Tour of England 2026 (T20I)
  { id: 'eng-t20-1', team1: 'ENG', team1Full: 'England', team2: 'IND', team2Full: 'India', date: '2026-07-01', startTime: '20:00', venue: 'Riverside Ground, Chester-le-Street', status: 'upcoming', winner: null, tournament: 'India Tour of England - 1st T20I', category: 'icc-t20' },
  { id: 'eng-t20-2', team1: 'ENG', team1Full: 'England', team2: 'IND', team2Full: 'India', date: '2026-07-04', startTime: '20:00', venue: 'Old Trafford, Manchester', status: 'upcoming', winner: null, tournament: 'India Tour of England - 2nd T20I', category: 'icc-t20' },
  { id: 'eng-t20-3', team1: 'ENG', team1Full: 'England', team2: 'IND', team2Full: 'India', date: '2026-07-07', startTime: '20:00', venue: 'Trent Bridge, Nottingham', status: 'upcoming', winner: null, tournament: 'India Tour of England - 3rd T20I', category: 'icc-t20' },
  { id: 'eng-t20-4', team1: 'ENG', team1Full: 'England', team2: 'IND', team2Full: 'India', date: '2026-07-09', startTime: '20:00', venue: 'County Ground, Bristol', status: 'upcoming', winner: null, tournament: 'India Tour of England - 4th T20I', category: 'icc-t20' },
  { id: 'eng-t20-5', team1: 'ENG', team1Full: 'England', team2: 'IND', team2Full: 'India', date: '2026-07-11', startTime: '20:00', venue: 'Rose Bowl, Southampton', status: 'upcoming', winner: null, tournament: 'India Tour of England - 5th T20I', category: 'icc-t20' },
  // India Tour of England 2026 (ODI)
  { id: 'eng-odi-1', team1: 'ENG', team1Full: 'England', team2: 'IND', team2Full: 'India', date: '2026-07-14', startTime: '18:00', venue: 'Edgbaston, Birmingham', status: 'upcoming', winner: null, tournament: 'India Tour of England - 1st ODI', category: 'icc-odi' },
  { id: 'eng-odi-2', team1: 'ENG', team1Full: 'England', team2: 'IND', team2Full: 'India', date: '2026-07-16', startTime: '18:00', venue: 'TBA', status: 'upcoming', winner: null, tournament: 'India Tour of England - 2nd ODI', category: 'icc-odi' },
  { id: 'eng-odi-3', team1: 'ENG', team1Full: 'England', team2: 'IND', team2Full: 'India', date: '2026-07-19', startTime: '18:00', venue: 'TBA', status: 'upcoming', winner: null, tournament: 'India Tour of England - 3rd ODI', category: 'icc-odi' },
  // Pakistan tour of Bangladesh 2026 (Test)
  { id: 'ban-pak-test1', team1: 'BAN', team1Full: 'Bangladesh', team2: 'PAK', team2Full: 'Pakistan', date: '2026-05-08', startTime: '09:00', venue: 'Shere Bangla National Stadium, Dhaka', status: 'upcoming', winner: null, tournament: 'Pakistan Tour of Bangladesh - 1st Test', category: 'icc-test' },
  // Australia tour of Pakistan 2026 (ODI)
  { id: 'pak-aus-odi1', team1: 'PAK', team1Full: 'Pakistan', team2: 'AUS', team2Full: 'Australia', date: '2026-05-30', startTime: '17:00', venue: 'Rawalpindi Cricket Stadium', status: 'upcoming', winner: null, tournament: 'Australia Tour of Pakistan - 1st ODI', category: 'icc-odi' },
  { id: 'pak-aus-odi2', team1: 'PAK', team1Full: 'Pakistan', team2: 'AUS', team2Full: 'Australia', date: '2026-06-02', startTime: '17:00', venue: 'Gaddafi Stadium, Lahore', status: 'upcoming', winner: null, tournament: 'Australia Tour of Pakistan - 2nd ODI', category: 'icc-odi' },
  { id: 'pak-aus-odi3', team1: 'PAK', team1Full: 'Pakistan', team2: 'AUS', team2Full: 'Australia', date: '2026-06-04', startTime: '17:00', venue: 'Gaddafi Stadium, Lahore', status: 'upcoming', winner: null, tournament: 'Australia Tour of Pakistan - 3rd ODI', category: 'icc-odi' },
];

// ======================== ORCHESTRATOR ========================
// Deduplicates by match ID, preferring API data over fallback
function deduplicateMatches(matchArrays) {
  const map = new Map();
  // Process in order: later arrays override earlier ones
  for (const matches of matchArrays) {
    for (const m of matches) {
      if (!m || !m.id) continue;
      const existing = map.get(m.id);
      // API data (live/completed) overrides fallback "upcoming"
      if (!existing || (m.status !== 'upcoming' && existing.status === 'upcoming')) {
        map.set(m.id, m);
      } else if (!existing.winner && m.winner) {
        map.set(m.id, m);
      }
    }
  }
  return Array.from(map.values());
}

export const fetchAllMatches = async () => {
  const apiKey = process.env.CRIC_API_KEY;
  const layers = [];
  const errors = [];

  // Always start with fallback as the base layer
  layers.push(fallbackMatches);
  console.log(`[Layer 4] Loaded ${fallbackMatches.length} fallback matches as base`);

  // Layer 3: Cricbuzz scraping
  try {
    const scraped = await scrapeCricbuzz();
    layers.push(scraped);
  } catch (err) {
    errors.push(`[Layer 3 Cricbuzz] ${err.message}`);
  }

  if (apiKey) {
    // Layer 2: Scheduled matches
    try {
      const scheduled = await fetchScheduledMatches(apiKey, 2);
      if (scheduled.length > 0) layers.push(scheduled);
    } catch (err) {
      errors.push(`[Layer 2 /matches] ${err.message}`);
    }

    // Layer 1: Current/live matches (highest priority)
    try {
      const current = await fetchCurrentMatches(apiKey);
      if (current.length > 0) layers.push(current);
    } catch (err) {
      errors.push(`[Layer 1 /currentMatches] ${err.message}`);
    }
  } else {
    errors.push('[API] No CRIC_API_KEY set, skipping API layers');
  }

  if (errors.length > 0) {
    console.warn('⚠️ Some fetch layers failed:', errors.join(' | '));
  }

  const merged = deduplicateMatches(layers);
  console.log(`✅ Total unique matches after merge: ${merged.length}`);
  return merged;
};

// ======================== UPDATE JOB ========================
export const updateMatchesJob = async () => {
  try {
    const db = getDb();
    const fetchedMatches = await fetchAllMatches();

    const upsertMatch = db.prepare(`
      INSERT INTO matches (id, team1, team1Full, team2, team2Full, date, startTime, status, winner, tournament, venue, category)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET 
        status=excluded.status, 
        winner=excluded.winner,
        venue=CASE WHEN excluded.venue != 'TBA' THEN excluded.venue ELSE matches.venue END
    `);

    const getVotes = db.prepare('SELECT * FROM votes WHERE matchId = ?');
    const addPoint = db.prepare('UPDATE users SET points = points + 1 WHERE id = ?');
    const deleteVote = db.prepare('DELETE FROM votes WHERE matchId = ? AND userId = ?');

    for (const match of fetchedMatches) {
      upsertMatch.run(match.id, match.team1, match.team1Full, match.team2, match.team2Full, match.date, match.startTime, match.status, match.winner, match.tournament, match.venue || 'TBA', match.category || 'ipl');

      if (match.status === 'completed' && match.winner) {
        const votes = getVotes.all(match.id);
        for (const vote of votes) {
          if (vote.team.toLowerCase() === match.winner.toLowerCase() ||
              match.winner.toLowerCase().includes(vote.team.toLowerCase())) {
            addPoint.run(vote.userId);
            deleteVote.run(match.id, vote.userId);
          }
        }
      }
    }

    console.log(`🔄 Match update job complete. ${fetchedMatches.length} matches processed.`);
  } catch (err) {
    console.error('Match Update Job Failed:', err);
  }
};

// Keep backward compat
export { fetchAllMatches as fetchMatchesFromAPI };
