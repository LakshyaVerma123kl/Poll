import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * IPL Points Table Scraper
 * Scrapes the latest IPL standings from Cricbuzz and caches them.
 * Falls back to CricAPI if scraping fails.
 */

const CB_HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' };

// In-memory cache
let cachedStandings = null;
let lastFetchTime = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Team short name mapping
const TEAM_SHORT_MAP = {
  'chennai super kings': 'CSK',
  'mumbai indians': 'MI',
  'royal challengers bengaluru': 'RCB',
  'royal challengers bangalore': 'RCB',
  'kolkata knight riders': 'KKR',
  'sunrisers hyderabad': 'SRH',
  'delhi capitals': 'DC',
  'rajasthan royals': 'RR',
  'punjab kings': 'PBKS',
  'kings xi punjab': 'PBKS',
  'gujarat titans': 'GT',
  'lucknow super giants': 'LSG',
};

function resolveTeamShort(name) {
  const lower = (name || '').toLowerCase().trim();
  // Direct map
  if (TEAM_SHORT_MAP[lower]) return TEAM_SHORT_MAP[lower];
  // Partial match
  for (const [full, short] of Object.entries(TEAM_SHORT_MAP)) {
    if (lower.includes(full) || full.includes(lower)) return short;
  }
  // If it's already a short name (3-4 chars uppercase)
  if (/^[A-Z]{2,5}$/.test(name.trim())) return name.trim();
  return name.substring(0, 3).toUpperCase();
}

/**
 * Scrape IPL points table from Cricbuzz
 */
async function scrapeFromCricbuzz() {
  console.log('[PointsTable] Scraping Cricbuzz...');
  const { data: html } = await axios.get('https://www.cricbuzz.com/cricket-series/7607/indian-premier-league-2026/points-table', {
    timeout: 10000,
    headers: CB_HEADERS
  });
  const $ = cheerio.load(html);
  const standings = [];

  // Cricbuzz points table uses table rows
  $('table.cb-srs-pnts tbody tr, table.table tbody tr').each((i, el) => {
    const cols = $(el).find('td');
    if (cols.length < 7) return;

    const teamText = $(cols[0]).text().trim();
    if (!teamText || teamText.toLowerCase().includes('team')) return;

    const team = resolveTeamShort(teamText);
    const pld = parseInt($(cols[1]).text().trim()) || 0;
    const w = parseInt($(cols[2]).text().trim()) || 0;
    const l = parseInt($(cols[3]).text().trim()) || 0;
    // Column 4 could be T (tied) or NR
    const nrText = $(cols[4]).text().trim();
    const nr = parseInt(nrText) || 0;
    const nrr = $(cols[5]).text().trim() || '+0.000';
    const pts = parseInt($(cols[6]).text().trim()) || 0;

    if (team && pld > 0) {
      standings.push({
        rank: standings.length + 1,
        team,
        name: teamText,
        pld, w, l, nr, pts,
        nrr: nrr.startsWith('+') || nrr.startsWith('-') ? nrr : `+${nrr}`
      });
    }
  });

  if (standings.length >= 8) {
    // Sort by points desc, then NRR desc
    standings.sort((a, b) => b.pts - a.pts || parseFloat(b.nrr) - parseFloat(a.nrr));
    standings.forEach((s, i) => s.rank = i + 1);
    console.log(`[PointsTable] Cricbuzz: Got ${standings.length} teams`);
    return standings;
  }

  throw new Error(`Cricbuzz scrape returned only ${standings.length} teams`);
}

/**
 * Alternative: Scrape from ESPN Cricinfo
 */
async function scrapeFromEspn() {
  console.log('[PointsTable] Trying ESPN Cricinfo...');
  const { data: html } = await axios.get('https://www.espncricinfo.com/series/indian-premier-league-2025-1449924/points-table-standings', {
    timeout: 10000,
    headers: CB_HEADERS
  });
  const $ = cheerio.load(html);
  const standings = [];

  $('table tbody tr').each((i, el) => {
    const cols = $(el).find('td');
    if (cols.length < 6) return;

    const teamText = $(cols[0]).text().trim();
    if (!teamText) return;

    const team = resolveTeamShort(teamText);
    const pld = parseInt($(cols[1]).text().trim()) || 0;
    const w = parseInt($(cols[2]).text().trim()) || 0;
    const l = parseInt($(cols[3]).text().trim()) || 0;
    const nr = parseInt($(cols[4]).text().trim()) || 0;
    const pts = parseInt($(cols[5]).text().trim()) || 0;
    const nrr = cols.length > 6 ? $(cols[6]).text().trim() : '+0.000';

    if (team && pld > 0) {
      standings.push({
        rank: standings.length + 1,
        team,
        name: teamText,
        pld, w, l, nr, pts,
        nrr: nrr.startsWith('+') || nrr.startsWith('-') ? nrr : `+${nrr}`
      });
    }
  });

  if (standings.length >= 8) {
    standings.sort((a, b) => b.pts - a.pts || parseFloat(b.nrr) - parseFloat(a.nrr));
    standings.forEach((s, i) => s.rank = i + 1);
    console.log(`[PointsTable] ESPN: Got ${standings.length} teams`);
    return standings;
  }

  throw new Error(`ESPN scrape returned only ${standings.length} teams`);
}

/**
 * Hardcoded fallback — last known standings
 */
function getFallbackStandings() {
  return [
    { rank: 1, team: 'SRH', name: 'Sunrisers Hyderabad', pld: 11, w: 7, l: 4, nr: 0, pts: 14, nrr: '+0.737' },
    { rank: 2, team: 'PBKS', name: 'Punjab Kings', pld: 10, w: 6, l: 3, nr: 1, pts: 13, nrr: '+0.571' },
    { rank: 3, team: 'RCB', name: 'Royal Challengers Bengaluru', pld: 9, w: 6, l: 3, nr: 0, pts: 12, nrr: '+1.420' },
    { rank: 4, team: 'RR', name: 'Rajasthan Royals', pld: 10, w: 6, l: 4, nr: 0, pts: 12, nrr: '+0.510' },
    { rank: 5, team: 'GT', name: 'Gujarat Titans', pld: 10, w: 6, l: 4, nr: 0, pts: 12, nrr: '-0.147' },
    { rank: 6, team: 'CSK', name: 'Chennai Super Kings', pld: 10, w: 5, l: 5, nr: 0, pts: 10, nrr: '+0.151' },
    { rank: 7, team: 'DC', name: 'Delhi Capitals', pld: 10, w: 4, l: 6, nr: 0, pts: 8, nrr: '-0.949' },
    { rank: 8, team: 'KKR', name: 'Kolkata Knight Riders', pld: 9, w: 3, l: 5, nr: 1, pts: 7, nrr: '-0.539' },
    { rank: 9, team: 'MI', name: 'Mumbai Indians', pld: 10, w: 3, l: 7, nr: 0, pts: 6, nrr: '-0.649' },
    { rank: 10, team: 'LSG', name: 'Lucknow Super Giants', pld: 10, w: 2, l: 8, nr: 0, pts: 4, nrr: '-1.106' },
  ];
}

/**
 * Main export: Get IPL standings with multi-layer fallback and caching.
 */
export async function getIplStandings() {
  // Return cache if still valid
  if (cachedStandings && (Date.now() - lastFetchTime < CACHE_TTL)) {
    return { standings: cachedStandings, source: 'cache', updatedAt: new Date(lastFetchTime).toISOString() };
  }

  const errors = [];

  // Try Cricbuzz first
  try {
    const standings = await scrapeFromCricbuzz();
    cachedStandings = standings;
    lastFetchTime = Date.now();
    return { standings, source: 'cricbuzz', updatedAt: new Date().toISOString() };
  } catch (e) {
    errors.push(`Cricbuzz: ${e.message}`);
  }

  // Try ESPN
  try {
    const standings = await scrapeFromEspn();
    cachedStandings = standings;
    lastFetchTime = Date.now();
    return { standings, source: 'espn', updatedAt: new Date().toISOString() };
  } catch (e) {
    errors.push(`ESPN: ${e.message}`);
  }

  // Use cached data if available (even if stale)
  if (cachedStandings) {
    console.warn('[PointsTable] All scrapers failed, using stale cache:', errors.join(' | '));
    return { standings: cachedStandings, source: 'stale-cache', updatedAt: new Date(lastFetchTime).toISOString() };
  }

  // Last resort: hardcoded fallback
  console.warn('[PointsTable] All scrapers failed, using hardcoded fallback:', errors.join(' | '));
  const fallback = getFallbackStandings();
  cachedStandings = fallback;
  lastFetchTime = Date.now();
  return { standings: fallback, source: 'fallback', updatedAt: new Date().toISOString() };
}

/**
 * Periodic refresh job — call this on a timer to keep the cache warm.
 */
export async function refreshPointsTable() {
  try {
    const result = await getIplStandings();
    console.log(`[PointsTable] Refreshed from ${result.source} (${result.standings.length} teams)`);
  } catch (e) {
    console.error('[PointsTable] Refresh failed:', e.message);
  }
}
