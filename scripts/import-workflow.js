import fs from 'node:fs';
import { config } from '../server/src/config/index.js';
import { getDb, closeDb } from '../server/src/db/index.js';
import { runMigrations } from '../server/src/db/migrate.js';
import { createBackup } from '../server/src/services/backups.js';
import { importInterventions } from '../server/src/services/interventions.js';
import { audit } from '../server/src/services/audit.js';

async function main() {
  const commit = process.argv.includes('--commit');
  const source = JSON.parse(fs.readFileSync(new URL('../seed/interventions-workflow.json', import.meta.url), 'utf8'));
  const mapping = JSON.parse(fs.readFileSync(new URL('../seed/interventions-mapping.json', import.meta.url), 'utf8'));
  const db = getDb();
  if (commit) {
    const backup = await createBackup(db, config.backupDir, 'manuelle');
    audit(null, 'BACKUP_CREATE', { entite: 'sauvegardes', entiteId: backup.nom, details: { source: 'workflow:import' } });
    console.log(`Sauvegarde : ${backup.nom}`);
  }
  runMigrations(db);
  const preview = importInterventions(db, source, mapping);
  console.log('Aperçu :', preview);
  if (commit) {
    const result = db.transaction(() => {
      const summary = importInterventions(db, source, mapping, { commit: true });
      audit(null, 'REF_UPDATE', { entite: 'epics', details: { source: 'workflow:import', ...summary } });
      return summary;
    })();
    console.log('Workflow intégré :', result);
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(closeDb);
