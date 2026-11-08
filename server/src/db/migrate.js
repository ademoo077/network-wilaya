import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';

const dir = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(dir, 'migrations');

export function appliedVersions(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`);
  return db.prepare('SELECT version, name, applied_at FROM schema_migrations ORDER BY version').all();
}

export function runMigrations(db, { logger = console } = {}) {
  appliedVersions(db);
  const files = fs.readdirSync(migrationsDir).filter((f) => /^\d+.*\.sql$/i.test(f)).sort();
  const done = new Set(db.prepare('SELECT version FROM schema_migrations').all().map((r) => r.version));
  for (const file of files) {
    const version = Number.parseInt(file, 10);
    if (done.has(version)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations(version, name) VALUES (?, ?)').run(version, file);
      db.exec('COMMIT');
      logger.info?.(`Migration appliquée : ${file}`);
    } catch (error) {
      db.exec('ROLLBACK');
      throw new Error(`Migration ${file} échouée : ${error.message}`);
    }
  }
}

export function countTaxonomy(db) {
  return {
    domaines: db.prepare('SELECT COUNT(*) AS c FROM domaines').get().c,
    types: db.prepare('SELECT COUNT(*) AS c FROM types_anomalie').get().c,
  };
}

/** Import idempotent de la taxonomie : ne remplace ni name_fr ni actif. */
export function importTaxonomy(db, csvPath) {
  const raw = fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '');
  const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: false,
    relax_column_count: false,
  });
  const domaines = new Map();
  for (const row of rows) {
    if (!domaines.has(row.domaine_ar)) domaines.set(row.domaine_ar, Number(row.ordre_domaine));
  }
  const upsertDomaine = db.prepare(`
    INSERT INTO domaines(name_ar, ordre, actif) VALUES (?, ?, 1)
    ON CONFLICT(name_ar) DO UPDATE SET ordre = excluded.ordre, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
  `);
  const findDomaine = db.prepare('SELECT id FROM domaines WHERE name_ar = ?');
  const upsertType = db.prepare(`
    INSERT INTO types_anomalie(domaine_id, name_ar, ordre, actif) VALUES (?, ?, ?, 1)
    ON CONFLICT(domaine_id, name_ar) DO UPDATE SET ordre = excluded.ordre, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
  `);
  const tx = db.transaction(() => {
    for (const [nameAr, ordre] of domaines) upsertDomaine.run(nameAr, Number.isFinite(ordre) ? ordre : 0);
    for (const row of rows) {
      const domaine = findDomaine.get(row.domaine_ar);
      if (!domaine) continue;
      const ordreType = Number(row.ordre_type);
      upsertType.run(domaine.id, row.type_ar, Number.isFinite(ordreType) ? ordreType : 0);
    }
  });
  tx();
  return countTaxonomy(db);
}

export function ensureTaxonomy(db, csvPath, { logger = console } = {}) {
  const counts = countTaxonomy(db);
  if (counts.domaines > 0) return { imported: false, ...counts };
  if (!fs.existsSync(csvPath)) throw new Error(`Taxonomie introuvable : ${csvPath}`);
  const result = importTaxonomy(db, csvPath);
  logger.info?.(`Taxonomie importée : ${result.domaines} catégories / ${result.types} types`);
  return { imported: true, ...result };
}

/** Seed V5 idempotent : n'écrase jamais un groupe ou rattachement modifié. */
export function ensureDomainGroups(db, csvPath, { logger = console } = {}) {
  if (!fs.existsSync(csvPath)) throw new Error(`Groupes thématiques introuvables : ${csvPath}`);
  const raw = fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '');
  const rows = parse(raw, { columns: true, skip_empty_lines: true, trim: false });
  const groups = new Map();
  for (const row of rows) {
    const key = row.groupe_fr;
    if (!groups.has(key)) groups.set(key, {
      ordre: Number(row.ordre_groupe), name_fr: row.groupe_fr, name_ar: row.groupe_ar, domains: [],
    });
    groups.get(key).domains.push(row.domaine_ar);
  }
  const findGroup = db.prepare('SELECT id FROM groupes_domaines WHERE name_fr = ?');
  const findAssigned = db.prepare(`SELECT groupe_id FROM domaines
    WHERE name_ar IN (SELECT value FROM json_each(?)) AND groupe_id IS NOT NULL LIMIT 1`);
  const insertGroup = db.prepare('INSERT INTO groupes_domaines(name_fr, name_ar, ordre) VALUES (?, ?, ?)');
  const attach = db.prepare('UPDATE domaines SET groupe_id = ? WHERE name_ar = ? AND groupe_id IS NULL');
  db.transaction(() => {
    for (const group of groups.values()) {
      const assigned = findAssigned.get(JSON.stringify(group.domains));
      let id = assigned?.groupe_id || findGroup.get(group.name_fr)?.id;
      if (!id) id = insertGroup.run(group.name_fr, group.name_ar || null, group.ordre).lastInsertRowid;
      for (const domainName of group.domains) attach.run(id, domainName);
    }
  })();
  const result = {
    groupes: db.prepare('SELECT COUNT(*) AS c FROM groupes_domaines').get().c,
    rattaches: db.prepare('SELECT COUNT(*) AS c FROM domaines WHERE groupe_id IS NOT NULL').get().c,
    nonRattaches: db.prepare('SELECT name_ar FROM domaines WHERE groupe_id IS NULL ORDER BY ordre').all(),
  };
  logger.info?.(`Groupes V5 : ${result.groupes} groupes / ${result.rattaches} catégories rattachées`);
  return result;
}
