/**
 * Recette V14 — captures du sélecteur de page, du panneau d'ajout, de la fiche,
 * de la liste filtrée et du tableau de bord (FR/AR, clair/sombre, 390→1440).
 * Sortie : docs/captures-v14/. Lancer après `npm run build`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { todayAlgiers } from '@anm/shared';
import { startTestServer, loginAs, stubTiles } from '../tests/e2e/helpers.js';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'captures-v14');
const PAGE_NOM = '[DEMO] Page Captures V14';
const PAGE_URL = 'https://facebook.com/captures-v14';

async function api(base, session, method, url, data) {
  const response = await fetch(`${base}${url}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrf, cookie: `sid=${session.token}` },
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!response.ok) throw new Error(`${method} ${url} → ${response.status} ${await response.text()}`);
  return response.json();
}

const SHOTS = [];
for (const lang of ['fr', 'ar']) {
  for (const theme of ['light', 'dark']) {
    for (const width of [390, 768, 1024, 1440]) {
      SHOTS.push({ name: `source-${width}-${lang}-${theme}`, route: '/#/anomalies/nouvelle', width, lang, theme, kind: 'detected' });
    }
  }
}
SHOTS.push(
  { name: 'ajout-1440-fr-clair', route: '/#/anomalies/nouvelle', width: 1440, lang: 'fr', theme: 'light', kind: 'add' },
  { name: 'ajout-390-ar-sombre', route: '/#/anomalies/nouvelle', width: 390, lang: 'ar', theme: 'dark', kind: 'add' },
  { name: 'fiche-1440-fr-clair', route: (ctx) => `/#/anomalies/${ctx.id}`, width: 1440, lang: 'fr', theme: 'light' },
  { name: 'liste-filtre-1440-fr-clair', route: '/#/anomalies', width: 1440, lang: 'fr', theme: 'light', kind: 'filter' },
  { name: 'tableau-bord-source-1440-ar-sombre', route: '/#/', width: 1440, lang: 'ar', theme: 'dark' },
);

fs.mkdirSync(OUT, { recursive: true });
const server = await startTestServer();
const browser = await chromium.launch();
try {
  const session = await loginAs(server.base, 'admin');
  const source = await api(server.base, session, 'POST', '/api/reseaux/rapide', {
    reseau: 'facebook', page_url: PAGE_URL, nom: PAGE_NOM, nature: 'page',
    daira_id: server.refs.daira, commune_id: server.refs.commune,
  });
  const anomalie = await api(server.base, session, 'POST', '/api/anomalies', {
    lien_url: `${PAGE_URL}/posts/12`, plateforme: 'facebook', date_signalement: todayAlgiers(),
    domaine_id: server.refs.domaine, type_id: server.refs.type,
    daira_id: server.refs.daira, commune_id: server.refs.commune,
    source_reseau_id: source.item.id, observations: '[DEMO] Capture recette V14',
  });
  for (const shot of SHOTS) {
    const context = await browser.newContext({ viewport: { width: shot.width, height: 1000 }, deviceScaleFactor: 1 });
    await context.addCookies([{ name: 'sid', value: session.token, url: server.base }]);
    await context.addInitScript(([lang, theme, csrf]) => {
      localStorage.setItem('anm-language', lang); localStorage.setItem('anm-theme', theme);
      window.__ANM_CSRF__ = csrf;
    }, [shot.lang, shot.theme, session.csrf]);
    const page = await context.newPage();
    await stubTiles(page);
    const route = typeof shot.route === 'function' ? shot.route({ id: anomalie.item.id }) : shot.route;
    await page.goto(`${server.base}${route}`);
    await page.waitForSelector('#root h1');
    if (shot.kind === 'detected') {
      await page.locator('#lien_url').fill(`${PAGE_URL}/posts/12`);
      await page.waitForFunction((nom) => document.querySelector('[data-testid="source-picker"]')?.textContent.includes(nom), PAGE_NOM);
    } else if (shot.kind === 'add') {
      await page.locator('#lien_url').fill('https://facebook.com/page-absente-v14/posts/4');
      await page.waitForSelector('[data-testid="source-add-panel"]');
    } else if (shot.kind === 'filter') {
      await page.locator('#source').fill(PAGE_NOM);
      await page.getByRole('option', { name: new RegExp(PAGE_NOM.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).click();
      await page.waitForTimeout(400);
    }
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, `${shot.name}.png`) });
    await context.close();
    process.stdout.write(`capturé : ${shot.name}\n`);
  }
} finally {
  await browser.close();
  await server.close();
}
