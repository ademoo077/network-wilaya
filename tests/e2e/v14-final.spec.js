import { test, expect } from './fixture.js';
import { authenticate, collectErrors, loginAs } from './helpers.js';
import { expectActionBarClear, expectNoOverflow } from './geometry.js';

async function callApi(base, session, method, path, body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: session.cookie, 'X-CSRF-Token': session.csrf },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

async function seedPage(base, session, refs, overrides = {}) {
  const result = await callApi(base, session, 'POST', '/api/reseaux/rapide', {
    reseau: 'facebook', page_url: 'https://facebook.com/v14-page-par-defaut',
    nom: '[DEMO] Page Par Défaut', nature: 'page', daira_id: refs.daira, commune_id: refs.commune, ...overrides,
  });
  expect(result.status, JSON.stringify(result.body)).toBeLessThan(300);
  return result.body.item;
}

async function choose(page, id, label) {
  await page.locator(`#${id}`).fill(label);
  await page.getByRole('option', { name: label, exact: true }).click();
}

async function completeForm(page, link) {
  await page.locator('#lien_url').fill(link);
  await choose(page, 'domaine_id', 'نفايات منزلية');
  await choose(page, 'type_id', 'مفرغة عشوائية');
  await choose(page, 'daira_id', '[DEMO] Daïra');
  await choose(page, 'commune_id', '[DEMO] Commune');
}

test('184 — Page source persistée, visible en fiche, filtrable en liste et comptée en statistiques', async ({ page, baseURL, testServer }) => {
  const session = await loginAs(baseURL, 'admin');
  const source = await seedPage(baseURL, session, testServer.refs, {
    page_url: 'https://facebook.com/page-persistee', nom: '[DEMO] Page Persistée',
  });
  await authenticate(page, baseURL);
  await page.goto('/#/anomalies/nouvelle');
  await completeForm(page, 'https://facebook.com/page-persistee/posts/12');
  await expect(page.locator('[data-testid="source-picker"]')).toContainText('[DEMO] Page Persistée');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page).toHaveURL(/#\/anomalies\/\d+/);
  const id = Number(page.url().match(/#\/anomalies\/(\d+)/)?.[1]);
  expect(id).toBeGreaterThan(0);
  await expect(page.getByText('[DEMO] Page Persistée').first()).toBeVisible();

  const detail = await callApi(baseURL, session, 'GET', `/api/anomalies/${id}`);
  expect(detail.body.item.source_reseau_id).toBe(source.id);
  expect(detail.body.item.source_nom).toBe('[DEMO] Page Persistée');

  await page.goto('/#/anomalies');
  await page.locator('#source').fill('[DEMO] Page Persistée');
  await page.getByRole('option', { name: /\[DEMO\] Page Persistée/ }).click();
  await expect(page.getByRole('row').filter({ hasText: detail.body.item.reference })).toBeVisible();

  const stats = await callApi(baseURL, session, 'GET', `/api/stats/group?by=source&source=${source.id}&all_periods=1`);
  expect(stats.status).toBe(200);
  expect(stats.body.item.rows.some((row) => String(row.id) === String(source.id) && row.total >= 1)).toBe(true);
});

test('185 — Page en corbeille : proposition de restauration puis sélection', async ({ page, baseURL, testServer }) => {
  const session = await loginAs(baseURL, 'admin');
  const source = await seedPage(baseURL, session, testServer.refs, {
    page_url: 'https://facebook.com/page-corbeille', nom: '[DEMO] Page En Corbeille',
  });
  const corbeille = await callApi(baseURL, session, 'DELETE', `/api/reseaux-sociaux/${source.id}`);
  expect(corbeille.status).toBe(200);
  const identification = await callApi(baseURL, session, 'POST', '/api/reseaux/identifier', {
    url: 'https://www.facebook.com/page-corbeille/posts/4',
  });
  expect(identification.body.supprimee?.id).toBe(source.id);

  const errors = collectErrors(page);
  await authenticate(page, baseURL);
  await page.goto('/#/anomalies/nouvelle');
  await page.locator('#lien_url').fill('https://www.facebook.com/page-corbeille/posts/4');
  const restauration = page.getByText('Restaurer la page', { exact: true });
  await expect(restauration).toBeVisible();
  await page.getByRole('button', { name: '[DEMO] Page En Corbeille' }).click();
  await expect(page.locator('[data-testid="source-message"]')).toContainText('Page restaurée et sélectionnée');
  await expect(page.locator('[data-testid="source-picker"]')).toContainText('[DEMO] Page En Corbeille');
  expect(errors.snapshot().pageError).toEqual([]);
});

async function verifierGeometrie(page, lang, theme) {
  const context = page.context();
  for (const width of [390, 768, 1024, 1440]) {
    await context.addInitScript(([l, th]) => {
      localStorage.setItem('anm-language', l); localStorage.setItem('anm-theme', th);
    }, [lang, theme]);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/#/anomalies/nouvelle');
    await page.locator('#lien_url').fill('https://facebook.com/page-geometrie/posts/9');
    await expect(page.locator('[data-testid="source-picker"]')).toContainText('[DEMO] Page Géométrie');
    await expect(page.locator('#root h1').first()).toBeVisible();
    await expectNoOverflow(page);
    await expectActionBarClear(page);
    await page.locator('#source_reseau_id').click();
    await page.getByRole('option', { name: lang === 'fr' ? '+ Ajouter une page' : '+ إضافة صفحة' }).click();
    await expect(page.locator('[data-testid="source-add-panel"]')).toBeVisible();
    await expectNoOverflow(page);
    await expectActionBarClear(page);
    if (width === 1440) {
      await page.reload();
      await expect(page.locator('[data-testid="source-picker"]')).toBeVisible();
      await expect(page.locator('#root h1').first()).toBeVisible();
      await expectNoOverflow(page);
    }
  }
}

for (const [lang, titre] of [['fr', 'FR'], ['ar', 'AR RTL']]) {
  test(`188 — F5 sans blanc et géométrie ${titre}, clair/sombre, 390/768/1024/1440`, async ({ page, baseURL, testServer }) => {
    test.slow();
    const session = await loginAs(baseURL, 'admin');
    const source = await seedPage(baseURL, session, testServer.refs, {
      page_url: 'https://facebook.com/page-geometrie', nom: '[DEMO] Page Géométrie',
    });
    await authenticate(page, baseURL);
    for (const theme of ['light', 'dark']) await verifierGeometrie(page, lang, theme);
    expect(source.id).toBeGreaterThan(0);
  });
}
