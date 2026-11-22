/**
 * Recette V13 — captures d'écran des surfaces clés (liste, fiche photos,
 * synthèses, formulaire avancé) en FR/AR, clair/sombre et plusieurs largeurs.
 * Sortie : docs/captures-v13/. Lancer après `npm run build`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { todayAlgiers } from '@anm/shared';
import { startTestServer, loginAs, stubTiles } from '../tests/e2e/helpers.js';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'captures-v13');

async function api(base, session, method, url, data) {
  const response = await fetch(`${base}${url}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrf, cookie: `sid=${session.token}` },
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!response.ok) throw new Error(`${method} ${url} → ${response.status} ${await response.text()}`);
  return response.json();
}

async function upload(base, session, id, role, buffer) {
  const form = new FormData();
  form.append('role', role);
  form.append('file', new Blob([buffer], { type: 'image/png' }), `${role}.png`);
  const response = await fetch(`${base}/api/anomalies/${id}/pieces`, {
    method: 'POST', headers: { 'X-CSRF-Token': session.csrf, cookie: `sid=${session.token}` }, body: form,
  });
  if (!response.ok) throw new Error(`upload ${role} → ${response.status} ${await response.text()}`);
}

async function seedPair(base, session, refs) {
  const created = await api(base, session, 'POST', '/api/anomalies', {
    lien_url: `https://facebook.com/v13-captures-${Date.now()}`, plateforme: 'facebook', date_signalement: todayAlgiers(),
    domaine_id: refs.domaine, type_id: refs.type, daira_id: refs.daira, commune_id: refs.commune,
    observations: '[DEMO] Capture recette V13', epic_id: refs.epic, agent_id: refs.agent,
  });
  const item = created.item;
  await api(base, session, 'PATCH', `/api/anomalies/${item.id}`, {
    version: item.version, statut: 'traite', epic_id: refs.epic, date_traitement: todayAlgiers(),
    sans_photo_motif: 'Capture recette V13', motif: 'Clôture pour la recette finale',
  });
  const avant = await sharp({ create: { width: 1280, height: 720, channels: 3, background: '#0b7048' } }).composite([
    { input: Buffer.from(`<svg width="1280" height="720"><text x="40" y="120" font-size="72" fill="#fff">AVANT</text></svg>`), top: 0, left: 0 },
  ]).png().toBuffer();
  const apres = await sharp({ create: { width: 1280, height: 720, channels: 3, background: '#7a3d8f' } }).composite([
    { input: Buffer.from(`<svg width="1280" height="720"><text x="40" y="120" font-size="72" fill="#fff">APRÈS</text></svg>`), top: 0, left: 0 },
  ]).png().toBuffer();
  await upload(base, session, item.id, 'avant', avant);
  await upload(base, session, item.id, 'apres', apres);
  return item.id;
}

const SHOTS = [
  { name: 'liste-1440-fr-clair', route: '/#/anomalies', width: 1440, lang: 'fr', theme: 'light' },
  { name: 'liste-390-fr-clair', route: '/#/anomalies', width: 390, lang: 'fr', theme: 'light' },
  { name: 'liste-1440-ar-sombre', route: '/#/anomalies', width: 1440, lang: 'ar', theme: 'dark' },
  { name: 'fiche-photos-1440-fr-clair', route: (ctx) => `/#/anomalies/${ctx.id}`, width: 1440, lang: 'fr', theme: 'light' },
  { name: 'fiche-photos-390-fr-sombre', route: (ctx) => `/#/anomalies/${ctx.id}`, width: 390, lang: 'fr', theme: 'dark' },
  { name: 'fiche-photos-1440-ar-sombre', route: (ctx) => `/#/anomalies/${ctx.id}`, width: 1440, lang: 'ar', theme: 'dark' },
  { name: 'creation-avance-1440-fr-clair', route: '/#/anomalies/nouvelle', width: 1440, lang: 'fr', theme: 'light',
    before: async (page) => { await page.locator('details[data-advanced] summary').click(); } },
  { name: 'syntheses-1440-fr-clair', route: '/#/syntheses', width: 1440, lang: 'fr', theme: 'light' },
  { name: 'tableau-de-bord-390-fr-sombre', route: '/#/', width: 390, lang: 'fr', theme: 'dark' },
];

fs.mkdirSync(OUT, { recursive: true });
const server = await startTestServer();
const browser = await chromium.launch();
try {
  const session = await loginAs(server.base, 'admin');
  const id = await seedPair(server.base, session, server.refs);
  for (const shot of SHOTS) {
    const context = await browser.newContext({ viewport: { width: shot.width, height: 1000 }, deviceScaleFactor: 1 });
    await context.addCookies([{ name: 'sid', value: session.token, url: server.base }]);
    await context.addInitScript(([lang, theme]) => {
      localStorage.setItem('anm-language', lang); localStorage.setItem('anm-theme', theme);
    }, [shot.lang, shot.theme]);
    const page = await context.newPage();
    await stubTiles(page);
    const route = typeof shot.route === 'function' ? shot.route({ id }) : shot.route;
    await page.goto(`${server.base}${route}`);
    await page.waitForSelector('#root h1');
    if (shot.before) await shot.before(page);
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, `${shot.name}.png`) });
    await context.close();
    process.stdout.write(`capturé : ${shot.name}\n`);
  }
} finally {
  await browser.close();
  await server.close();
}
