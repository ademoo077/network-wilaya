import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from '../config/index.js';

let db = null;

export function getDb() {
  if (!db) {
    fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
    db = new Database(config.dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

export function reopenDb() {
  closeDb();
  return getDb();
}

export function backupDatabase(targetPath) {
  const out = new Database(targetPath);
  getDb().backup(out);
  out.close();
}

export function getDatabaseFilePath() {
  return config.dbPath;
}

export default getDb();
