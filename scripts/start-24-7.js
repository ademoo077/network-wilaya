/** Superviseur local : garde l'API + le SPA disponibles en production. */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const logPath = path.join(root, 'logs', 'server-24-7.log');
const healthUrl = process.env.ANM_HEALTH_URL || 'http://127.0.0.1:3000/api/health';
const watchMs = 10_000;
const retryMs = 5_000;
fs.mkdirSync(path.dirname(logPath), { recursive: true });
const logFd = fs.openSync(logPath, 'a');

function log(message) {
  fs.writeSync(logFd, `[${new Date().toISOString()}] ${message}\n`);
}
const delay = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

async function healthy() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2_000);
    try {
      const response = await fetch(healthUrl, { signal: controller.signal });
      return response.ok;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return false;
  }
}

async function waitForHealth(stopped) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (stopped()) return false;
    if (await healthy()) return true;
    await delay(1_000);
  }
  return false;
}

async function supervise() {
  log('Superviseur 24/7 démarré');
  while (true) {
    if (await healthy()) {
      log('Serveur déjà actif — surveillance');
      await delay(watchMs);
      continue;
    }
    log('Serveur absent — démarrage');
    const child = spawn(process.execPath, [path.join(root, 'scripts', 'start.js')], {
      cwd: root,
      stdio: ['ignore', logFd, logFd],
    });
    let stopped = false;
    child.once('exit', (code) => { stopped = true; log(`Processus serveur terminé (code ${code})`); });
    child.on('error', (error) => { stopped = true; log(`Erreur processus : ${error.message}`); });
    const ok = await waitForHealth(() => stopped);
    if (stopped || !ok) {
      if (!stopped) child.kill();
      log(`Health check non confirmé — nouvelle tentative dans ${retryMs / 1000} s`);
      await delay(retryMs);
      continue;
    }
    log('Serveur opérationnel — surveillance');
    while (await healthy()) await delay(watchMs);
    log('Serveur indisponible — relance');
    if (!stopped) child.kill();
    await delay(retryMs);
  }
}

supervise().catch((error) => {
  log(`Erreur superviseur : ${error.stack || error}`);
  process.exitCode = 1;
});
