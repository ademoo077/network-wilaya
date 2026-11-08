import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/index.js';

export function log(level, message, meta = {}) {
  const line = JSON.stringify({ at: new Date().toISOString(), level, message, ...meta });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
  try {
    fs.mkdirSync(config.logDir, { recursive: true });
    fs.appendFileSync(path.join(config.logDir, 'app.log'), `${line}\n`);
  } catch {
    // le journal fichier ne doit jamais faire échouer une requête
  }
}

export const logger = {
  info: (message, meta) => log('info', message, meta),
  warn: (message, meta) => log('warn', message, meta),
  error: (message, meta) => log('error', message, meta),
};
