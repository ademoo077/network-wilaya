import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config/index.js';
import { runMigrations } from './db/migrations/index.js';
import { seedTaxonomy, ensureSeedUsers } from './db/seed.js';
import { createApp } from './app.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function main() {
  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  fs.mkdirSync(config.backupDir, { recursive: true });
  runMigrations();
  const counts = seedTaxonomy();
  ensureSeedUsers();
  const app = createApp();
  app.listen(config.port, '0.0.0.0', () => {
    console.log(`[server] API demarree sur http://0.0.0.0:${config.port}`);
    console.log(`[server] taxonomie seedee: ${counts.domaines} domaines, ${counts.types} types`);
  });
}

main();
