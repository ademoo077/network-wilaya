import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { startFakeRedirectServer } from './fake-redirects.mjs';

if (!process.env.ANM_TEST_ROOT) throw new Error('ANM_TEST_ROOT obligatoire pour isoler les données');
const root = process.env.ANM_TEST_ROOT;
Object.assign(process.env, { NODE_ENV: 'test', TZ: 'Africa/Algiers', HTTPS: 'false', HOST: '127.0.0.1',
  COOKIE_SECURE: 'false', ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: 'E2E-Alger-2026', LOG_LEVEL: 'error',
  SECRETS_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  DB_PATH: path.join(root, 'anomalies.db'), UPLOAD_DIR: path.join(root, 'uploads'),
  BACKUP_DIR: path.join(root, 'backups'), LOG_DIR: path.join(root, 'logs'), TMP_DIR: path.join(root, 'tmp') });
const { prepareDatabase } = await import('../../server/src/bootstrap.js');
const { getDb, closeDb } = await import('../../server/src/db/index.js');
const { createApp } = await import('../../server/src/app.js');
const { setResolveDeps } = await import('../../server/src/routes/tools.js');
const { seedBrowser } = await import('./seed-browser.mjs');
await prepareDatabase({ log: { info() {}, warn() {} } });
const refs = seedBrowser(getDb(), process.env.E2E_DATASET || 'demo');
const redirects = await startFakeRedirectServer();
setResolveDeps({ fetchImpl: redirects.fetchImpl, lookupImpl: redirects.lookupImpl });
const server = http.createServer(createApp());
await new Promise((resolve) => server.listen(Number(process.env.E2E_PORT || 0), '127.0.0.1', resolve));
const result = { base: `http://127.0.0.1:${server.address().port}`, refs, root };
if (process.send) process.send(result);
else console.log(JSON.stringify(result));
async function close() {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await redirects.stop();
  closeDb();
  fs.rmSync(root, { recursive: true, force: true });
  process.exit(0);
}
process.on('message', (message) => { if (message === 'close') close(); });
process.on('SIGTERM', close);
