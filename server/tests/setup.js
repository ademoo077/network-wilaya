import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll } from 'vitest';

// Toutes les suites tournent sur une base temporaire, jamais sur data/ ni backups/.
const root = process.env.ANM_TEST_ROOT || path.join(os.tmpdir(), `anm-v4-tests-${process.pid}`);
if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });

process.env.ANM_TEST_ROOT = root;
process.env.NODE_ENV = 'test';
process.env.TZ = 'Africa/Algiers';
process.env.DB_PATH = path.join(root, 'anomalies.db');
process.env.UPLOAD_DIR = path.join(root, 'uploads');
process.env.BACKUP_DIR = path.join(root, 'backups');
process.env.LOG_DIR = path.join(root, 'logs');
process.env.TMP_DIR = path.join(root, 'tmp');
process.env.COOKIE_SECURE = 'false';
process.env.LOG_LEVEL = 'error';
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = '';

afterAll(async () => {
  const { cleanup } = await import('./helpers.js');
  cleanup();
});
