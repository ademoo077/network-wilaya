import { test, expect } from './fixture.js';
import { authenticate, collectErrors } from './helpers.js';
import { expectNoOverflow } from './geometry.js';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const files = (...names) => names.map((name) => ({ name, mimeType: 'image/png', buffer: PNG }));

async function ouvrirListe(page, baseURL, role = 'admin') {
  await authenticate(page, baseURL, role);
  await page.goto('/#/anomalies');
  await expect(page.locator('tbody tr').first()).toBeVisible();
}

test('171 — liste Standard/Complet, table fixe, colonnes persistées et photos 48 px', async ({ page, baseURL }) => {
  await page.addInitScript(() => {
    window.__cls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__cls += entry.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await ouvrirListe(page, baseURL);
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator('button[data-list-mode="standard"]')).toBeVisible();
  expect(await page.locator('table').first().evaluate((table) => getComputedStyle(table).tableLayout)).toBe('fixed');
  const headers = await page.locator('thead th').allTextContents();
  for (const label of ['Référence', 'Date', 'Statut', 'Photos', 'Catégorie › Type', 'Commune / Daïra', 'Agent', 'EPIC', 'Priorité', 'Source', 'Actions']) {
    expect(headers.some((text) => text.includes(label)), `Colonne ${label}`).toBe(true);
  }
  const thumb = page.locator('[data-photo-cell] > *').first();
  const box = await thumb.boundingBox();
  expect(Math.round(box.width)).toBe(48);
  expect(Math.round(box.height)).toBe(48);
  const image = page.locator('[data-photo-cell] img').first();
  if (await image.count()) expect(await image.evaluate((node) => node.naturalWidth)).toBeGreaterThan(0);
  await expectNoOverflow(page);
  await page.locator('[data-column-picker] summary').click();
  await page.getByLabel('Colonne : Priorité').uncheck();
  await expect(page.getByRole('columnheader', { name: 'Priorité' })).toHaveCount(0);
  await page.reload();
  await expect(page.locator('button[data-list-mode="standard"]')).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Priorité' })).toHaveCount(0);
  await page.locator('button[data-list-mode="complet"]').click();
  await expect(page.locator('button[data-list-mode="complet"]')).toHaveAttribute('aria-pressed', 'true');
  const fullHeaders = await page.locator('thead th').allTextContents();
  for (const label of ['Plateforme', 'Catégorie', 'Type', 'Daïra', 'Lien de la publication', 'Coordonnées GPS']) {
    expect(fullHeaders.some((text) => text.includes(label)), `Colonne ${label}`).toBe(true);
  }
  await page.reload();
  await expect(page.locator('button[data-list-mode="complet"]')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.__cls)).toBeLessThan(0.1);
  expect(errors.errors.pageError).toEqual([]);
  expect(errors.errors.consoleError).toEqual([]);
});

test('172 — aperçu rapide : comparateur, navigation clavier, persistance du mode et ouverture', async ({ page, baseURL, testServer }) => {
  await authenticate(page, baseURL);
  for (const id of testServer.refs.ids) {
    await page.goto(`/#/anomalies/${id}`);
    await page.locator('[data-photo-upload="avant"]').setInputFiles(files('apercu-avant.png'));
    await page.locator('[data-photo-upload="apres"]').setInputFiles(files('apercu-apres.png'));
    await expect(page.locator('[data-photo-comparator]')).toBeVisible();
  }
  await page.goto('/#/anomalies');
  await expect(page.locator('tbody tr').first()).toBeVisible();
  const errors = collectErrors(page);
  const count = await page.locator('tbody tr').count();
  const row = page.locator('tbody tr').first();
  await row.getByRole('button', { name: 'Aperçu de la fiche' }).click();
  await expect(page.locator('[data-quick-view]')).toBeVisible();
  await expect(page.locator('[data-quick-view] [data-photo-comparator]')).toBeVisible();
  const comparatorImages = page.locator('[data-quick-view] [data-photo-comparator] img');
  expect(await comparatorImages.count()).toBeGreaterThan(0);
  for (const image of await comparatorImages.all()) expect(await image.evaluate((node) => node.naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator('[data-quick-view-counter]')).toHaveText(`1 / ${count}`);
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('[data-quick-view-counter]')).toHaveText(`2 / ${count}`);
  await page.getByRole('button', { name: 'Photo précédente' }).first().click();
  await expect(page.locator('[data-quick-view-counter]')).toHaveText(`1 / ${count}`);
  await page.locator('[data-quick-view] [data-photo-mode="fade"]').click();
  await expect(page.locator('[data-quick-view] [data-photo-mode="fade"]')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-quick-view]')).toHaveCount(0);
  await page.keyboard.press('p');
  await expect(page.locator('[data-quick-view]')).toBeVisible();
  await expect(page.locator('[data-quick-view] [data-photo-mode="fade"]')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('link', { name: 'Ouvrir la fiche' }).click();
  await expect(page).toHaveURL(/#\/anomalies\/\d+/);
  expect(errors.errors.pageError).toEqual([]);
});

test('173 — filtres repliables, période unique, densité, erreur récupérable et RTL sans débordement', async ({ page, baseURL }) => {
  let failList = false;
  await page.route(/\/api\/anomalies(?:\?|$)/, async (route) => {
    if (failList) await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { code: 'TEST_LISTE', message: 'Échec simulé de la liste' } }) });
    else await route.continue();
  });
  await ouvrirListe(page, baseURL);
  const errors = collectErrors(page);
  const filters = page.locator('[data-filters]');
  await expect(filters.locator('select').first()).toBeVisible();
  await filters.locator('summary').click();
  await expect(filters.locator('select').first()).toBeHidden();
  await filters.locator('summary').click();
  await page.locator('[data-list-period]').selectOption('30');
  await expect(page).toHaveURL(/periode=30/);
  await expect(page).toHaveURL(/from=\d{4}-\d{2}-\d{2}/);
  await expect(page.getByRole('button', { name: '30 jours' })).toBeVisible();
  await page.getByRole('button', { name: /Réinitialiser les filtres/ }).click();
  await expect(page).not.toHaveURL(/periode=/);
  await page.locator('[data-density="compact"]').click();
  await expect(page.locator('[data-list-density="compact"]')).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-density="compact"]')).toHaveAttribute('aria-pressed', 'true');
  failList = true;
  await page.locator('[data-list-period]').selectOption('7');
  await expect(page.getByText('Échec simulé de la liste')).toBeVisible();
  failList = false;
  await page.getByRole('button', { name: 'Réessayer' }).click();
  await expect(page.locator('tbody tr').first()).toBeVisible();
  await page.goto('/#/anomalies?q=INTROUVABLE-V13');
  await expect(page.getByText(/Aucune anomalie ne correspond/)).toBeVisible();
  await page.evaluate(() => localStorage.setItem('anm-language', 'ar'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  for (const width of [390, 768, 1024, 1440]) { await page.setViewportSize({ width, height: 900 }); await expectNoOverflow(page); }
  expect(errors.errors.pageError).toEqual([]);
});
