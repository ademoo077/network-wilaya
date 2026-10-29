import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/index.js';
import { closeDb, getDb } from '../db/database.js';

export function createBackup() {
  const dir = config.backupDir;
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + String(Date.now()).slice(-6);
  const target = path.join(dir, `anomalies-${stamp}.db`);
  getDb().backup(String(target));
  return { filename: path.basename(target), path: target };
}

export function listBackups() {
  const dir = config.backupDir;
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.db'))
    .sort()
    .reverse()
    .map((filename) => ({ filename, path: path.join(dir, filename) }));
}

export function restoreBackup(filename) {
  const source = path.join(config.backupDir, filename);
  if (!fs.existsSync(source)) {
    const err = new Error('Backup introuvable');
    err.status = 404;
    throw err;
  }
  closeDb();
  fs.copyFileSync(source, config.dbPath);
  getDb();
  return { filename };
}
