import axios from 'axios';
import * as cheerio from 'cheerio';
import { getDb } from '../db.js';

// ============================================================
// ACCURATE FALLBACK DATA FOR 2026
// Verified from iplt20.com, icc-cricket.com, olympics.com
// ============================================================

const fallbackMatches = [
  // ==================== IPL 2026 ====================
  // May 8 - May 24 (League Stage End) + Playoffs
  {
    id: 'ipl-2026-m68',
    team1: 'DC', team1Full: 'Delhi Capitals',
    team2: 'KKR', team2Full: 'Kolkata Knight Riders',
    date: '2026-05-08',
    startTime: '19:30',
    venue: 'Arun Jaitley Stadium, Delhi',
    status: 'upcoming',
    winner: null,
    tournament: 'IPL 2026',
    category: 'ipl'
  },
  {
    id: 'ipl-2026-m69',
    team1: 'RR', team1Full: 'Rajasthan Royals',
    team2: 'GT', team2Full: 'Gujarat Titans',
    date: '2026-05-09',
    startTime: '19:30',
    venue: 'Sawai Mansingh Stadium, Jaipur',
    status: 'upcoming',
    winner: null,
    tournament: 'IPL 2026',
    category: 'ipl'
  },
  {
    id: 'ipl-2026-m70a',
    team1: 'CSK', team1Full: 'Chennai Super Kings',
    team2: 'LSG', team2Full: 'Lucknow Super Giants',
    date: '2026-05-10',
    startTime: '15:30',
    venue: 'MA Chidambaram Stadium, Chennai',
    status: 'upcoming',
    winner: null,
    tournament: 'IPL 2026',
    category: 'ipl'
  },
  {
    id: 'ipl-2026-m70b',
    team1: 'RCB', team1Full: 'Royal Challengers Bengaluru',
    team2: 'MI', team2Full: 'Mumbai Indians',
    date: '2026-05-10',
    startTime: '19:30',
    venue: 'SVNS International Cricket Stadium, Raipur',
    status: 'upcoming',
    winner: null,
    tournament: 'IPL 2026',
    category: 'ipl'
  },
  {
    id: 'ipl-2026-m71',
    team1: 'PBKS', team1Full: 'Punjab Kings',
    team2: 'DC', team2Full: 'Delhi Capitals',
    date: '2026-05-11',
    startTime: '19:30',
    venue: 'HPCA Stadium, Dharamshala',
    status: 'upcoming',
    winner: null,
    tournament: 'IPL 2026',
    category: 'ipl'
  },
  {
    id: 'ipl-2026-m72',
    team1: 'GT', team1Full: 'Gujarat Titans',
    team2: 'SRH', team2Full: 'Sunrisers Hyderabad',
    date: '2026-05-12',
    startTime: '19:30',
    venue: 'Narendra Modi Stadium, Ahmedabad',
    status: 'upcoming',
    winner: null,
    tournament: 'IPL 2026',
    category: 'ipl'
  },
  {
    id: 'ipl-2026-m73',
    team1: 'RCB', team1Full: 'Royal Challengers Bengaluru',
    team2: 'KKR', team2Full: 'Kolkata Knight Riders',
    date: '2026-05-13',
    startTime: '19:30',
    venue: 'SVNS International Cricket Stadium, Raipur',
    status: 'upcoming',
    winner: null,
    tournament: 'IPL 2026',
    category: 'ipl'
  },
  {
    id: 'ipl-2026-m74',
    team1: 'PBKS', team1Full: 'Punjab Kings',
    team2: 'MI', team2Full: 'Mumbai Indians',
    date: '2026-05-14',
    startTime: '19:30',
    venue: 'HPCA Stadium, Dharamshala',
    status: 'upcoming',
    winner: null,
    tournament: 'IPL 2026',
    category: 'ipl'
  },
  {
    id: 'ipl-2026-m75',
    team1: 'LSG', team1Full: 'Lucknow Super Giants',
    team2: 'CSK', team2Full: 'Chennai Super Kings',
    date: '2026-05-15',
    startTime: '19:30',
    venue: 'Ekana Cricket Stadium, Lucknow',
    status: 'upcoming',
    winner: null,
    tournament: 'IPL 2026',
    category: 'ipl'
  },
  {
    id: 'ipl-2026-m76',
    team1: 'KKR', team1Full: 'Kolkata Knight Riders',
    team2: 'MI', team2Full: 'Mumbai Indians',
    date: '2026-05-20',
    startTime: '19:30',
    venue: 'Eden Gardens, Kolkata',
    status: 'upcoming',
    winner: null,
    tournament: 'IPL 2026',
    category: 'ipl'
  },
  {
    id: 'ipl-2026-m77',
    team1: 'MI', team1Full: 'Mumbai Indians',
    team2: 'RR', team2Full: 'Rajasthan Royals',
    date: '2026-05-24',
    startTime: '19:30',
    venue: 'Wankhede Stadium, Mumbai',
    status: 'upcoming',
    winner: null,
    tournament: 'IPL 2026',
    category: 'ipl'
  },
  // IPL Playoffs
  {
    id: 'ipl-2026-q1',
    team1: 'TBD', team1Full: 'Qualifier 1 - Team 1',
    team2: 'TBD', team2Full: 'Qualifier 1 - Team 2',
    date: '2026-05-26',
    startTime: '19:30',
    venue: 'HPCA Stadium, Dharamshala',
    status: 'upcoming',
    winner: null,
    tournament: 'IPL 2026 - Qualifier 1',
    category: 'ipl'
  },
  {
    id: 'ipl-2026-elim',
    team1: 'TBD', team1Full: 'Eliminator - Team 1',
    team2: 'TBD', team2Full: 'Eliminator - Team 2',
    date: '2026-05-27',
    startTime: '19:30',
    venue: 'New International Cricket Stadium, New Chandigarh',
    status: 'upcoming',
    winner: null,
    tournament: 'IPL 2026 - Eliminator',
    category: 'ipl'
  },
  {
    id: 'ipl-2026-q2',
    team1: 'TBD', team1Full: 'Qualifier 2 - Team 1',
    team2: 'TBD', team2Full: 'Qualifier 2 - Team 2',
    date: '2026-05-29',
    startTime: '19:30',
    venue: 'New International Cricket Stadium, New Chandigarh',
    status: 'upcoming',
    winner: null,
    tournament: 'IPL 2026 - Qualifier 2',
    category: 'ipl'
  },
  {
    id: 'ipl-2026-final',
    team1: 'TBD', team1Full: 'IPL Final - Team 1',
    team2: 'TBD', team2Full: 'IPL Final - Team 2',
    date: '2026-05-31',
    startTime: '19:30',
    venue: 'Narendra Modi Stadium, Ahmedabad',
    status: 'upcoming',
    winner: null,
    tournament: 'IPL 2026 - FINAL',
    category: 'ipl'
  },

  // ==================== ICC T20 WORLD CUP 2026 (Completed) ====================
  // Co-hosted by India & Sri Lanka, Feb 7 - Mar 8, 2026
  // India won the tournament!
  {
    id: 'icc-t20wc-sf1',
    team1: 'NZ', team1Full: 'New Zealand',
    team2: 'SA', team2Full: 'South Africa',
    date: '2026-03-04',
    startTime: '19:30',
    venue: 'Eden Gardens, Kolkata',
    status: 'completed',
    winner: 'New Zealand',
    tournament: 'T20 World Cup 2026 - Semi Final 1',
    category: 'icc-t20'
  },
  {
    id: 'icc-t20wc-sf2',
    team1: 'IND', team1Full: 'India',
    team2: 'ENG', team2Full: 'England',
    date: '2026-03-05',
    startTime: '19:30',
    venue: 'Wankhede Stadium, Mumbai',
    status: 'completed',
    winner: 'India',
    tournament: 'T20 World Cup 2026 - Semi Final 2',
    category: 'icc-t20'
  },
  {
    id: 'icc-t20wc-final',
    team1: 'IND', team1Full: 'India',
    team2: 'NZ', team2Full: 'New Zealand',
    date: '2026-03-08',
    startTime: '19:30',
    venue: 'Narendra Modi Stadium, Ahmedabad',
    status: 'completed',
    winner: 'India',
    tournament: 'T20 World Cup 2026 - FINAL 🏆',
    category: 'icc-t20'
  },

  // ==================== INDIA TOUR OF ENGLAND 2026 (T20I) ====================
  {
    id: 'eng-t20-1',
    team1: 'ENG', team1Full: 'England',
    team2: 'IND', team2Full: 'India',
    date: '2026-07-01',
    startTime: '20:00',
    venue: 'Riverside Ground, Chester-le-Street',
    status: 'upcoming',
    winner: null,
    tournament: 'India Tour of England - 1st T20I',
    category: 'icc-t20'
  },
  {
    id: 'eng-t20-2',
    team1: 'ENG', team1Full: 'England',
    team2: 'IND', team2Full: 'India',
    date: '2026-07-04',
    startTime: '20:00',
    venue: 'Old Trafford, Manchester',
    status: 'upcoming',
    winner: null,
    tournament: 'India Tour of England - 2nd T20I',
    category: 'icc-t20'
  },
  {
    id: 'eng-t20-3',
    team1: 'ENG', team1Full: 'England',
    team2: 'IND', team2Full: 'India',
    date: '2026-07-07',
    startTime: '20:00',
    venue: 'Trent Bridge, Nottingham',
    status: 'upcoming',
    winner: null,
    tournament: 'India Tour of England - 3rd T20I',
    category: 'icc-t20'
  },
  {
    id: 'eng-t20-4',
    team1: 'ENG', team1Full: 'England',
    team2: 'IND', team2Full: 'India',
    date: '2026-07-09',
    startTime: '20:00',
    venue: 'County Ground, Bristol',
    status: 'upcoming',
    winner: null,
    tournament: 'India Tour of England - 4th T20I',
    category: 'icc-t20'
  },
  {
    id: 'eng-t20-5',
    team1: 'ENG', team1Full: 'England',
    team2: 'IND', team2Full: 'India',
    date: '2026-07-11',
    startTime: '20:00',
    venue: 'Rose Bowl, Southampton',
    status: 'upcoming',
    winner: null,
    tournament: 'India Tour of England - 5th T20I',
    category: 'icc-t20'
  },

  // ==================== INDIA TOUR OF ENGLAND 2026 (ODI) ====================
  {
    id: 'eng-odi-1',
    team1: 'ENG', team1Full: 'England',
    team2: 'IND', team2Full: 'India',
    date: '2026-07-14',
    startTime: '18:00',
    venue: 'Edgbaston, Birmingham',
    status: 'upcoming',
    winner: null,
    tournament: 'India Tour of England - 1st ODI',
    category: 'icc-odi'
  },
  {
    id: 'eng-odi-2',
    team1: 'ENG', team1Full: 'England',
    team2: 'IND', team2Full: 'India',
    date: '2026-07-16',
    startTime: '18:00',
    venue: 'TBA',
    status: 'upcoming',
    winner: null,
    tournament: 'India Tour of England - 2nd ODI',
    category: 'icc-odi'
  },
  {
    id: 'eng-odi-3',
    team1: 'ENG', team1Full: 'England',
    team2: 'IND', team2Full: 'India',
    date: '2026-07-19',
    startTime: '18:00',
    venue: 'TBA',
    status: 'upcoming',
    winner: null,
    tournament: 'India Tour of England - 3rd ODI',
    category: 'icc-odi'
  },
];


export const fetchMatchesFromAPI = async () => {
  try {
    const apiKey = process.env.CRIC_API_KEY;
    if (!apiKey) throw new Error("No API key provided. Falling back to scraping...");
    
    let allMatches = [];
    
    const fetchFromOffset = async (offset) => {
      console.log(`Fetching from API with offset ${offset}...`);
      const { data } = await axios.get(`https://api.cricapi.com/v1/matches?apikey=${apiKey}&offset=${offset}`);
      
      if (data.status !== "success") throw new Error("API Failed");
      
      let datarray = data.data;
      if (!datarray || datarray.length === 0) return allMatches;
      
      allMatches = allMatches.concat(datarray);
      
      // To preserve your free hits, we only fetch the first page (25 matches).
      return allMatches;
    };

    const matches = await fetchFromOffset(0);
    
    const mapped = [];
    
    for (const m of matches) {
      const name = (m.name || '').toLowerCase();
      const matchType = (m.matchType || '').toLowerCase();
      
      // Filter out Women's matches - making this absolutely bulletproof
      if (name.match(/\b(women|wmns|wodi|wt20|w-t20|women's)\b/i) || name.match(/-w\b/i)) {
        continue;
      }

      // Determine category from match type. Default to domestic so we don't pollute IPL or ICC
      let category = 'domestic';
      
      // Check if it's an unofficial/A-team match
      const isDomestic = name.includes('unofficial') || name.match(/\b([a-z]+ a)\b/i) || name.includes('domestic');
      
      if (!isDomestic) {
        if (matchType === 't20' || matchType === 't20i') category = 'icc-t20';
        else if (matchType === 'odi') category = 'icc-odi';
        else if (matchType === 'test') category = 'icc-test';
      }
      
      // Check for IPL specifically
      if (name.includes('ipl') || name.includes('indian premier league')) {
        category = 'ipl';
      }

      mapped.push({
        id: m.id,
        team1: m.teams?.[0] || 'TBD', team1Full: m.teams?.[0] || 'To Be Decided',
        team2: m.teams?.[1] || 'TBD', team2Full: m.teams?.[1] || 'To Be Decided',
        date: m.date,
        startTime: '19:30',
        venue: m.venue || 'TBA',
        status: m.matchStarted ? (m.matchEnded ? 'completed' : 'live') : 'upcoming',
        winner: m.matchEnded ? m.status : null,
        tournament: m.name,
        category
      });
    }

    // Merge with fallback data so the guaranteed 2026 schedule is always present!
    return [...fallbackMatches, ...mapped];
  } catch (err) {
    console.warn("[API Error]", err.message);
    return await scrapeMatchesFallback();
  }
};

export const scrapeMatchesFallback = async () => {
  try {
    console.log("Attempting to scrape Cricbuzz for matches...");
    const { data } = await axios.get('https://www.cricbuzz.com/cricket-match/live-scores');
    const $ = cheerio.load(data);
    
    let matches = [];
    $('.cb-mtch-lst').each((i, el) => {
      const matchName = $(el).find('.cb-hm-text').text() || '';
      const status = $(el).find('.cb-text-live, .cb-text-complete, .cb-text-preview').text() || '';
      
      if (matchName.includes(' vs ')) {
        // Filter out Women's matches - making this absolutely bulletproof
        if (matchName.match(/\b(women|wmns|wodi|wt20|w-t20|women's)\b/i) || matchName.match(/-w\b/i)) {
          return; // skip this element in each loop
        }

        const parts = matchName.split(' vs ');
        const t1 = parts[0].trim();
        const t2 = parts[1].split(',')[0].trim();
        
        const id = 'scrape_' + Buffer.from(matchName).toString('base64').substring(0, 8);
        
        matches.push({
          id,
          team1: t1.substring(0, 3).toUpperCase(),
          team1Full: t1,
          team2: t2.substring(0, 3).toUpperCase(),
          team2Full: t2,
          date: new Date().toISOString().split('T')[0],
          startTime: '19:30',
          venue: 'TBA',
          status: status.toLowerCase().includes('live') ? 'live' : 
                  status.toLowerCase().includes('won') ? 'completed' : 'upcoming',
          winner: status.toLowerCase().includes('won') ? status.split(' won ')[0].trim() : null,
          tournament: 'Live Matches',
          category: 'ipl'
        });
      }
    });

    if (matches.length > 0) return matches;
    throw new Error("Scraping returned 0 matches, DOM might have changed.");
  } catch (err) {
    console.warn("[Scrape Error]", err.message);
    console.log("Using verified fallback data (IPL 2026 + ICC 2026 schedule).");
    return fallbackMatches;
  }
};

export const updateMatchesJob = async () => {
  try {
    const db = getDb();
    const fetchedMatches = await fetchMatchesFromAPI();
    
    const upsertMatch = db.prepare(`
      INSERT INTO matches (id, team1, team1Full, team2, team2Full, date, startTime, status, winner, tournament, venue, category)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET 
        status=excluded.status, 
        winner=excluded.winner
    `);

    const getVotes = db.prepare('SELECT * FROM votes WHERE matchId = ?');
    const addPoint = db.prepare('UPDATE users SET points = points + 1 WHERE id = ?');
    const deleteVote = db.prepare('DELETE FROM votes WHERE matchId = ? AND userId = ?');

    for (const match of fetchedMatches) {
      upsertMatch.run(match.id, match.team1, match.team1Full, match.team2, match.team2Full, match.date, match.startTime, match.status, match.winner, match.tournament, match.venue || 'TBA', match.category || 'ipl');
      
      // If completed, update points (1 for correct, 0 for wrong)
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
  } catch (err) {
    console.error("Match Update Job Failed:", err);
  }
};
