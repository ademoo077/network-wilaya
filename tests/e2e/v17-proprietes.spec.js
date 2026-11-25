import { test, expect } from './fixture.js';
import { authenticate, collectErrors } from './helpers.js';

test('V17 — sous-titre et note édités dans l’inspecteur sont rendus et imprimés', async ({ page, baseURL }) => {
  await authenticate(page, baseURL);
  const errors = collectErrors(page);
  await page.goto('/#/syntheses');
  await expect(page.getByRole('heading', { name: 'Modèles de synthèse' })).toBeVisible({ timeout: 15_000 });
  await page.locator('[data-testid^="modele-"]').filter({ has: page.getByRole('heading', { name: 'Synthèse hebdomadaire standard' }) })
    .getByRole('button', { name: /Personnaliser/ }).click();
  await page.locator('[data-testid^="widget-"]').first().waitFor({ state: 'visible', timeout: 35_000 });

  await page.locator('[data-testid^="widget-"]').first().getByRole('button', { name: /Plus d’actions/ }).click();
  await page.getByRole('button', { name: /Éditer le bloc/ }).click();
  const inspecteur = page.getByRole('dialog', { name: /Inspecteur/ });
  await expect(inspecteur).toBeVisible();
  await inspecteur.getByLabel('Sous-titre', { exact: true }).fill('Sous-titre de contrôle');
  await inspecteur.getByLabel('Note', { exact: true }).fill('Note de contrôle');
  await inspecteur.getByRole('button', { name: 'Fermer' }).click();
  await expect(page.getByText(/enregistrée/i)).toBeVisible({ timeout: 15_000 });

  const widget = page.locator('[data-widget-card]').first();
  await expect(widget.locator('[data-widget-sous-titre]')).toHaveText('Sous-titre de contrôle');
  await expect(widget.locator('[data-widget-note]')).toHaveText('Note de contrôle');

  await page.reload();
  await page.locator('[data-widget-card]').first().waitFor({ state: 'visible', timeout: 35_000 });
  const apresRechargement = page.locator('[data-widget-card]').first();
  await expect(apresRechargement.locator('[data-widget-sous-titre]')).toHaveText('Sous-titre de contrôle');
  await expect(apresRechargement.locator('[data-widget-note]')).toHaveText('Note de contrôle');

  await page.getByRole('button', { name: /^Imprimer/ }).first().click();
  const documentImpression = page.locator('[data-print-document]');
  await expect(documentImpression.locator('[data-widget-sous-titre]').first()).toHaveText('Sous-titre de contrôle');
  await expect(documentImpression.locator('[data-widget-note]').first()).toHaveText('Note de contrôle');
  expect(errors.snapshot().pageError).toEqual([]);
  expect(errors.snapshot().consoleError).toEqual([]);
});
