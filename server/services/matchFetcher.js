import axios from 'axios';
import * as cheerio from 'cheerio';
import { Match, User, Vote } from '../db.js';

// ============================================================
// MULTI-LAYER MATCH FETCHER ENGINE (Future-Proof)
// Layer 1: CricAPI /currentMatches (live/recent) — highest priority
// Layer 2: CricAPI /matches with pagination (upcoming schedule)
// Layer 3a: Cricbuzz live scores scraper
// Layer 3b: Cricbuzz schedule scraper (international + league)
// Layer 4: Hardcoded IPL fallback — safety net, lowest priority
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

/**
 * Determine the match format type: 't20', 'odi', or 'test'
 * Used for voting window calculations.
 */
function getMatchFormat(name, matchType, category) {
  const mt = (matchType || '').toLowerCase();
  if (mt === 'test') return 'test';
  if (mt === 'odi') return 'odi';
  if (mt === 't20' || mt === 't20i') return 't20';

  // Infer from category
  if (category === 'ipl') return 't20';
  if (category === 'icc-t20') return 't20';
  if (category === 'icc-odi') return 'odi';
  if (category === 'icc-test') return 'test';

  // Infer from name
  const n = (name || '').toLowerCase();
  if (n.includes('t20') || n.includes('ipl')) return 't20';
  if (n.includes('odi')) return 'odi';
  if (n.includes('test')) return 'test';
  return 't20'; // default
}

/**
 * Determine if a venue is in India.
 * Used to decide between India voting window vs abroad voting window.
 */
const INDIA_CITIES = [
  'mumbai', 'delhi', 'kolkata', 'chennai', 'bengaluru', 'bangalore',
  'hyderabad', 'ahmedabad', 'jaipur', 'lucknow', 'mohali', 'chandigarh',
  'pune', 'indore', 'dharamshala', 'thiruvananthapuram', 'trivandrum',
  'nagpur', 'rajkot', 'cuttack', 'guwahati', 'visakhapatnam', 'vizag',
  'ranchi', 'raipur', 'kanpur', 'wankhede', 'eden gardens', 'chinnaswamy',
  'chidambaram', 'feroz shah', 'arun jaitley', 'narendra modi', 'ekana',
  'hpca', 'sawai mansingh', 'brabourne', 'svns', 'new chandigarh',
  'india', 'uppal',
];

function isIndianVenue(venue) {
  if (!venue || venue === 'TBA') return true; // Default to India if unknown
  const v = venue.toLowerCase();
  return INDIA_CITIES.some(city => v.includes(city));
}

function mapApiMatch(m) {
  const name = m.name || '';
  if (isWomensMatch(name)) return null;

  const team1Full = m.teams?.[0] || 'TBD';
  const team2Full = m.teams?.[1] || 'TBD';
  const category = categorizeMatch(name, m.matchType);
  const venue = m.venue || 'TBA';

  return {
    id: m.id,
    team1: m.teamInfo?.[0]?.shortname || getShortName(team1Full),
    team1Full,
    team2: m.teamInfo?.[1]?.shortname || getShortName(team2Full),
    team2Full,
    date: m.date,
    startTime: m.dateTimeGMT ? new Date(m.dateTimeGMT).toISOString().substring(11, 16) : '19:30',
    venue,
    status: m.matchStarted ? (m.matchEnded ? 'completed' : 'live') : 'upcoming',
    winner: m.matchEnded ? (m.status || null) : null,
    tournament: name,
    category,
    matchType: getMatchFormat(name, m.matchType, category),
    isAbroad: !isIndianVenue(venue)
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
async function fetchScheduledMatches(apiKey, maxPages = 4) {
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
    if (all.length >= (data.info?.totalRows || 0)) break;
  }
  return all.map(mapApiMatch).filter(Boolean);
}

// ======================== LAYER 3a ========================
// Cricbuzz LIVE scores scraper (existing)
async function scrapeCricbuzzLive() {
  console.log('[Layer 3a] Scraping Cricbuzz live scores...');
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
    const category = categorizeMatch(matchName, 't20');
    const venue = 'TBA';

    matches.push({
      id, team1: getShortName(t1), team1Full: t1,
      team2: getShortName(t2), team2Full: t2,
      date: new Date().toISOString().split('T')[0], startTime: '19:30', venue,
      status: statusLower.includes('live') ? 'live' : statusLower.includes('won') ? 'completed' : 'upcoming',
      winner: statusLower.includes('won') ? statusText.split(' won ')[0].trim() : null,
      tournament: 'Live Matches', category,
      matchType: getMatchFormat(matchName, 't20', category),
      isAbroad: !isIndianVenue(venue)
    });
  });

  if (matches.length === 0) throw new Error('Cricbuzz live scrape returned 0 matches');
  console.log(`[Layer 3a] Scraped ${matches.length} live matches from Cricbuzz`);
  return matches;
}

// ======================== LAYER 3b ========================
// Cricbuzz SCHEDULE scraper — upcoming matches from schedule pages
// Scrapes international + league schedule pages for future-proof match data
const CB_SCHEDULE_URLS = [
  'https://www.cricbuzz.com/cricket-schedule/upcoming-series/international',
  'https://www.cricbuzz.com/cricket-schedule/upcoming-series/league',
];
const CB_HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };

/**
 * Parse match type from a match description string like "1st T20I", "3rd ODI", "51st Match", "1st Test"
 */
function parseMatchTypeFromDesc(desc) {
  const d = (desc || '').toLowerCase();
  if (d.includes('test')) return 'test';
  if (d.includes('odi')) return 'odi';
  // T20I, T20, or numbered "Match" (league matches are T20)
  return 't20';
}

/**
 * Parse the Cricbuzz schedule page HTML and extract upcoming matches.
 * The schedule page has date-grouped sections with match cards containing:
 *   - Series/tournament name
 *   - Match description (e.g. "51st Match • Delhi, Arun Jaitley Stadium")
 *   - Team names
 *   - Link with match ID
 */
async function scrapeCricbuzzSchedule() {
  console.log('[Layer 3b] Scraping Cricbuzz schedule pages...');
  const allMatches = [];

  for (const url of CB_SCHEDULE_URLS) {
    try {
      const { data } = await axios.get(url, { ...AXIOS_OPTS, headers: CB_HEADERS });
      const $ = cheerio.load(data);
      let currentDate = null;

      // The schedule page has date headers (h2/div with date text) followed by match entries
      // Process all elements in the schedule container
      const scheduleContainer = $('div.cb-col-100');

      // Find date headers - they look like "FRI, MAY 08 2026"
      $('div.cb-lv-grn-strip, div.cb-sch-hdr-grn').each((i, dateEl) => {
        const dateText = $(dateEl).text().trim();
        // Parse date like "FRI, MAY 08 2026" or "SAT, MAY 09 2026"
        const dateMatch = dateText.match(/\w+,\s+(\w+)\s+(\d+)\s+(\d{4})/);
        if (dateMatch) {
          const months = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
            JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' };
          const mon = months[dateMatch[1].toUpperCase()] || '01';
          const day = dateMatch[2].padStart(2, '0');
          currentDate = `${dateMatch[3]}-${mon}-${day}`;
        }
      });

      // Find all match entries - each has a link to the match page
      $('a[href*="/live-cricket-scores/"]').each((i, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim();

        // Extract match ID from href like /live-cricket-scores/152064/dc-vs-kkr-...
        const idMatch = href.match(/\/live-cricket-scores\/(\d+)\//);
        if (!idMatch) return;

        const matchId = 'cb_' + idMatch[1];

        // Skip if we already have this match
        if (allMatches.find(m => m.id === matchId)) return;

        // Try to extract teams from the URL slug: dc-vs-kkr-51st-match-...
        const slugMatch = href.match(/\/(\w[\w-]*)-vs-([\w-]+?)(?:-\d+\w+-match|-\d+\w+-t20i|-\d+\w+-odi|-\d+\w+-test|-semi-final|-final|-qualifier|-eliminator)/i);

        // Try to extract venue and match desc from text
        // Text patterns: "51st Match • Delhi, Arun Jaitley Stadium..." or "Delhi Capitals vs Kolkata Knight Riders, 51st Match..."
        let venue = 'TBA';
        let matchDesc = '';
        let seriesName = '';
        let team1Full = '', team2Full = '';

        // Pattern 1: "Nth Match • City, Venue TeamA TeamB"
        const bulletMatch = text.match(/^(.+?)•\s*(.+)/);
        if (bulletMatch) {
          matchDesc = bulletMatch[1].trim();
          const venueAndTeams = bulletMatch[2].trim();
          // venue is usually "City, Stadium Name"
          const venueParts = venueAndTeams.split(/(?=[A-Z][a-z]+ (?:Super|Knight|Capitals|Indians|Challengers|Royals|Kings|Titans|Giants|Hyderabad|Riders))/);
          if (venueParts.length > 0) venue = venueParts[0].trim();
        }

        // Pattern 2: "TeamA vs TeamB, Nth Match VenueCity, VenueName"
        const vsMatch = text.match(/^(.+?)\s+vs\s+(.+?)(?:,\s*(.+))?$/);
        if (vsMatch) {
          team1Full = vsMatch[1].trim();
          // Clean up team2 (may have match desc appended)
          let t2raw = vsMatch[2].trim();
          const descSplit = t2raw.match(/^(.+?)(?:\d+\w+ (?:Match|T20I|ODI|Test))/);
          if (descSplit) {
            team2Full = descSplit[1].trim().replace(/,\s*$/, '');
          } else {
            team2Full = t2raw.split(',')[0].trim();
          }
        }

        // Try extracting teams from the URL slug if not found
        if (!team1Full && slugMatch) {
          const slug1 = slugMatch[1].replace(/-/g, ' ');
          const slug2 = slugMatch[2].replace(/-/g, ' ');
          team1Full = slug1; team2Full = slug2;
        }

        if (!team1Full || !team2Full) return;
        if (isWomensMatch(text) || isWomensMatch(href)) return;

        // Detect match type from description
        const matchType = parseMatchTypeFromDesc(matchDesc || text || href);

        // Try to get series name from parent structure
        const parentSeries = $(el).closest('div').prevAll('a[href*="/cricket-series/"]').first().text().trim();
        seriesName = parentSeries || matchDesc || 'Upcoming';

        const category = categorizeMatch(seriesName + ' ' + matchDesc, matchType);

        // Extract date from closest date header, or use the parsed currentDate
        // Try parsing date from the surrounding context
        let matchDate = currentDate || new Date().toISOString().split('T')[0];

        // Try to find date from parent date header
        const parentDateDiv = $(el).closest('.cb-col-100').prevAll('.cb-lv-grn-strip, .cb-sch-hdr-grn').first();
        if (parentDateDiv.length) {
          const dText = parentDateDiv.text().trim();
          const dm = dText.match(/\w+,\s+(\w+)\s+(\d+)\s+(\d{4})/);
          if (dm) {
            const months = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
              JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' };
            matchDate = `${dm[3]}-${months[dm[1].toUpperCase()] || '01'}-${dm[2].padStart(2, '0')}`;
          }
        }

        allMatches.push({
          id: matchId,
          team1: getShortName(team1Full),
          team1Full,
          team2: getShortName(team2Full),
          team2Full,
          date: matchDate,
          startTime: '19:30', // Default; overridden by API if available
          venue,
          status: 'upcoming',
          winner: null,
          tournament: seriesName,
          category,
          matchType,
          isAbroad: !isIndianVenue(venue)
        });
      });
    } catch (err) {
      console.warn(`[Layer 3b] Failed to scrape ${url}: ${err.message}`);
    }
  }

  if (allMatches.length === 0) throw new Error('Cricbuzz schedule scrape returned 0 matches');
  console.log(`[Layer 3b] Scraped ${allMatches.length} upcoming matches from Cricbuzz schedule`);
  return allMatches;
}

// ======================== LAYER 4 ========================
// Hardcoded verified fallback (IPL safety net)
const fallbackMatches = [
  // IPL 2026 remaining league matches
  { id: 'ipl-2026-m68', team1: 'DC', team1Full: 'Delhi Capitals', team2: 'KKR', team2Full: 'Kolkata Knight Riders', date: '2026-05-08', startTime: '19:30', venue: 'Arun Jaitley Stadium, Delhi', status: 'upcoming', winner: null, tournament: 'IPL 2026', category: 'ipl', matchType: 't20', isAbroad: false },
  { id: 'ipl-2026-m69', team1: 'RR', team1Full: 'Rajasthan Royals', team2: 'GT', team2Full: 'Gujarat Titans', date: '2026-05-09', startTime: '19:30', venue: 'Sawai Mansingh Stadium, Jaipur', status: 'upcoming', winner: null, tournament: 'IPL 2026', category: 'ipl', matchType: 't20', isAbroad: false },
  { id: 'ipl-2026-m70a', team1: 'CSK', team1Full: 'Chennai Super Kings', team2: 'LSG', team2Full: 'Lucknow Super Giants', date: '2026-05-10', startTime: '15:30', venue: 'MA Chidambaram Stadium, Chennai', status: 'upcoming', winner: null, tournament: 'IPL 2026', category: 'ipl', matchType: 't20', isAbroad: false },
  { id: 'ipl-2026-m70b', team1: 'RCB', team1Full: 'Royal Challengers Bengaluru', team2: 'MI', team2Full: 'Mumbai Indians', date: '2026-05-10', startTime: '19:30', venue: 'SVNS International Cricket Stadium, Raipur', status: 'upcoming', winner: null, tournament: 'IPL 2026', category: 'ipl', matchType: 't20', isAbroad: false },
  { id: 'ipl-2026-m71', team1: 'PBKS', team1Full: 'Punjab Kings', team2: 'DC', team2Full: 'Delhi Capitals', date: '2026-05-11', startTime: '19:30', venue: 'HPCA Stadium, Dharamshala', status: 'upcoming', winner: null, tournament: 'IPL 2026', category: 'ipl', matchType: 't20', isAbroad: false },
  { id: 'ipl-2026-m72', team1: 'GT', team1Full: 'Gujarat Titans', team2: 'SRH', team2Full: 'Sunrisers Hyderabad', date: '2026-05-12', startTime: '19:30', venue: 'Narendra Modi Stadium, Ahmedabad', status: 'upcoming', winner: null, tournament: 'IPL 2026', category: 'ipl', matchType: 't20', isAbroad: false },
  { id: 'ipl-2026-m73', team1: 'RCB', team1Full: 'Royal Challengers Bengaluru', team2: 'KKR', team2Full: 'Kolkata Knight Riders', date: '2026-05-13', startTime: '19:30', venue: 'SVNS International Cricket Stadium, Raipur', status: 'upcoming', winner: null, tournament: 'IPL 2026', category: 'ipl', matchType: 't20', isAbroad: false },
  { id: 'ipl-2026-m74', team1: 'PBKS', team1Full: 'Punjab Kings', team2: 'MI', team2Full: 'Mumbai Indians', date: '2026-05-14', startTime: '19:30', venue: 'HPCA Stadium, Dharamshala', status: 'upcoming', winner: null, tournament: 'IPL 2026', category: 'ipl', matchType: 't20', isAbroad: false },
  { id: 'ipl-2026-m75', team1: 'LSG', team1Full: 'Lucknow Super Giants', team2: 'CSK', team2Full: 'Chennai Super Kings', date: '2026-05-15', startTime: '19:30', venue: 'Ekana Cricket Stadium, Lucknow', status: 'upcoming', winner: null, tournament: 'IPL 2026', category: 'ipl', matchType: 't20', isAbroad: false },
  { id: 'ipl-2026-m76', team1: 'KKR', team1Full: 'Kolkata Knight Riders', team2: 'MI', team2Full: 'Mumbai Indians', date: '2026-05-20', startTime: '19:30', venue: 'Eden Gardens, Kolkata', status: 'upcoming', winner: null, tournament: 'IPL 2026', category: 'ipl', matchType: 't20', isAbroad: false },
  { id: 'ipl-2026-m77', team1: 'MI', team1Full: 'Mumbai Indians', team2: 'RR', team2Full: 'Rajasthan Royals', date: '2026-05-24', startTime: '19:30', venue: 'Wankhede Stadium, Mumbai', status: 'upcoming', winner: null, tournament: 'IPL 2026', category: 'ipl', matchType: 't20', isAbroad: false },
  // IPL Playoffs
  { id: 'ipl-2026-q1', team1: 'TBD', team1Full: 'Qualifier 1 - Team 1', team2: 'TBD', team2Full: 'Qualifier 1 - Team 2', date: '2026-05-26', startTime: '19:30', venue: 'HPCA Stadium, Dharamshala', status: 'upcoming', winner: null, tournament: 'IPL 2026 - Qualifier 1', category: 'ipl', matchType: 't20', isAbroad: false },
  { id: 'ipl-2026-elim', team1: 'TBD', team1Full: 'Eliminator - Team 1', team2: 'TBD', team2Full: 'Eliminator - Team 2', date: '2026-05-27', startTime: '19:30', venue: 'New International Cricket Stadium, New Chandigarh', status: 'upcoming', winner: null, tournament: 'IPL 2026 - Eliminator', category: 'ipl', matchType: 't20', isAbroad: false },
  { id: 'ipl-2026-q2', team1: 'TBD', team1Full: 'Qualifier 2 - Team 1', team2: 'TBD', team2Full: 'Qualifier 2 - Team 2', date: '2026-05-29', startTime: '19:30', venue: 'New International Cricket Stadium, New Chandigarh', status: 'upcoming', winner: null, tournament: 'IPL 2026 - Qualifier 2', category: 'ipl', matchType: 't20', isAbroad: false },
  { id: 'ipl-2026-final', team1: 'TBD', team1Full: 'IPL Final - Team 1', team2: 'TBD', team2Full: 'IPL Final - Team 2', date: '2026-05-31', startTime: '19:30', venue: 'Narendra Modi Stadium, Ahmedabad', status: 'upcoming', winner: null, tournament: 'IPL 2026 - FINAL', category: 'ipl', matchType: 't20', isAbroad: false },
  // ICC T20 World Cup 2026 (Completed)
  { id: 'icc-t20wc-sf1', team1: 'NZ', team1Full: 'New Zealand', team2: 'SA', team2Full: 'South Africa', date: '2026-03-04', startTime: '19:30', venue: 'Eden Gardens, Kolkata', status: 'completed', winner: 'New Zealand', tournament: 'T20 World Cup 2026 - Semi Final 1', category: 'icc-t20', matchType: 't20', isAbroad: false },
  { id: 'icc-t20wc-sf2', team1: 'IND', team1Full: 'India', team2: 'ENG', team2Full: 'England', date: '2026-03-05', startTime: '19:30', venue: 'Wankhede Stadium, Mumbai', status: 'completed', winner: 'India', tournament: 'T20 World Cup 2026 - Semi Final 2', category: 'icc-t20', matchType: 't20', isAbroad: false },
  { id: 'icc-t20wc-final', team1: 'IND', team1Full: 'India', team2: 'NZ', team2Full: 'New Zealand', date: '2026-03-08', startTime: '19:30', venue: 'Narendra Modi Stadium, Ahmedabad', status: 'completed', winner: 'India', tournament: 'T20 World Cup 2026 - FINAL 🏆', category: 'icc-t20', matchType: 't20', isAbroad: false },
  // India Tour of England 2026 (T20I)
  { id: 'eng-t20-1', team1: 'ENG', team1Full: 'England', team2: 'IND', team2Full: 'India', date: '2026-07-01', startTime: '20:00', venue: 'Riverside Ground, Chester-le-Street', status: 'upcoming', winner: null, tournament: 'India Tour of England - 1st T20I', category: 'icc-t20', matchType: 't20', isAbroad: true },
  { id: 'eng-t20-2', team1: 'ENG', team1Full: 'England', team2: 'IND', team2Full: 'India', date: '2026-07-04', startTime: '20:00', venue: 'Old Trafford, Manchester', status: 'upcoming', winner: null, tournament: 'India Tour of England - 2nd T20I', category: 'icc-t20', matchType: 't20', isAbroad: true },
  { id: 'eng-t20-3', team1: 'ENG', team1Full: 'England', team2: 'IND', team2Full: 'India', date: '2026-07-07', startTime: '20:00', venue: 'Trent Bridge, Nottingham', status: 'upcoming', winner: null, tournament: 'India Tour of England - 3rd T20I', category: 'icc-t20', matchType: 't20', isAbroad: true },
  { id: 'eng-t20-4', team1: 'ENG', team1Full: 'England', team2: 'IND', team2Full: 'India', date: '2026-07-09', startTime: '20:00', venue: 'County Ground, Bristol', status: 'upcoming', winner: null, tournament: 'India Tour of England - 4th T20I', category: 'icc-t20', matchType: 't20', isAbroad: true },
  { id: 'eng-t20-5', team1: 'ENG', team1Full: 'England', team2: 'IND', team2Full: 'India', date: '2026-07-11', startTime: '20:00', venue: 'Rose Bowl, Southampton', status: 'upcoming', winner: null, tournament: 'India Tour of England - 5th T20I', category: 'icc-t20', matchType: 't20', isAbroad: true },
  // India Tour of England 2026 (ODI)
  { id: 'eng-odi-1', team1: 'ENG', team1Full: 'England', team2: 'IND', team2Full: 'India', date: '2026-07-14', startTime: '18:00', venue: 'Edgbaston, Birmingham', status: 'upcoming', winner: null, tournament: 'India Tour of England - 1st ODI', category: 'icc-odi', matchType: 'odi', isAbroad: true },
  { id: 'eng-odi-2', team1: 'ENG', team1Full: 'England', team2: 'IND', team2Full: 'India', date: '2026-07-16', startTime: '18:00', venue: 'TBA', status: 'upcoming', winner: null, tournament: 'India Tour of England - 2nd ODI', category: 'icc-odi', matchType: 'odi', isAbroad: true },
  { id: 'eng-odi-3', team1: 'ENG', team1Full: 'England', team2: 'IND', team2Full: 'India', date: '2026-07-19', startTime: '18:00', venue: 'TBA', status: 'upcoming', winner: null, tournament: 'India Tour of England - 3rd ODI', category: 'icc-odi', matchType: 'odi', isAbroad: true },
  // Pakistan tour of Bangladesh 2026 (Test)
  { id: 'ban-pak-test1', team1: 'BAN', team1Full: 'Bangladesh', team2: 'PAK', team2Full: 'Pakistan', date: '2026-05-08', startTime: '09:00', venue: 'Shere Bangla National Stadium, Dhaka', status: 'upcoming', winner: null, tournament: 'Pakistan Tour of Bangladesh - 1st Test', category: 'icc-test', matchType: 'test', isAbroad: true },
  // Australia tour of Pakistan 2026 (ODI)
  { id: 'pak-aus-odi1', team1: 'PAK', team1Full: 'Pakistan', team2: 'AUS', team2Full: 'Australia', date: '2026-05-30', startTime: '17:00', venue: 'Rawalpindi Cricket Stadium', status: 'upcoming', winner: null, tournament: 'Australia Tour of Pakistan - 1st ODI', category: 'icc-odi', matchType: 'odi', isAbroad: true },
  { id: 'pak-aus-odi2', team1: 'PAK', team1Full: 'Pakistan', team2: 'AUS', team2Full: 'Australia', date: '2026-06-02', startTime: '17:00', venue: 'Gaddafi Stadium, Lahore', status: 'upcoming', winner: null, tournament: 'Australia Tour of Pakistan - 2nd ODI', category: 'icc-odi', matchType: 'odi', isAbroad: true },
  { id: 'pak-aus-odi3', team1: 'PAK', team1Full: 'Pakistan', team2: 'AUS', team2Full: 'Australia', date: '2026-06-04', startTime: '17:00', venue: 'Gaddafi Stadium, Lahore', status: 'upcoming', winner: null, tournament: 'Australia Tour of Pakistan - 3rd ODI', category: 'icc-odi', matchType: 'odi', isAbroad: true },
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

  // Layer 4 (lowest priority): Hardcoded IPL fallback
  layers.push(fallbackMatches);
  console.log(`[Layer 4] Loaded ${fallbackMatches.length} fallback matches as base`);

  // Layer 3b: Cricbuzz schedule scraping (upcoming matches)
  try {
    const scheduled = await scrapeCricbuzzSchedule();
    layers.push(scheduled);
  } catch (err) {
    errors.push(`[Layer 3b Cricbuzz Schedule] ${err.message}`);
  }

  // Layer 3a: Cricbuzz live scores scraping
  try {
    const live = await scrapeCricbuzzLive();
    layers.push(live);
  } catch (err) {
    errors.push(`[Layer 3a Cricbuzz Live] ${err.message}`);
  }

  if (apiKey) {
    // Layer 2: CricAPI scheduled matches (4 pages = ~100 matches)
    try {
      const scheduled = await fetchScheduledMatches(apiKey, 4);
      if (scheduled.length > 0) layers.push(scheduled);
    } catch (err) {
      errors.push(`[Layer 2 /matches] ${err.message}`);
    }

    // Layer 1: CricAPI current/live matches (highest priority)
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
    const fetchedMatches = await fetchAllMatches();

    for (const match of fetchedMatches) {
      // Find existing match to preserve its venue if new one is TBA
      const existing = await Match.findOne({ id: match.id });
      const finalVenue = match.venue === 'TBA' && existing ? existing.venue : (match.venue || 'TBA');

      await Match.findOneAndUpdate(
        { id: match.id },
        {
          team1: match.team1,
          team1Full: match.team1Full,
          team2: match.team2,
          team2Full: match.team2Full,
          date: match.date,
          startTime: match.startTime,
          status: match.status,
          winner: match.winner,
          tournament: match.tournament,
          venue: finalVenue,
          category: match.category || 'ipl',
          matchType: match.matchType || 't20',
          isAbroad: match.isAbroad ? true : false
        },
        { upsert: true }
      );

      if (match.status === 'completed' && match.winner) {
        const votes = await Vote.find({ matchId: match.id, pointsAwarded: { $ne: true } });
        for (const vote of votes) {
          if (vote.team.toLowerCase() === match.winner.toLowerCase() ||
              match.winner.toLowerCase().includes(vote.team.toLowerCase())) {
            await User.findOneAndUpdate({ id: vote.userId }, { $inc: { points: 1 } });
          }
          await Vote.findOneAndUpdate({ _id: vote._id }, { pointsAwarded: true });
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
