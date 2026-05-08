import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let wrapper = null;

/**
 * Thin wrapper around sql.js to provide a convenient API
 * similar to better-sqlite3's prepare().run/get/all pattern.
 * Also handles auto-persistence to disk.
 */
class DbWrapper {
  constructor(db, dbPath) {
    this._db = db;
    this._dbPath = dbPath;
  }

  /** Save the in-memory database to disk */
  _save() {
    const data = this._db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this._dbPath, buffer);
  }

  /** Execute raw SQL (DDL, multi-statement, etc.) */
  exec(sql) {
    this._db.run(sql);
    this._save();
  }

  /**
   * Returns a pseudo-prepared statement with .run(), .get(), .all() methods.
   * Each method auto-persists after mutations.
   */
  prepare(sql) {
    const self = this;
    const isMutating = /^\s*(INSERT|UPDATE|DELETE|REPLACE|DROP|CREATE|ALTER)/i.test(sql);

    return {
      run(...params) {
        self._db.run(sql, params);
        if (isMutating) self._save();
      },
      get(...params) {
        const stmt = self._db.prepare(sql);
        stmt.bind(params);
        let row = undefined;
        if (stmt.step()) {
          row = stmt.getAsObject();
        }
        stmt.free();
        return row;
      },
      all(...params) {
        const stmt = self._db.prepare(sql);
        stmt.bind(params);
        const rows = [];
        while (stmt.step()) {
          rows.push(stmt.getAsObject());
        }
        stmt.free();
        return rows;
      }
    };
  }
}

export const initDb = async () => {
  if (wrapper) return wrapper;

  const SQL = await initSqlJs();

  // Use DATA_DIR for production persistent disks, otherwise default to local server directory
  const dataDir = process.env.DATA_DIR || __dirname;
  const dbPath = path.join(dataDir, 'database.sqlite');

  let db;
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  wrapper = new DbWrapper(db, dbPath);

  if (process.env.RESET_DB === 'true') {
    console.warn("⚠️ RESET_DB is true! Dropping all tables for a fresh start...");
    wrapper.exec(`
      DROP TABLE IF EXISTS matches;
      DROP TABLE IF EXISTS users;
      DROP TABLE IF EXISTS votes;
    `);
    console.warn("⚠️ Tables dropped. Be sure to set RESET_DB to false on next startup!");
  }

  wrapper.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE,
      points INTEGER DEFAULT 0,
      avatar TEXT,
      ip TEXT
    );
  `);

  // Migration: add ip column if missing (for existing databases)
  try {
    wrapper.prepare("SELECT ip FROM users LIMIT 1").get();
  } catch (e) {
    wrapper.exec("ALTER TABLE users ADD COLUMN ip TEXT;");
    console.log("Migrated: added 'ip' column to users table.");
  }
  wrapper.exec(`
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
  `);
  wrapper.exec(`
    CREATE TABLE IF NOT EXISTS votes (
      matchId TEXT,
      userId TEXT,
      team TEXT,
      PRIMARY KEY (matchId, userId),
      FOREIGN KEY (userId) REFERENCES users (id),
      FOREIGN KEY (matchId) REFERENCES matches (id)
    );
  `);

  return wrapper;
};

export const getDb = () => {
  if (!wrapper) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return wrapper;
};
