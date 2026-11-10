import { test, expect } from './fixture.js';
import { authenticate, collectErrors } from './helpers.js';
import { expectNoOverflow } from './geometry.js';

test('50 — diagnostic de connectivité sortante typé et actionnable', async ({ page, baseURL }) => {
  await authenticate(page, baseURL); const errors = collectErrors(page);
  await page.route('**/api/admin/connectivity', (route) => route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ ok: false, code: 'NETWORK_UNAVAILABLE', dns: false, https: false, proxy: false, at: new Date().toISOString() }) }));
  await page.goto('/#/admin/sante');
  await expect(page.getByText('Connectivité sortante')).toBeVisible();
  await page.getByRole('button', { name: 'Tester' }).click();
  await expect(page.getByText(/OUTBOUND_PROXY/)).toBeVisible();
  await expect(page.getByText('DNS', { exact: true })).toBeVisible();
  await expect(page.getByText('Non', { exact: true }).first()).toBeVisible();
  expect(errors.snapshot().pageError).toEqual([]);
  for (const width of [390, 1024, 1440]) { await page.setViewportSize({ width, height: 900 }); await expectNoOverflow(page); }
});

test('51 — une erreur client provoquée apparaît dans Santé › Erreurs client', async ({ page, baseURL }) => {
  await authenticate(page, baseURL);
  await page.goto('/#/');
  const posted = page.waitForResponse((response) => response.url().endsWith('/api/client-errors') && response.status() === 200);
  await page.evaluate(() => window.dispatchEvent(new ErrorEvent('error', {
    message: 'E2E erreur client volontaire', error: new Error('E2E erreur client volontaire'),
  })));
  await posted;
  await page.goto('/#/admin/sante');
  await expect(page.getByText('E2E erreur client volontaire').first()).toBeVisible();
  const row = page.locator('details').filter({ hasText: 'E2E erreur client volontaire' }).first();
  await row.locator('summary').click();
  await expect(row.locator('pre')).toBeVisible();
});
