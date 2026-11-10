import { test, expect } from './fixture.js';
import { authenticate, collectErrors } from './helpers.js';
import { expectNoOverflow } from './geometry.js';

test('Vues enregistrées — sauvegarde, rechargement, application et suppression', async ({ page, baseURL }) => {
  await authenticate(page, baseURL); const errors = collectErrors(page);
  await page.goto('/#/anomalies');
  await page.getByLabel('Coordonnées GPS', { exact: true }).selectOption('absent');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: 'Enregistrer la vue' }).click();
  const form = page.locator('form').filter({ has: page.getByLabel('Nom de la vue') });
  await form.getByLabel('Nom de la vue').fill('Sans position');
  await form.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText('Vue « Sans position » enregistrée')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Appliquer la vue Sans position' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Appliquer la vue Sans position' }).click();
  await expect(page.getByLabel('Coordonnées GPS', { exact: true })).toHaveValue('absent');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  expect(new URL(page.url()).hash).toContain('gps=absent');
  await page.getByRole('button', { name: 'Supprimer la vue Sans position' }).click();
  await expect(page.getByRole('button', { name: 'Appliquer la vue Sans position' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Appliquer la vue Sans position' })).toHaveCount(0);
  expect(errors.snapshot().pageError).toEqual([]);
  for (const width of [390, 1024, 1440]) { await page.setViewportSize({ width, height: 900 }); await expectNoOverflow(page); }
});

test('File de travail — page « À faire » et cloche alignées sur les mêmes compteurs', async ({ page, baseURL }) => {
  await authenticate(page, baseURL); const errors = collectErrors(page);
  await page.goto('/#/a-faire');
  await expect(page.getByRole('heading', { name: 'À faire' })).toBeVisible();
  await expect(page.getByText(/élément\(s\) à traiter/)).toBeVisible();
  const links = page.locator('main ul[aria-label="À faire"] a');
  await expect(links.first()).toBeVisible();
  const count = await links.count(); expect(count).toBeGreaterThan(0);
  const first = links.first(); const total = Number((await first.locator('span.tabular-nums').textContent()).trim());
  expect(total).toBeGreaterThan(0);
  await first.click();
  await expect(page).toHaveURL(/#\/anomalies\?/);
  await expect(page.locator('tbody tr')).toHaveCount(total);
  await page.goto('/#/a-faire');
  await page.getByRole('button', { name: /Notifications/ }).click();
  await expect(page.locator('header a[href="#/a-faire"]')).toBeVisible();
  for (const width of [390, 1024, 1440]) { await page.setViewportSize({ width, height: 900 }); await expectNoOverflow(page); }
  expect(errors.snapshot().pageError).toEqual([]);
});
