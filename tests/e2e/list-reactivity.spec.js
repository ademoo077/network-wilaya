import { setTimeout as delay } from 'node:timers/promises';
import { test, expect } from './fixture.js';
import { authenticate, collectErrors } from './helpers.js';
import { expectNoOverflow } from './geometry.js';

test('49 — statut instantané, requête lente et restauration exacte après erreur', async ({ page, baseURL, testServer }) => {
  await authenticate(page, baseURL); const id = testServer.refs.ids[0]; const errors = collectErrors(page);
  await page.route(`**/api/anomalies/${id}/statut`, async (route) => {
    await delay(1500); await route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ error: { code: 'TEST_REJECT', message: 'Refus simulé pour vérifier le retour arrière' } }) });
  });
  await page.goto('/#/anomalies');
  const row = page.locator('tbody tr').filter({ hasText: 'ANM-' }).filter({ has: page.locator('bdi', { hasText: '00001' }) });
  const status = row.locator('select').first(); await expect(status).toHaveValue('non_traite');
  await status.selectOption('en_cours');
  await expect(status).toHaveValue('en_cours', { timeout: 100 }); await expect(status).toBeDisabled({ timeout: 100 });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Refus simulé pour vérifier le retour arrière')).toBeVisible();
  await expect(status).toHaveValue('non_traite'); await expect(status).toBeEnabled();
  expect(errors.errors.pageError).toEqual([]);
  expect(errors.errors.consoleError.filter((error) => !error.text.includes('422'))).toEqual([]);
});

test('47 — filtre GPS, résultats et compteurs SQL cohérents', async ({ page, baseURL }) => {
  await authenticate(page, baseURL); await page.goto('/#/carte');
  await page.getByRole('link', { name: /1 anomalie.*sans position/ }).click();
  await expect(page.getByLabel('Coordonnées GPS', { exact: true })).toHaveValue('absent');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByLabel('Coordonnées GPS', { exact: true }).selectOption('present');
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await expect(page.getByRole('button', { name: /^Tout 2$/ })).toBeVisible();
  await page.getByRole('button', { name: /^Traitées? 1$/ }).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  for (const width of [390, 768, 1024, 1440]) { await page.setViewportSize({ width, height: 900 }); await expectNoOverflow(page); }
});
