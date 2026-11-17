import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import Database from 'better-sqlite3';
import { config } from '../server/src/config/index.js';
import { getDb, closeDb } from '../server/src/db/index.js';
import { runMigrations } from '../server/src/db/migrate.js';
import { createBackup } from '../server/src/services/backups.js';
import { audit } from '../server/src/services/audit.js';
import { importComptesSociaux, parseSocialWorkbook, previewSocialImport, suppliedSocialSource } from '../server/src/services/importReseauxSociaux.js';

async function readSource(args) {
  if (!args.length) return suppliedSocialSource();
  if (args.length !== 2 || args[0] !== '--file') throw new Error('Usage : npm run reseaux:import -- [--file fichier.xlsx] [--commit]');
  const file = path.resolve(args[1]);
  if (path.extname(file).toLowerCase() === '.xlsx') return parseSocialWorkbook({ originalname: path.basename(file), buffer: fs.readFileSync(file) });
  if (path.extname(file).toLowerCase() === '.json') return JSON.parse(fs.readFileSync(file, 'utf8'));
  throw new Error('Fichier .xlsx ou .json requis');
}
/** Même l'aperçu des migrations se fait sur une copie, jamais sur la base de travail. */
async function inspectCopy(source) {
  const parent = process.platform === 'win32' ? path.join(process.env.LOCALAPPDATA, 'Temp', 'opencode') : os.tmpdir();
  fs.mkdirSync(parent, { recursive: true });
  const directory = fs.mkdtempSync(path.join(parent, 'anm-reseaux-preview-'));
  const copy = path.join(directory, 'apercu.db');
  let sourceDb; let db;
  try {
    sourceDb = new Database(config.dbPath, { readonly: true, fileMustExist: true });
    await sourceDb.backup(copy);
    sourceDb.close(); sourceDb = null;
    db = new Database(copy);
    db.pragma('foreign_keys = ON');
    runMigrations(db, { logger: { info() {} } });
    return previewSocialImport(db, source);
  } finally {
    sourceDb?.close(); db?.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
async function main() {
  const args = process.argv.slice(2);
  const commit = args.includes('--commit');
  const source = await readSource(args.filter((arg) => arg !== '--commit'));
  const preview = await inspectCopy(source);
  console.log('Tableau :', `${source.fichier} / ${source.feuille}`);
  console.log('Aperçu (copie isolée) :', preview.summary);
  console.log('Rattachements à vérifier :', preview.rows.filter((row) => row.statut === 'nouveau' && !row.commune_id)
    .map((row) => `${row.ligne}:${row.colonne} ${row.ca_libelle} / ${row.commune_libelle}`));
  if (!commit) { console.log('Aucune modification. Ajouter --commit pour appliquer avec sauvegarde préalable.'); return; }
  if (preview.summary.erreurs) throw new Error('Import bloqué : corrigez les liens invalides dans le fichier avant --commit');
  const db = getDb();
  const backup = await createBackup(db, config.backupDir, 'securite');
  console.log('Sauvegarde cohérente avant migrations :', backup.nom);
  runMigrations(db, { logger: console });
  const result = importComptesSociaux(db, source);
  audit(null, 'RESEAUX_SOCIAUX_IMPORT', { entite: 'comptes_sociaux', details: { ...result.summary, created: result.created, source: 'reseaux:import', sauvegarde: backup.nom } });
  audit(null, 'BACKUP_CREATE', { entite: 'sauvegardes', entiteId: backup.nom, details: { source: 'reseaux:import', avant_migrations: true } });
  console.log('Import appliqué (aucune fiche existante écrasée) :', { created: result.created, skipped: result.skipped, errors: result.errors });
  console.log('Intégrité :', db.pragma('integrity_check', { simple: true }));
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(closeDb);
