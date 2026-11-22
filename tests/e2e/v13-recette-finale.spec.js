import sharp from 'sharp';
import { todayAlgiers } from '@anm/shared';
import { test, expect } from './fixture.js';
import { authenticate, collectErrors, expectNotBlank } from './helpers.js';
import { expectAccessible, expectNoOverflow } from './geometry.js';

const LARGEURS = [390, 768, 1024, 1280, 1440];

async function createTreatedPair(page, baseURL, session, testServer, suffix) {
  const cree = await page.request.post(`${baseURL}/api/anomalies`, {
    headers: { 'X-CSRF-Token': session.csrf },
    data: {
      lien_url: `https://facebook.com/v13-recette-${suffix}-${Date.now()}`,
      plateforme: 'facebook', date_signalement: todayAlgiers(),
      domaine_id: testServer.refs.domaine, type_id: testServer.refs.type,
      daira_id: testServer.refs.daira, commune_id: testServer.refs.commune,
      observations: `[DEMO] Recette V13 ${suffix}`,
      epic_id: testServer.refs.epic, agent_id: testServer.refs.agent,
    },
  });
  expect(cree.status(), await cree.text()).toBe(201);
  const item = (await cree.json()).item;
  const patch = await page.request.patch(`${baseURL}/api/anomalies/${item.id}`, {
    headers: { 'X-CSRF-Token': session.csrf },
    data: { version: item.version, statut: 'traite', epic_id: testServer.refs.epic,
      date_traitement: todayAlgiers(), sans_photo_motif: 'Recette finale V13',
      motif: 'Clôture pour la recette finale' },
  });
  expect(patch.status(), await patch.text()).toBe(200);
  const image = await sharp({ create: { width: 640, height: 480, channels: 3, background: suffix === 'a' ? '#1f6f43' : '#7a3d8f' } }).png().toBuffer();
  for (const role of ['avant', 'apres']) {
    const uploaded = await page.request.post(`${baseURL}/api/anomalies/${item.id}/pieces`, {
      headers: { 'X-CSRF-Token': session.csrf },
      multipart: { file: { name: `${suffix}-${role}.png`, mimeType: 'image/png', buffer: image }, role },
    });
    expect(uploaded.status(), await uploaded.text()).toBe(201);
  }
  return { id: item.id, reference: item.reference };
}

async function installerMesureCLS(page) {
  await page.addInitScript(() => {
    window.__cls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__cls += entry.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
}

async function attendreStable(page) {
  await page.waitForLoadState('load');
  await page.waitForTimeout(200);
}

test('177 — recette finale : liste, fiche et synthèses en FR/AR × clair/sombre × 390/768/1024/1440', async ({ page, baseURL, testServer }) => {
  test.setTimeout(300_000);
  const errors = collectErrors(page);
  const session = await authenticate(page, baseURL);
  const paire = await createTreatedPair(page, baseURL, session, testServer, 'recette');
  await installerMesureCLS(page);
  await page.goto('/#/anomalies');

  let etape = 0;
  for (const lang of ['fr', 'ar']) {
    for (const theme of ['light', 'dark']) {
      await page.evaluate(({ lang, theme }) => {
        localStorage.setItem('anm-language', lang);
        localStorage.setItem('anm-theme', theme);
      }, { lang, theme });
      for (const largeur of LARGEURS) {
        await page.setViewportSize({ width: largeur, height: 1000 });
        const routes = [
          ['liste', '/anomalies'],
          ['fiche', `/anomalies/${paire.id}`],
          ['syntheses', '/syntheses'],
        ];
        for (const [nom, route] of routes) {
          await test.step(`${lang}/${theme}/${largeur}/${nom}`, async () => {
            await page.goto(`/?recette=${etape}#${route}`);
            etape += 1;
            await attendreStable(page);
            await expect(page.locator('main h1, #root h1').first()).toBeVisible();
            expect(await page.locator('html').getAttribute('dir'), `direction ${lang}`).toBe(lang === 'ar' ? 'rtl' : 'ltr');
            expect(await page.locator('html').evaluate((node) => node.dataset.theme)).toBe(theme);
            await expect(page.getByText('Une erreur est survenue', { exact: true })).toHaveCount(0);
            await expectNoOverflow(page);
            const cls = await page.evaluate(() => window.__cls ?? 0);
            expect(cls, `CLS ${lang}/${theme}/${largeur}/${nom}`).toBeLessThan(0.1);
            if (nom === 'fiche') {
              const image = page.locator('img[src*="/api/photos/"]').first();
              await expect(image).toBeVisible();
              await expect.poll(() => image.evaluate((element) => element.naturalWidth), { message: 'image chargée' }).toBeGreaterThan(0);
            }
          });
        }
        await test.step(`axe ${lang}/${theme}/${largeur}/fiche`, async () => {
          await expectAccessible(page);
        });
      }
    }
  }

  expect(errors.snapshot().pageError).toEqual([]);
  expect(errors.snapshot().consoleError).toEqual([]);
});

test('178 — recette finale : rechargements durs et non-régression V4–V12', async ({ page, baseURL, testServer }) => {
  test.setTimeout(300_000);
  const errors = collectErrors(page);
  const session = await authenticate(page, baseURL);
  const paire = await createTreatedPair(page, baseURL, session, testServer, 'reload');

  const routes = ['/', '/anomalies', `/anomalies/${testServer.refs.ids[0]}`, '/anomalies/nouvelle',
    '/syntheses', '/carte', '/rapport', '/reseaux-sociaux', '/veille/tableau', '/admin/parametres'];
  for (const route of routes) {
    await test.step(`rechargement dur ${route}`, async () => {
      await page.goto(`/#${route}`);
      for (let passage = 0; passage < 3; passage += 1) {
        if (passage) await page.reload();
        await expectNotBlank(page);
        await expect(page.getByText('Une erreur est survenue', { exact: true })).toBeHidden();
      }
      expect(errors.snapshot().pageError, route).toEqual([]);
      expect(errors.snapshot().consoleError, route).toEqual([]);
      errors.reset();
    });
  }

  // Non-régression fonctionnelle V4–V12 sur les surfaces clés.
  await test.step('V4/V5 — tableau de bord et carte', async () => {
    await page.goto('/#/');
    await expect(page.locator('main h1')).toContainText('Bonjour');
    await expect(page.locator('main').getByText('Taux de traitement').first()).toBeVisible();
    await page.goto('/#/carte');
    await expect(page.locator('.leaflet-container').first()).toBeVisible({ timeout: 15_000 });
    await expectNoOverflow(page);
  });

  await test.step('V6/V7 — fiche et formulaire avancé', async () => {
    await page.goto(`/#/anomalies/${testServer.refs.ids[0]}`);
    await expect(page.locator('[data-photo-comparison]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sans suite' })).toBeVisible();
    await page.goto('/#/anomalies/nouvelle');
    await expect(page.locator('#smart-paste')).toBeVisible();
    await page.locator('details[data-advanced] summary').click();
    await expect(page.getByText('Agent affecté (automatique)')).toBeVisible();
    const corps = await page.locator('body').innerText();
    expect(corps).not.toMatch(/vérification|vérifiée?/i);
  });

  await test.step('V11/V12 — synthèses et photos avant/après', async () => {
    await page.goto('/#/syntheses');
    await expect(page.getByRole('heading', { name: 'Modèles de synthèse' })).toBeVisible({ timeout: 15_000 });
    await page.goto(`/#/anomalies/${paire.id}`);
    await expect(page.locator('[data-photo-group="avant"]')).toBeVisible();
    await expect(page.locator('[data-photo-group="apres"]')).toBeVisible();
    await expect(page.locator('[data-photo-comparator]')).toBeVisible();
    await expect.poll(() => page.locator('[data-photo-comparator] img').first().evaluate((element) => element.naturalWidth)).toBeGreaterThan(0);
  });

  await test.step('largeurs — aucun débordement sur les surfaces clés', async () => {
    for (const route of ['/anomalies', `/anomalies/${testServer.refs.ids[0]}`, '/syntheses']) {
      await page.goto(`/#${route}`);
      for (const largeur of LARGEURS) {
        await page.setViewportSize({ width: largeur, height: 1000 });
        await expectNoOverflow(page);
      }
    }
  });

  expect(errors.snapshot().pageError).toEqual([]);
  expect(errors.snapshot().consoleError).toEqual([]);
});
