import { config, ensureDirs } from '../server/src/config/index.js';
import { getDb, closeDb } from '../server/src/db/index.js';
import { runMigrations } from '../server/src/db/migrate.js';
import { createBackup } from '../server/src/services/backups.js';

async function main() {
  ensureDirs();
  const db = getDb();
  runMigrations(db, { logger: console });
  const backup = await createBackup(db, config.backupDir, 'manuelle');
  console.log(`Sauvegarde créée : ${backup.nom} (${Math.round(backup.taille / 1024)} Ko)`);
  console.log(`Dossier : ${config.backupDir}`);
  closeDb();
}

main().catch((error) => {
  console.error('Sauvegarde impossible :', error.message);
  process.exit(1);
});
