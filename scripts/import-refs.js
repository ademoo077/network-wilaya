import fs from 'node:fs';
import path from 'node:path';
import { REF_ENTITIES } from '@anm/shared';
import { config } from '../server/src/config/index.js';
import { getDb, closeDb } from '../server/src/db/index.js';
import { runMigrations } from '../server/src/db/migrate.js';
import { createBackup } from '../server/src/services/backups.js';
import { importRefRows, parseCsv } from '../server/src/services/refImport.js';
import { audit } from '../server/src/services/audit.js';

async function main() {
  const [entity, filename, flag] = process.argv.slice(2);
  if (!REF_ENTITIES.includes(entity) || !filename || flag && flag !== '--commit') throw new Error('Usage : npm run ref:import -- agents|epics fichier.csv [--commit]');
  const file = path.resolve(filename);
  if (fs.statSync(file).size > 5 * 1024 * 1024) throw new Error('Fichier limité à 5 Mo');
  const rows = parseCsv(fs.readFileSync(file));
  const db = getDb();
  if (flag === '--commit') {
    const backup = await createBackup(db, config.backupDir, 'manuelle');
    audit(null, 'BACKUP_CREATE', { entite: 'sauvegardes', entiteId: backup.nom, details: { source: 'ref:import' } });
    console.log(`Sauvegarde : ${backup.nom}`);
  }
  runMigrations(db);
  const preview = importRefRows(db, entity, rows);
  console.log('Aperçu :', preview.summary);
  if (preview.summary.error) {
    console.error(preview.rows.filter((row) => row.statut === 'error').map(({ ligne, message }) => ({ ligne, message })));
    throw new Error('Corrigez les lignes invalides avant import');
  }
  if (flag === '--commit') {
    const result = db.transaction(() => {
      const imported = importRefRows(db, entity, rows, { commit: true });
      audit(null, 'REF_CREATE', { entite: entity, details: { source: 'ref:import', fichier: path.basename(file), ...imported.summary } });
      return imported;
    })();
    console.log('Import terminé :', result.summary);
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(closeDb);
