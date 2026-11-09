import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

const root = process.env.ANM_E2E_ROOT || path.join(os.tmpdir(), `anm-v6-e2e-${process.pid}-${Date.now()}`);
fs.mkdirSync(root, { recursive: true });

process.env.ANM_TEST_ROOT = root;
process.env.NODE_ENV = 'test';
process.env.TZ = 'Africa/Algiers';
process.env.PORT = process.env.E2E_PORT || '4173';
process.env.DB_PATH = path.join(root, 'anomalies.db');
process.env.UPLOAD_DIR = path.join(root, 'uploads');
process.env.BACKUP_DIR = path.join(root, 'backups');
process.env.LOG_DIR = path.join(root, 'logs');
process.env.TMP_DIR = path.join(root, 'tmp');
process.env.COOKIE_SECURE = 'false';
process.env.LOG_LEVEL = 'error';
process.env.ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'E2E-Alger-2026';

const redirect = http.createServer((_req, res) => {
  res.writeHead(302, { Location: 'https://www.google.com/maps/place/FauxLieu/@36.7538,3.0588,17z' });
  res.end();
});

const { startServer } = await import('../server/src/server.js');
const { getDb } = await import('../server/src/db/index.js');
const { server } = await startServer();
await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
await getDb().prepare('UPDATE users SET must_change_password = 0 WHERE username = ?').run(process.env.ADMIN_USERNAME || 'admin');
await new Promise((resolve) => redirect.listen(0, '127.0.0.1', resolve));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('Unexpected server address');
process.stdout.write(`E2E_READY http://127.0.0.1:${address.port}\n`);
setInterval(() => {}, 1000);
