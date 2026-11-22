import { ensureDirs } from '../server/src/config/index.js';
import { closeDb, getDb } from '../server/src/db/index.js';
import { runMigrations } from '../server/src/db/migrate.js';
import { recalculerPhotos } from '../server/src/services/photoPipeline.js';

async function main() {
  ensureDirs();
  const db = getDb();
  runMigrations(db, { logger: console });
  const rapport = await recalculerPhotos(db, {
    onProgress: ({ fait, total }) => {
      if (fait % 25 === 0 || fait === total) console.log(`Photos : ${fait}/${total}`);
    },
  });
  console.log(JSON.stringify(rapport, null, 2));
  closeDb();
}

main().catch((error) => {
  console.error('Recalcul des photos impossible :', error.message);
  process.exit(1);
});
