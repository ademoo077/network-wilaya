import { test, expect } from './fixture.js';
import { authenticate, collectErrors } from './helpers.js';
import { expectAccessible, expectNoOverflow } from './geometry.js';

test.beforeEach(async ({ page, baseURL }) => { await authenticate(page, baseURL); await page.goto('/#/carte'); });

test('carte : filtres territoriaux, recherche, compte exact et lien vers la liste', async ({ page }) => {
  await expect(page.getByText('2 anomalie(s) géolocalisée(s)', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '1 anomalie(s) sans position — non affichées' })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Rechercher sur la carte', exact: true }).fill('demo-0');
  await expect(page.getByText('1 anomalie(s) géolocalisée(s)', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/q=demo-0/);
  await page.getByRole('button', { name: 'Réinitialiser les filtres', exact: true }).click();
  await page.locator('#map-daira').selectOption({ label: '[DEMO] Autre daïra' });
  await expect(page.getByText('0 anomalie(s) géolocalisée(s)', { exact: true })).toBeVisible();
  await page.reload(); await expect(page.locator('#map-daira')).toHaveValue('2');
  await expect(page.getByRole('link', { name: 'Ouvrir cette liste', exact: true })).toHaveAttribute('href', /daira=2/);
});

test('carte : sélection synchronisée, densité, recentrage et panneau replié accessible', async ({ page, testServer }) => {
  const errors = collectErrors(page);
  const row = page.locator(`[data-map-row="${testServer.refs.ids[0]}"]`);
  await row.click(); await expect(row).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.leaflet-popup-content')).toContainText('ANM-');
  await page.getByRole('checkbox', { name: 'Densité', exact: true }).check();
  await expect(page.locator('.leaflet-heatmap-layer')).toBeVisible();
  await page.getByRole('button', { name: 'Afficher tous les points', exact: true }).click();
  await page.getByRole('button', { name: 'Filtres', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Carte des anomalies', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Filtres', exact: true }).click();
  for (const width of [390, 768, 1024, 1440]) { await page.setViewportSize({ width, height: 900 }); await expectNoOverflow(page); }
  await expectAccessible(page); expect(errors.errors.pageError).toEqual([]); expect(errors.errors.consoleError).toEqual([]);
});
