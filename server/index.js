import express from 'express';
import cors from 'cors';
import { connectDb, User, Match, Vote } from './db.js';
import { updateMatchesJob, liveStatusUpdater } from './services/matchFetcher.js';
import { getAIPrediction } from './services/aiPredictor.js';
import { getIplStandings, refreshPointsTable } from './services/pointsTableScraper.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Trust proxy so req.ip works behind Render's reverse proxy
app.set('trust proxy', true);

const PORT = process.env.PORT || 3001;

/**
 * Helper: Get a normalized client IP from the request.
 * Handles X-Forwarded-For, req.ip, and local dev fallbacks.
 */
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
}

// API Endpoints

app.post('/api/login', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });
    
    const clientIp = getClientIp(req);
    
    // Check if this IP already has a registered user
    const existingByIp = await User.findOne({ ip: clientIp });
    
    // If user exists by name, allow re-login from any IP but update their IP
    let user = await User.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    
    if (user) {
      // User exists — allow re-login, update IP
      user.ip = clientIp;
      await user.save();
      res.json(user);
      return;
    }
    
    // New user — check if this IP already has an account
    if (existingByIp) {
      return res.status(403).json({ 
        error: `This device is already registered as "${existingByIp.name}". Only one account per device is allowed.`,
        existingUser: existingByIp
      });
    }
    
    // Create new user
    const id = 'u' + Date.now();
    const avatar = name.charAt(0).toUpperCase();
    user = new User({ id, name, points: 0, avatar, ip: clientIp });
    await user.save();
    
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    // Don't expose IP addresses to clients
    const users = await User.find().sort({ points: -1 }).select('id name points avatar -_id');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
});

app.get('/api/matches', async (req, res) => {
  try {
    const matches = await Match.find().select('-_id -__v');
    
    // Fetch all votes with user details using Aggregation
    const allVotes = await Vote.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: 'id',
          as: 'userInfo'
        }
      },
      {
        $unwind: '$userInfo'
      },
      {
        $project: {
          matchId: 1,
          team: 1,
          userId: 1,
          name: '$userInfo.name',
          avatar: '$userInfo.avatar'
        }
      }
    ]);
    
    // Group votes by matchId
    const groupedVotes = {};
    for (const v of allVotes) {
      if (!groupedVotes[v.matchId]) groupedVotes[v.matchId] = {};
      if (!groupedVotes[v.matchId][v.userId]) {
        groupedVotes[v.matchId][v.userId] = { team: v.team, name: v.name, avatar: v.avatar };
      }
    }

    res.json({
      matches,
      votes: groupedVotes
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
});

app.post('/api/vote', async (req, res) => {
  try {
    const { userId, matchId, team } = req.body;
    
    const match = await Match.findOne({ id: matchId });
    if (!match) return res.status(404).json({ error: "Match not found" });
    if (match.status === 'completed') {
      return res.status(400).json({ error: "Cannot vote on a completed match" });
    }
    if (match.status === 'live') {
      // For live matches, check if we're still within the over cutoff window
    }

    // ── Voting Window Calculation (all times stored as IST) ──
    const startTime = match.startTime || '19:30';

    // Build match start as IST → UTC ms using explicit +05:30 offset
    const matchStartIST = new Date(`${match.date}T${startTime.padStart(5,'0')}:00+05:30`);
    const matchStartMs = matchStartIST.getTime();

    // 1. Determine Open Time (Toss vs 7 AM)
    let voteOpenMs;
    if (match.isAbroad) {
      // 7:00 AM IST of the match day
      const sevenAmIST = new Date(`${match.date}T07:00:00+05:30`);
      voteOpenMs = sevenAmIST.getTime();
      // If match starts before 7 AM, fallback to 30 mins before
      if (matchStartMs < voteOpenMs) {
        voteOpenMs = matchStartMs - (30 * 60 * 1000);
      }
    } else {
      // India: Opens at Toss (30 mins before match)
      voteOpenMs = matchStartMs - (30 * 60 * 1000);
    }

    // 2. Determine Close Time (Format-specific duration)
    let durationMins;
    const format = match.matchType || 't20';
    if (format === 't20') {
      durationMins = 75; // 1.25 hours
    } else if (format === 'odi') {
      durationMins = 3.5 * 60; // 3.5 hours
    } else if (format === 'test') {
      durationMins = 6 * 60; // Close at end of Day 1
    } else {
      durationMins = 75;
    }

    const voteCloseMs = matchStartMs + (durationMins * 60 * 1000);
    
    let windowDesc = match.isAbroad 
      ? `7 AM IST to ${durationMins / 60} hrs after start` 
      : `Toss (30m before) to ${durationMins / 60} hrs after start`;

    // Compare in UTC ms
    const nowMs = Date.now();
    if (nowMs < voteOpenMs) {
      const openTime = new Date(voteOpenMs);
      const openTimeStr = openTime.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
      const openDateStr = openTime.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric' });
      return res.status(403).json({ error: `Voting opens at ${openTimeStr} on ${openDateStr} IST (${windowDesc})` });
    }
    if (nowMs > voteCloseMs) {
      return res.status(403).json({ error: `Voting window closed (${windowDesc})` });
    }

    // Check if vote already exists
    const existingVote = await Vote.findOne({ matchId, userId });
    if (existingVote) {
      return res.status(403).json({ error: "You have already voted for this match. Votes cannot be changed." });
    }

    // Insert vote
    await Vote.create({ matchId, userId, team, pointsAwarded: false });
    
    res.json({ success: true, team });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
});

// Admin endpoint for demo
app.post('/api/admin/simulate', async (req, res) => {
  try {
    const { matchId, winner } = req.body;
    
    await Match.findOneAndUpdate({ id: matchId }, { status: 'completed', winner });
    
    // Award points
    const votes = await Vote.find({ matchId, pointsAwarded: { $ne: true } });
    for (const vote of votes) {
      if (vote.team.toLowerCase() === winner.toLowerCase() || winner.toLowerCase().includes(vote.team.toLowerCase())) {
        await User.findOneAndUpdate({ id: vote.userId }, { $inc: { points: 10 } });
      }
      // Mark vote as processed so points aren't awarded again, but keep it so it shows in the UI
      await Vote.findOneAndUpdate({ _id: vote._id }, { pointsAwarded: true });
    }
    
    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// Automated points distributor for completed matches
async function awardPointsForCompletedMatches() {
  try {
    const completedMatches = await Match.find({ status: 'completed', winner: { $ne: null } });
    for (const match of completedMatches) {
      const winnerName = match.winner.toLowerCase();
      // The winner string from API is usually like "Gujarat Titans won by 77 runs"
      // Or from scraping "CSK won by..."
      
      const pendingVotes = await Vote.find({ matchId: match.id, pointsAwarded: { $ne: true } });
      if (pendingVotes.length === 0) continue;
      
      console.log(`[Points] Evaluating ${pendingVotes.length} votes for completed match: ${match.id}`);
      for (const vote of pendingVotes) {
        const votedTeam = vote.team.toLowerCase();
        
        // Ensure robust team name matching (e.g. 'CSK' in 'Chennai Super Kings won...')
        // match.team1 / team1Full vs winner
        const team1Short = (match.team1 || '').toLowerCase();
        const team2Short = (match.team2 || '').toLowerCase();
        const team1Full = (match.team1Full || '').toLowerCase();
        const team2Full = (match.team2Full || '').toLowerCase();
        
        let actualWinnerShort = null;
        if (winnerName.includes(team1Short) || winnerName.includes(team1Full)) actualWinnerShort = team1Short;
        else if (winnerName.includes(team2Short) || winnerName.includes(team2Full)) actualWinnerShort = team2Short;
        
        if (actualWinnerShort === votedTeam || winnerName.includes(votedTeam)) {
          console.log(`[Points] Awarding 10 points to user ${vote.userId} for correct prediction of ${vote.team}`);
          await User.findOneAndUpdate({ id: vote.userId }, { $inc: { points: 10 } });
        }
        await Vote.findOneAndUpdate({ _id: vote._id }, { pointsAwarded: true });
      }
    }
  } catch (err) {
    console.error('[Points] Error awarding points:', err.message);
  }
}

// Keep-alive Ping endpoint
app.get('/api/ping', (req, res) => {
  res.json({ status: 'alive', time: new Date().toISOString() });
});

// AI Prediction endpoint
const predictionCache = new Map();
app.get('/api/predict/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;
    
    // Check cache first (predictions valid for 1 hour)
    const cached = predictionCache.get(matchId);
    if (cached && Date.now() - cached.timestamp < 3600000) {
      return res.json(cached.data);
    }

    const match = await Match.findOne({ id: matchId });
    if (!match) return res.status(404).json({ error: 'Match not found' });
    if (match.status === 'completed') {
      return res.json({ winner: match.winner, confidence: 100, reason: 'Match already completed', model: 'result' });
    }

    const prediction = await getAIPrediction(match);
    if (!prediction.error) {
      predictionCache.set(matchId, { data: prediction, timestamp: Date.now() });
    }
    res.json(prediction);
  } catch (err) {
    console.error('[AI Predict]', err);
    res.status(500).json({ error: 'Prediction failed' });
  }
});

// IPL Points Table endpoint
app.get('/api/ipl-standings', async (req, res) => {
  try {
    const result = await getIplStandings();
    res.json(result);
  } catch (err) {
    console.error('[IPL Standings]', err);
    res.status(500).json({ error: 'Failed to fetch standings' });
  }
});

// Catch-all route to serve React app for non-API requests in production
if (process.env.NODE_ENV === 'production') {
  app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  
  // Connect to MongoDB
  await connectDb();
  
  // Fetch matches on startup
  await updateMatchesJob();
  
  // Set up polling interval every 45 minutes to fetch matches
  setInterval(async () => {
    await updateMatchesJob();
    await awardPointsForCompletedMatches();
  }, 45 * 60 * 1000);

  // Live status updater runs every 45 minutes
  await liveStatusUpdater();
  await awardPointsForCompletedMatches();

  // IPL Points Table — refresh on startup and every 45 minutes
  await refreshPointsTable();
  setInterval(refreshPointsTable, 45 * 60 * 1000);
  setInterval(async () => {
    await liveStatusUpdater();
    await awardPointsForCompletedMatches();
  }, 45 * 60 * 1000);

  // Self-ping every 14 minutes to help prevent Render sleep
  setInterval(() => {
    import('http').then(http => {
      http.get(`http://localhost:${PORT}/api/ping`).on('error', () => {});
    });
  }, 14 * 60 * 1000);
});
