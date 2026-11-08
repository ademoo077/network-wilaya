import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(here, '../../..');

dotenv.config({ path: path.join(PROJECT_ROOT, '.env') });

if (!process.env.TZ) process.env.TZ = 'Africa/Algiers';
process.env.TZ = process.env.TZ || 'Africa/Algiers';

function bool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function abs(p, fallback) {
  const raw = p || fallback;
  return path.isAbsolute(raw) ? raw : path.resolve(PROJECT_ROOT, raw);
}

export const config = {
  projectRoot: PROJECT_ROOT,
  env: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  host: process.env.HOST || '0.0.0.0',
  port: Number(process.env.PORT || 3000),
  tz: process.env.TZ || 'Africa/Algiers',
  dbPath: abs(process.env.DB_PATH, './data/anomalies.db'),
  uploadDir: abs(process.env.UPLOAD_DIR, './data/uploads'),
  backupDir: abs(process.env.BACKUP_DIR, './backups'),
  logDir: abs(process.env.LOG_DIR, './logs'),
  tmpDir: abs(process.env.TMP_DIR, './data/tmp'),
  clientDist: path.join(PROJECT_ROOT, 'client', 'dist'),
  seedCsv: path.join(PROJECT_ROOT, 'seed', 'taxonomie_anomalies.csv'),
  groupsCsv: path.join(PROJECT_ROOT, 'seed', 'groupes_domaines.csv'),
  cookieSecure: bool(process.env.COOKIE_SECURE, false),
  sessionTtlHours: Number(process.env.SESSION_TTL_HOURS || 8),
  logLevel: process.env.LOG_LEVEL || 'info',
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || '',
  version: process.env.APP_VERSION || '5.0.0',
  maxLoginAttempts: 5,
  lockMinutes: 15,
};

export function ensureDirs() {
  for (const dir of [path.dirname(config.dbPath), config.uploadDir, config.backupDir, config.logDir, config.tmpDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
