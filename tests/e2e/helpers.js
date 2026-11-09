import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

export async function waitForHealth(base, attempts = 120) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) return await response.json();
    } catch { /* serveur pas encore prêt */ }
    await delay(250);
  }
  return null;
}

export function startFakeRedirectServer() {
  const server = http.createServer((_req, res) => {
    res.writeHead(302, { Location: 'https://www.google.com/maps/place/FauxLieu/@36.7538,3.0588,17z' });
    res.end();
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port, stop: () => new Promise((done) => server.close(() => done())) }));
  });
}

export async function startTestServer() {
  const root = process.env.ANM_E2E_ROOT || path.join(os.tmpdir(), `anm-v6-e2e-${process.pid}-${Date.now()}`);
  fs.mkdirSync(root, { recursive: true });
  process.env.ANM_E2E_ROOT = root;
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

  const { startServer } = await import('../../server/src/server.js');
  const { closeDb, getDb } = await import('../../server/src/db/index.js');
  const redirect = await startFakeRedirectServer();
  const { server, stopJobs } = await startServer();
  await waitForHealth(`http://127.0.0.1:${process.env.E2E_PORT || 4173}`);
  await getDb().prepare('UPDATE users SET must_change_password = 0 WHERE username = ?').run(process.env.ADMIN_USERNAME || 'admin');
  const base = `http://127.0.0.1:${process.env.E2E_PORT || 4173}`;
  const close = async () => {
    stopJobs?.();
    await new Promise((resolve) => server.close(() => resolve()));
    await redirect.stop();
    try { closeDb(); } catch { /* déjà fermée */ }
  };
  return { base, server, close, redirect };
}

export async function loginAs(base, role = 'admin') {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'E2E-Alger-2026';
  const response = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
  const payload = await response.json().catch(() => null);
  const setCookie = response.headers.getSetCookie?.() || [];
  if (!response.ok) throw new Error(`loginAs: ${response.status} ${JSON.stringify(payload)}`);
  const pair = setCookie[0] || '';
  const token = pair.split(';')[0].split('=').slice(1).join('=');
  return { user: payload.user, csrf: payload.csrf, token, cookie: pair, role };
}

export function collectErrors(page) {
  const errors = { pageError: [], consoleError: [], requestFailed: [] };
  page.on('pageerror', (error) => errors.pageError.push({ message: String(error?.message || error) }));
  page.on('console', (message) => { if (message.type() === 'error') errors.consoleError.push({ text: message.text() }); });
  page.on('requestfailed', (request) => errors.requestFailed.push({ url: request.url(), failure: request.failure()?.errorText }));
  return {
    errors,
    snapshot: () => ({ pageError: [...errors.pageError], consoleError: [...errors.consoleError], requestFailed: [...errors.requestFailed] }),
    reset: () => { errors.pageError.length = 0; errors.consoleError.length = 0; errors.requestFailed.length = 0; },
  };
}

export async function expectNotBlank(page, timeout = 3000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const text = await page.evaluate(() => document.getElementById('root')?.innerText || document.getElementById('root')?.textContent || '');
    const normalized = text.trim();
    if (normalized.length > 50) return true;
    await page.waitForTimeout(250);
  }
  return false;
}

export async function pasteText(page, selector, text) {
  await page.evaluate(([target, value]) => {
    const element = document.querySelector(target);
    if (!element) throw new Error(`pasteText: élément introuvable ${target}`);
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', value);
    const event = new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true, composed: true });
    element.dispatchEvent(event);
  }, [selector, text]);
}

export async function blockTiles(page) {
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (/tile|openstreetmap|carto|basemaps|tile\.openstreetmap|arcgisonline|here|google|osm|carto/i.test(url)) return route.abort();
    return route.continue();
  });
}

export async function unroute(page) {
  await page.unroute('**/*');
}
