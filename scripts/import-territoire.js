import fs from 'node:fs';
import { config } from '../server/src/config/index.js';
import { getDb, closeDb } from '../server/src/db/index.js';
import { createBackup } from '../server/src/services/backups.js';
import { importTerritoire } from '../server/src/services/territoireImport.js';
import { audit } from '../server/src/services/audit.js';

async function main() {
  if (process.argv.slice(2).some((arg) => arg !== '--commit')) throw new Error('Usage : npm run territoire:import -- [--commit]');
  const commit = process.argv.includes('--commit');
  const source = JSON.parse(fs.readFileSync(new URL('../seed/territoire-alger.json', import.meta.url), 'utf8'));
  const db = getDb();
  console.log('Aperçu :', importTerritoire(db, source));
  if (!commit) return;
  const backup = await createBackup(db, config.backupDir, 'manuelle');
  audit(null, 'BACKUP_CREATE', { entite: 'sauvegardes', entiteId: backup.nom, details: { source: 'territoire:import' } });
  console.log(`Sauvegarde : ${backup.nom}`);
  const result = db.transaction(() => {
    const summary = importTerritoire(db, source, { commit: true });
    audit(null, 'REF_UPDATE', { entite: 'communes', details: { source: 'territoire:import', ...summary } });
    return summary;
  })();
  console.log('Territoire intégré :', result);
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(closeDb);
