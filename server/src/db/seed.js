import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { config } from '../config/index.js';
import db from './database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TAXONOMY_PATH = path.resolve(__dirname, '../../../taxonomie_anomalies.csv');

function parseTaxonomyLines(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const rows = [];
  for (const line of lines.slice(1)) {
    const parts = line.split(',').map((s) => s.trim());
    rows.push({
      ordreDomaine: Number(parts[0]),
      domaineAr: parts[1],
      ordreType: parts[2] ? Number(parts[2]) : null,
      typeAr: parts[3] || null,
    });
  }
  return rows;
}

export function seedTaxonomy() {
  const text = readFileSync(TAXONOMY_PATH, 'utf8');
  const rows = parseTaxonomyLines(text);

  const insertDomaine = db.prepare('INSERT OR IGNORE INTO domaines (name_ar, name_fr, ordre, actif) VALUES (?, ?, ?, 1)');
  const insertType = db.prepare('INSERT OR IGNORE INTO types_anomalie (domaine_id, name_ar, name_fr, ordre, actif) VALUES (?, ?, ?, ?, 1)');
  const selectDomaineId = db.prepare('SELECT id FROM domaines WHERE name_ar = ?');

  const seenTypes = new Set();
  let insertedTypes = 0;

  for (const row of rows) {
    const found = selectDomaineId.get(row.domaineAr);
    let domaineId = found ? found.id : undefined;
    if (!domaineId) {
      const info = insertDomaine.run(row.domaineAr, null, row.ordreDomaine);
      domaineId = Number(info.lastInsertRowid);
    }
    const key = domaineId + '::' + row.typeAr;
    if (seenTypes.has(key)) continue;
    seenTypes.add(key);
    const exists = db.prepare('SELECT id FROM types_anomalie WHERE domaine_id = ? AND name_ar = ?').get(domaineId, row.typeAr);
    if (!exists) {
      insertType.run(domaineId, row.typeAr, null, row.ordreType);
      insertedTypes += 1;
    }
  }

  const countDomaines = db.prepare('SELECT COUNT(*) AS c FROM domaines').get();
  const countTypes = db.prepare('SELECT COUNT(*) AS c FROM types_anomalie').get();

  return { domaines: countDomaines.c, types: countTypes.c, insertedTypes };
}

export function ensureSeedUsers() {
  const username = config.adminUsername;
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  const now = new Date().toISOString();

  if (existing) {
    if (config.adminPassword) {
      db.prepare('UPDATE users SET password_hash = ?, must_change_password = 1, updated_at = ? WHERE username = ?').run(bcrypt.hashSync(config.adminPassword, 12), now, username);
      console.log(`[seed] Mot de passe admin mis a jour: username=${username} password=${config.adminPassword} (must_change_password=1)`);
    }
    return { created: false, updated: !!config.adminPassword };
  }

  const password = config.adminPassword || Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const hash = bcrypt.hashSync(password, 12);
  db.prepare('INSERT INTO users (username, full_name, password_hash, role, active, must_change_password, created_at, updated_at) VALUES (?, ?, ?, ?, 1, 1, ?, ?)').run(username, 'Administrateur', hash, 'admin', now, now);
  console.log(`[seed] Compte admin cree: username=${username} password=${password} (must_change_password=1)`);
  return { created: true };
}
