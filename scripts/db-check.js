import fs from 'node:fs';
import { config } from '../server/src/config/index.js';
import { getDb, closeDb } from '../server/src/db/index.js';

function count(db, table) {
  try { return db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get().c; } catch { return '—'; }
}

function main() {
  if (!fs.existsSync(config.dbPath)) {
    console.error(`Base introuvable : ${config.dbPath}`);
    process.exit(1);
  }
  const db = getDb();
  const integrity = db.pragma('integrity_check', { simple: true });
  const foreign = db.pragma('foreign_key_check');
  const migrations = db.prepare('SELECT version, name, applied_at FROM schema_migrations ORDER BY version').all();
  const counts = {
    users: count(db, 'users'), domaines: count(db, 'domaines'), types: count(db, 'types_anomalie'),
    dairas: count(db, 'dairas'), communes: count(db, 'communes'), epics: count(db, 'epics'),
    agents: count(db, 'agents'), anomalies: count(db, 'anomalies'), audit: count(db, 'audit_log'),
  };
  console.log(`Base : ${config.dbPath}`);
  console.log(`Taille : ${Math.round(fs.statSync(config.dbPath).size / 1024)} Ko`);
  console.log(`Intégrité : ${integrity}`);
  console.log(`Clés étrangères : ${foreign.length ? `${foreign.length} anomalie(s)` : 'OK'}`);
  console.log(`Migrations : ${migrations.map((m) => `${m.version} (${m.name})`).join(', ') || 'aucune'}`);
  console.log('Contenu :', counts);
  console.log(`Taxonomie 70/156 : ${counts.domaines === 70 && counts.types === 156 ? 'OK' : 'NON CONFORME'}`);
  closeDb();
  if (String(integrity).toLowerCase() !== 'ok' || foreign.length) process.exit(1);
}

main();
