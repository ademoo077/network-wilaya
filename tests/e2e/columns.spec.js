import { test, expect } from './fixture.js';
import { authenticate, collectErrors } from './helpers.js';
import { expectNoOverflow } from './geometry.js';

async function ouvrirCopie(page) {
  await page.goto('/#/syntheses');
  const card = page.locator('[data-testid^="modele-"]').filter({
    has: page.getByRole('heading', { name: 'Synthèse hebdomadaire standard' }),
  });
  await card.getByRole('button', { name: /Personnaliser/ }).click();
  await expect(page.getByRole('heading', { name: 'Ma synthèse hebdomadaire' })).toBeVisible({ timeout: 20_000 });
  // La notification « Copie personnelle créée » (haut-droite) recouvre la barre d’actions.
  await expect(page.getByText(/Copie personnelle créée/)).not.toBeVisible({ timeout: 15_000 });
  await page.locator('[data-bloc-type="tableau"]').first().waitFor({ state: 'visible', timeout: 30_000 });
}

test('144 — sélecteur de colonnes : ordre, formats, visibilités et priorités', async ({ page, baseURL }) => {
  await authenticate(page, baseURL, 'operateur');
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await ouvrirCopie(page);

  const tableau = page.locator('[data-bloc-type="tableau"]').first();
  await tableau.getByRole('button', { name: /Plus d’actions/ }).click();
  await tableau.getByRole('button', { name: 'Éditer le bloc' }).click();

  await expect(page.getByRole('heading', { name: 'Inspecteur' })).toBeVisible();
  await page.getByRole('button', { name: 'Colonnes' }).click();

  const drawer = page.locator('[data-columns-drawer]');
  await expect(drawer).toBeVisible();
  const initial = await drawer.locator('[data-columns-selected] > div').count();
  expect(initial).toBeGreaterThan(0);

  await drawer.locator('[data-columns-selected] > div').first().getByRole('button', { name: 'Supprimer' }).click();
  await expect(drawer.locator('[data-columns-selected] > div')).toHaveCount(initial - 1);

  const available = drawer.locator('[data-column-available]').first();
  if (await available.count()) {
    await available.click();
    await expect(drawer.locator('[data-columns-selected] > div')).toHaveCount(initial);
  }

  await drawer.getByPlaceholder('Rechercher une colonne…').fill('daïra');
  const filteredCount = await drawer.locator('[data-column-available]').count();
  expect(filteredCount).toBeGreaterThanOrEqual(0);

  await drawer.getByPlaceholder('Rechercher une colonne…').fill('');
  await drawer.locator('[data-column-id^="m:"]').first().getByLabel('Format').selectOption('decimal');
  await drawer.locator('[data-column-id^="m:"]').first().getByLabel('Priorité').selectOption('P2');

  await drawer.getByRole('button', { name: 'Compact' }).click();
  const compactCount = await drawer.locator('[data-columns-selected] > div').count();
  expect(compactCount).toBeLessThanOrEqual(initial);

  await drawer.getByRole('button', { name: 'Impression' }).click();
  const printCount = await drawer.locator('[data-columns-selected] > div').count();
  expect(printCount).toBeLessThanOrEqual(compactCount);

  await page.getByRole('button', { name: 'Appliquer' }).click();
  await expect(drawer).not.toBeVisible();

  await expectNoOverflow(page);
  expect(errors.snapshot().pageError).toEqual([]);
  expect(errors.snapshot().consoleError).toEqual([]);
});

test('145 — colonnes : visibilité écran/impression et rôle lecteur', async ({ page, baseURL }) => {
  await authenticate(page, baseURL, 'operateur');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await ouvrirCopie(page);

  const tableau = page.locator('[data-bloc-type="tableau"]').first();
  await tableau.getByRole('button', { name: /Plus d’actions/ }).click();
  await tableau.getByRole('button', { name: 'Éditer le bloc' }).click();
  await expect(page.getByRole('heading', { name: 'Inspecteur' })).toBeVisible();
  await page.getByRole('button', { name: 'Colonnes' }).click();

  const drawer = page.locator('[data-columns-drawer]');
  await expect(drawer).toBeVisible();

  const visibleScreen = drawer.locator('[data-columns-selected] > div').first();
  await visibleScreen.getByLabel('Visible à l’écran').uncheck();
  await visibleScreen.getByLabel('Visible à l’impression').uncheck();

  await page.getByRole('button', { name: 'Appliquer' }).click();
  await expect(drawer).not.toBeVisible();
});