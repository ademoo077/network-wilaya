import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const root = process.env.ANM_TEST_ROOT || path.join(os.tmpdir(), `anm-v5-e2e-${process.pid}-${Date.now()}`);
fs.mkdirSync(root, { recursive: true });
process.env.ANM_TEST_ROOT = root;
process.env.NODE_ENV = 'test';
process.env.TZ = 'Africa/Algiers';
process.env.PORT = '4321';
process.env.DB_PATH = path.join(root, 'anomalies.db');
process.env.UPLOAD_DIR = path.join(root, 'uploads');
process.env.BACKUP_DIR = path.join(root, 'backups');
process.env.LOG_DIR = path.join(root, 'logs');
process.env.TMP_DIR = path.join(root, 'tmp');
process.env.COOKIE_SECURE = 'false';
process.env.LOG_LEVEL = 'error';
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'E2E-Alger-2026';

const { startServer } = await import('../server/src/server.js');
const { closeDb } = await import('../server/src/db/index.js');

const results = [];
function check(name, condition, detail = '') {
  results.push({ name, ok: Boolean(condition) });
  if (!condition) console.error(`ÉCHEC — ${name}${detail ? ` : ${detail}` : ''}`);
}

async function waitForHealth(base, attempts = 60) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) return await response.json();
    } catch { /* serveur pas encore prêt */ }
    await delay(250);
  }
  return null;
}

const { server, stopJobs } = await startServer();
let base = null;
try {
  base = `http://127.0.0.1:${process.env.PORT || 4321}`;
  const health = await waitForHealth(base);
  check('health', Boolean(health?.ok) && health.version === '5.0.0' && health.db === true, JSON.stringify(health));

  const home = await fetch(`${base}/`);
  check('static-client', home.ok && (home.headers.get('content-type') || '').includes('text/html'), home.status);

  const anonymous = await fetch(`${base}/api/anomalies`);
  check('auth-guard', anonymous.status === 401, String(anonymous.status));

  const login = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD }),
  });
  const loginPayload = await login.json().catch(() => null);
  const loginCookie = login.headers.getSetCookie?.().map((entry) => entry.split(';')[0]).join('; ') || '';
  check('login', login.ok && loginPayload?.user?.role === 'admin', `${login.status} ${JSON.stringify(loginPayload)}`);

  const anomalies = await fetch(`${base}/api/anomalies`, { headers: { cookie: loginCookie } });
  const anomaliesPayload = await anomalies.json().catch(() => null);
  check('anomalies-list', anomalies.ok && Array.isArray(anomaliesPayload?.items), `${anomalies.status}`);

  const stats = await fetch(`${base}/api/stats/overview?from=2026-10-01&to=2026-11-08`, { headers: { cookie: loginCookie } });
  check('stats-overview', stats.ok, `${stats.status} ${JSON.stringify(await stats.json().catch(() => null))}`);

  const detail = await fetch(`${base}/api/stats/detail?from=2026-10-01&to=2026-11-08`, { headers: { cookie: loginCookie } });
  const detailPayload = await detail.json().catch(() => null);
  const funnel = detailPayload?.item?.entonnoir?.etapes;
  const funnelOk = funnel && funnel.confirmees <= funnel.verifiees && funnel.verifiees <= funnel.recues;
  check('stats-detail', detail.ok && Boolean(funnelOk) && Array.isArray(detailPayload?.item?.faits), `${detail.status}`);

  const paste = await fetch(`${base}/api/tools/parse-paste`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: loginCookie, 'X-CSRF-Token': loginPayload?.csrf || '' },
    body: JSON.stringify({ texte: 'Regardez ce contenu https://www.tiktok.com/@agent_wilaya/video/7234567890123456789 merci' }),
  });
  const pastePayload = await paste.json().catch(() => null);
  check('parse-paste', paste.ok && Array.isArray(pastePayload?.item?.urls) && Array.isArray(pastePayload?.item?.coords), `${paste.status} ${JSON.stringify(pastePayload)}`);

  const locate = await fetch(`${base}/api/geo/locate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: loginCookie, 'X-CSRF-Token': loginPayload?.csrf || '' },
    body: JSON.stringify({ lat: 36.7538, lng: 3.0588 }),
  });
  check('geo-locate', locate.ok, `${locate.status}`);

  const logout = await fetch(`${base}/api/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: loginCookie, 'X-CSRF-Token': loginPayload?.csrf || '' },
  });
  check('logout', logout.ok, `${logout.status}`);

  const failedAfterLogout = await fetch(`${base}/api/anomalies`, { headers: { cookie: loginCookie } });
  check('session-closed', failedAfterLogout.status === 401, `${failedAfterLogout.status}`);
} finally {
  await new Promise((resolve) => server.close(() => resolve()));
  if (stopJobs) stopJobs();
  try { closeDb(); } catch { /* déjà fermée */ }
}

const failed = results.filter((entry) => !entry.ok);
for (const entry of results) console.log(`${entry.ok ? 'OK  ' : 'FAIL'} ${entry.name}`);
if (failed.length) {
  console.error(`${failed.length} scénario(s) E2E en échec`);
  process.exit(1);
}
console.log(`E2E OK — ${results.length} scénarios`);
process.exit(0);
