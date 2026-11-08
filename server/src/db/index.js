import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config, ensureDirs } from '../config/index.js';

let instance = null;

export function getDb() {
  if (instance) return instance;
  ensureDirs();
  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  instance = new Database(config.dbPath);
  instance.pragma('journal_mode = WAL');
  instance.pragma('foreign_keys = ON');
  instance.pragma('busy_timeout = 5000');
  instance.pragma('synchronous = NORMAL');
  return instance;
}

export function closeDb() {
  if (!instance) return;
  try { instance.pragma('wal_checkpoint(TRUNCATE)'); } catch { /* ignore */ }
  try { instance.close(); } catch { /* ignore */ }
  instance = null;
}

export function setDbForTests(db) {
  instance = db;
}

export function dbFile() {
  return config.dbPath;
}
