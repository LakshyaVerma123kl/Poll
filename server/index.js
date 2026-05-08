import express from 'express';
import cors from 'cors';
import { initDb, getDb } from './db.js';
import { updateMatchesJob } from './services/matchFetcher.js';
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
    
    const db = getDb();
    const clientIp = getClientIp(req);
    
    // Check if this IP already has a registered user
    const existingByIp = db.prepare('SELECT * FROM users WHERE ip = ?').get(clientIp);
    
    // If user exists by name, allow re-login from any IP but update their IP
    let user = db.prepare('SELECT * FROM users WHERE name COLLATE NOCASE = ?').get(name);
    
    if (user) {
      // User exists — allow re-login, update IP
      db.prepare('UPDATE users SET ip = ? WHERE id = ?').run(clientIp, user.id);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
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
    db.prepare('INSERT INTO users (id, name, points, avatar, ip) VALUES (?, ?, 0, ?, ?)').run(id, name, avatar, clientIp);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const db = getDb();
    // Don't expose IP addresses to clients
    const users = db.prepare('SELECT id, name, points, avatar FROM users ORDER BY points DESC').all();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
});

app.get('/api/matches', async (req, res) => {
  try {
    const db = getDb();
    const matches = db.prepare('SELECT * FROM matches').all();
    
    // Fetch user votes if user id is passed
    const userId = req.query.userId;
    let userVotes = [];
    if (userId) {
      userVotes = db.prepare('SELECT matchId, team FROM votes WHERE userId = ?').all(userId);
    }

    res.json({
      matches,
      votes: userVotes.reduce((acc, v) => ({ ...acc, [v.matchId]: v.team }), {})
    });
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
});

app.post('/api/vote', async (req, res) => {
  try {
    const { userId, matchId, team } = req.body;
    
    // Check time restriction
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    
    // We allow voting for demo purposes, but log the true logic:
    // const isTimeValid = (hour === 19) || (hour === 20 && minute <= 15);
    // if (!isTimeValid) return res.status(403).json({ error: "Voting is only allowed between 7 PM and 8:15 PM" });
    
    const db = getDb();
    const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId);
    if (match && match.status !== 'upcoming') {
      return res.status(400).json({ error: "Cannot vote on this match anymore" });
    }

    db.prepare('INSERT INTO votes (matchId, userId, team) VALUES (?, ?, ?) ON CONFLICT(matchId, userId) DO UPDATE SET team=excluded.team').run(matchId, userId, team);
    
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
    const db = getDb();
    db.prepare('UPDATE matches SET status = "completed", winner = ? WHERE id = ?').run(winner, matchId);
    
    // Award points
    const votes = db.prepare('SELECT * FROM votes WHERE matchId = ?').all(matchId);
    for (const vote of votes) {
      if (vote.team === winner) {
        db.prepare('UPDATE users SET points = points + 1 WHERE id = ?').run(vote.userId);
        db.prepare('DELETE FROM votes WHERE matchId = ? AND userId = ?').run(matchId, vote.userId);
      }
    }
    
    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// Catch-all route to serve React app for non-API requests in production
// Express 5 requires named splat params instead of bare '*'
if (process.env.NODE_ENV === 'production') {
  app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  // Initialize DB (loads WASM) and fetch matches on startup
  await initDb();
  await updateMatchesJob();
  
  // Set up polling interval every 5 minutes to fetch matches
  setInterval(updateMatchesJob, 5 * 60 * 1000);
});
