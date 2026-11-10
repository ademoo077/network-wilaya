import { test, expect } from './fixture.js';
import { authenticate, pasteText } from './helpers.js';
import { expectCompactCards } from './geometry.js';

test.beforeEach(async ({ page, baseURL }) => { await authenticate(page, baseURL); });

test('C4 / 43 — une valeur manuelle reste protégée et une suggestion est proposée', async ({ page }) => {
  await page.goto('/#/anomalies/nouvelle');
  await page.getByLabel('Plateforme', { exact: true }).selectOption('instagram');
  await pasteText(page, '#smart-paste', 'https://facebook.com/reel/1234567');
  await expect(page.getByLabel('Plateforme', { exact: true })).toHaveValue('instagram');
  await expect(page.getByRole('button', { name: /Remplacer/ }).first()).toBeVisible();
});
test('C7 / 46 — Motif absent à la création', async ({ page }) => {
  await page.goto('/#/anomalies/nouvelle');
  await expect(page.getByLabel('Lien de la publication', { exact: false })).toBeVisible();
  await expect(page.getByLabel('Motif', { exact: true })).toBeHidden();
});
test('C9 / 47 — légende dans le panneau et attribution compacte', async ({ page }) => {
  await page.goto('/#/carte');
  await expect(page.locator('main aside').getByText('Légende')).toBeVisible();
  expect(await page.locator('.leaflet-control-attribution').evaluate((el) => getComputedStyle(el).fontSize)).toBe('11px');
});
test('C10 / 47 — compteur des anomalies sans position', async ({ page }) => {
  await page.goto('/#/carte');
  const link = page.getByRole('link', { name: /1 anomalie.*sans position/ });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', '#/anomalies?gps=absent');
});
test('C11 / 48 — cartes compactes et activité décrite', async ({ page }) => {
  await page.goto('/#/');
  await expect(page.locator('main h1')).toContainText('Bonjour');
  await expectCompactCards(page);
  await expect(page.getByText(/3 modifications/).first()).toBeVisible();
  await expect(page.locator('[data-status-legend]').first()).toBeVisible();
});
test('C12 / 49 — filtre de période réactif sans disparition du titre', async ({ page }) => {
  await page.goto('/#/');
  await expect(page.locator('main h1')).toContainText('Bonjour');
  await page.route('**/api/stats/**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500)); await route.continue();
  });
  await page.getByRole('button', { name: 'Toutes périodes', exact: true }).click();
  await expect(page.locator('main h1')).toContainText('Bonjour', { timeout: 100 });
  await expect(page.locator('[aria-busy="true"]').first()).toBeVisible({ timeout: 100 });
});
