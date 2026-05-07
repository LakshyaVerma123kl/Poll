import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dbInstance = null;

export const initDb = async () => {
  if (dbInstance) return dbInstance;

  // Use DATA_DIR for production persistent disks, otherwise default to local server directory
  const dataDir = process.env.DATA_DIR || __dirname;
  const dbPath = path.join(dataDir, 'database.sqlite');

  dbInstance = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  if (process.env.RESET_DB === 'true') {
    console.warn("⚠️ RESET_DB is true! Dropping all tables for a fresh start...");
    await dbInstance.exec(`
      DROP TABLE IF EXISTS matches;
      DROP TABLE IF EXISTS users;
      DROP TABLE IF EXISTS votes;
    `);
    console.warn("⚠️ Tables dropped. Be sure to set RESET_DB to false on next startup!");
  }

  await dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE,
      points INTEGER DEFAULT 0,
      avatar TEXT
    );

    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      team1 TEXT,
      team1Full TEXT,
      team2 TEXT,
      team2Full TEXT,
      date TEXT,
      startTime TEXT,
      status TEXT,
      winner TEXT,
      tournament TEXT,
      venue TEXT DEFAULT 'TBA',
      category TEXT DEFAULT 'ipl'
    );

    CREATE TABLE IF NOT EXISTS votes (
      matchId TEXT,
      userId TEXT,
      team TEXT,
      PRIMARY KEY (matchId, userId),
      FOREIGN KEY (userId) REFERENCES users (id),
      FOREIGN KEY (matchId) REFERENCES matches (id)
    );
  `);

  return dbInstance;
};

export const getDb = async () => {
  if (!dbInstance) {
    return await initDb();
  }
  return dbInstance;
};
