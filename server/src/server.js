import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { config, ensureDirs } from './config/index.js';
import { logger } from './utils/logger.js';
import { prepareDatabase, startBackgroundJobs } from './bootstrap.js';
import { createApp } from './app.js';
import { closeDb, getDb } from './db/index.js';

export async function startServer() {
  ensureDirs();
  const prepared = await prepareDatabase();
  const app = createApp();
  if (config.https && (!fs.existsSync(config.httpsCert) || !fs.existsSync(config.httpsKey))) {
    throw new Error('HTTPS activé mais certificat ou clé introuvable — lancez npm run https:setup');
  }
  const server = config.https
    ? https.createServer({ cert: fs.readFileSync(config.httpsCert), key: fs.readFileSync(config.httpsKey) }, app)
    : http.createServer(app);
  server.listen(config.port, config.host, () => {
    const protocol = config.https ? 'https' : 'http';
    logger.info(`Serveur démarré sur ${protocol}://${config.host}:${config.port} (${config.env})`, {
      version: config.version,
      db: config.dbPath,
      taxonomie: prepared.taxonomy,
    });
  });
  const stopJobs = startBackgroundJobs(getDb(), logger);
  let stopping = false;
  const shutdown = (signal) => {
    if (stopping) return;
    stopping = true;
    logger.info(`Arrêt demandé (${signal})`);
    stopJobs();
    server.close(() => {
      try { closeDb(); } catch { /* déjà fermée */ }
      process.exit(0);
    });
    setTimeout(() => {
      try { closeDb(); } catch { /* déjà fermée */ }
      process.exit(0);
    }, 5000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (error) => {
    logger.error('Promesse rejetée non gérée', { message: error?.message, stack: error?.stack });
  });
  return { server, stopJobs, shutdown };
}

const launchedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (launchedDirectly) {
  startServer().catch((error) => {
    logger.error('Démarrage impossible', { message: error?.message, stack: error?.stack });
    process.exit(1);
  });
}
