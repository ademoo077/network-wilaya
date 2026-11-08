import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { TZ_ALGER } from '@anm/shared';
import { closeDb as closeCurrentDb, getDb as openCurrentDb } from '../db/index.js';

const NAME_RE = /^anomalies-(\d{8})-(\d{6})-(manuelle|auto|securite)\.db$/;

export function stamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_ALGER, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(date).reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  return `${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}${parts.second}`;
}

export function backupName(type = 'manuelle', date = new Date()) {
  return `anomalies-${stamp(date)}-${type}.db`;
}

export async function createBackup(db, backupDir, type = 'manuelle', date = new Date()) {
  fs.mkdirSync(backupDir, { recursive: true });
  let name = backupName(type, date);
  let target = path.join(backupDir, name);
  let suffix = 1;
  while (fs.existsSync(target)) {
    name = `anomalies-${stamp(date)}-${type}-${suffix}.db`;
    target = path.join(backupDir, name);
    suffix += 1;
  }
  await db.backup(target);
  const stat = fs.statSync(target);
  return { nom: path.basename(target), nom_fichier: path.basename(target), taille: stat.size, type, date: stat.mtime.toISOString() };
}

export function parseBackupName(name) {
  const m = NAME_RE.exec(name);
  if (!m) return null;
  return { nom: name, dateCompact: m[1], type: m[3] };
}

export function listBackups(backupDir) {
  if (!fs.existsSync(backupDir)) return [];
  return fs.readdirSync(backupDir)
    .filter((name) => NAME_RE.test(name))
    .map((name) => {
      const stat = fs.statSync(path.join(backupDir, name));
      const meta = parseBackupName(name);
      return {
        nom: name,
        taille: stat.size,
        type: meta.type,
        date: stat.mtime.toISOString(),
        dateCompact: meta.dateCompact,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function hasAutoBackupToday(backupDir, date = new Date()) {
  const prefix = `anomalies-${stamp(date).slice(0, 8)}-`;
  return listBackups(backupDir).some((b) => b.nom.startsWith(prefix) && b.type === 'auto');
}

export async function ensureDailyBackup(db, backupDir, date = new Date()) {
  if (hasAutoBackupToday(backupDir, date)) return null;
  return createBackup(db, backupDir, 'auto', date);
}

export function applyRetention(backupDir, retentionDays = 30, now = new Date()) {
  const files = listBackups(backupDir);
  const protectedLatest = new Set(files.slice(0, 7).map((f) => f.nom));
  const securite = files.filter((f) => f.type === 'securite');
  const protectedSecurity = new Set(securite.slice(0, 10).map((f) => f.nom));
  const cutoff = now.getTime() - retentionDays * 86400000;
  const deleted = [];
  for (const file of files) {
    if (protectedLatest.has(file.nom) || protectedSecurity.has(file.nom)) continue;
    if (new Date(file.date).getTime() < cutoff) {
      try {
        fs.unlinkSync(path.join(backupDir, file.nom));
        deleted.push(file.nom);
      } catch { /* ignore */ }
    }
  }
  return deleted;
}

export function checkBackupFile(filePath, currentVersion) {
  if (!fs.existsSync(filePath)) return { ok: false, errors: ['Fichier introuvable'] };
  let db;
  try {
    db = new Database(filePath, { readonly: true });
    const integrity = db.prepare('PRAGMA integrity_check').get();
    const value = integrity ? Object.values(integrity)[0] : 'inconnu';
    if (value !== 'ok') return { ok: false, errors: [`Integrité : ${value}`] };
    const hasMigrations = db.prepare("SELECT COUNT(*) AS c FROM sqlite_master WHERE type='table' AND name='schema_migrations'").get().c > 0;
    let version = 0;
    if (hasMigrations) {
      const row = db.prepare('SELECT MAX(version) AS v FROM schema_migrations').get();
      version = row?.v || 0;
    }
    if (version > currentVersion) return { ok: false, errors: ['Sauvegarde plus récente que le schéma courant'] };
    return { ok: true, version, errors: [] };
  } catch (error) {
    return { ok: false, errors: [error.message] };
  } finally {
    try { db?.close(); } catch { /* ignore */ }
  }
}

export function requireBackupName(name) {
  return typeof name === 'string' && NAME_RE.test(name) ? name : null;
}

export function schemaVersion(db) {
  try {
    return db.prepare('SELECT MAX(version) AS v FROM schema_migrations').get()?.v || 0;
  } catch {
    return 0;
  }
}

/** Restaure une sauvegarde avec sauvegarde de sécurité et rollback automatique. */
export async function restoreBackup(db, { backupDir, dbPath, name, migrate }) {
  const safeName = requireBackupName(name);
  if (!safeName) throw new Error('Nom de sauvegarde invalide');
  const source = path.join(backupDir, safeName);
  if (!fs.existsSync(source)) throw new Error('Sauvegarde introuvable');
  const check = checkBackupFile(source, schemaVersion(db));
  if (!check.ok) throw new Error(`Sauvegarde invalide : ${check.errors.join(' · ')}`);

  const safety = await createBackup(db, backupDir, 'securite');
  const safetyPath = path.join(backupDir, safety.nom);
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
    closeCurrentDb();
    fs.copyFileSync(source, dbPath);
    removeSidecars(dbPath);
    const reopened = openCurrentDb();
    migrate?.(reopened);
    const integrity = reopened.pragma('integrity_check', { simple: true });
    if (String(integrity).toLowerCase() !== 'ok') throw new Error(`Intégrité après restauration : ${integrity}`);
    return { nom: safeName, securite: safety.nom };
  } catch (error) {
    try {
      closeCurrentDb();
      fs.copyFileSync(safetyPath, dbPath);
      removeSidecars(dbPath);
      const reopened = openCurrentDb();
      migrate?.(reopened);
    } catch {
      // le rollback est journalisé par l'appelant
    }
    throw error;
  }
}

function removeSidecars(dbPath) {
  for (const suffix of ['-wal', '-shm']) {
    try { fs.unlinkSync(`${dbPath}${suffix}`); } catch { /* absent */ }
  }
}

