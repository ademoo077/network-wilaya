import { test, expect } from './fixture.js';
import { authenticate, collectErrors } from './helpers.js';

test('Synthèse — ouvrir un modèle système en édition crée la copie sans erreur d’enregistrement', async ({ page, baseURL }) => {
  await authenticate(page, baseURL, 'operateur');
  const errors = collectErrors(page);
  await page.goto('/#/syntheses');
  await expect(page.getByRole('heading', { name: 'Modèles de synthèse' })).toBeVisible({ timeout: 15_000 });
  const hebdoCard = page.locator('[data-testid^="modele-"]').filter({ has: page.getByRole('heading', { name: 'Synthèse hebdomadaire standard' }) });
  const id = (await hebdoCard.getAttribute('data-testid')).replace('modele-', '');

  // Ouverture directe en édition d’un modèle système → copie-écriture automatique.
  await page.goto(`/#/syntheses/${id}?personnaliser=1`);
  await expect(page.getByRole('heading', { name: 'Ma synthèse hebdomadaire' })).toBeVisible({ timeout: 15_000 });
  await page.locator('[data-testid^="widget-"]').first().waitFor({ state: 'visible', timeout: 35_000 });

  // Modifier un élément : ajouter un widget depuis la galerie.
  await page.getByRole('button', { name: /Ajouter un widget/ }).click();
  await page.getByRole('dialog', { name: /Galerie de widgets/ }).getByRole('button', { name: /Fiches reçues/ }).first().click();
  await page.waitForFunction(() => document.querySelectorAll('[data-testid^="widget-"]').length > 3, { timeout: 20_000 });

  // Enregistrer → aucune erreur, brouillon vidé.
  await page.getByRole('button', { name: /Enregistrer/ }).first().click();
  await expect(page.getByText(/enregistrée/i)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('alert').filter({ hasText: /Enregistrement à reprendre/ })).toHaveCount(0);
  expect(errors.snapshot().pageError).toEqual([]);
  expect(errors.snapshot().consoleError).toEqual([]);
});

test('Synthèse — le style de chaque élément est modifiable et survit à l’enregistrement', async ({ page, baseURL }) => {
  await authenticate(page, baseURL, 'operateur');
  const errors = collectErrors(page);
  await page.goto('/#/syntheses');
  await expect(page.getByRole('heading', { name: 'Modèles de synthèse' })).toBeVisible({ timeout: 15_000 });
  const hebdoCard = page.locator('[data-testid^="modele-"]').filter({ has: page.getByRole('heading', { name: 'Synthèse hebdomadaire standard' }) });
  const id = (await hebdoCard.getAttribute('data-testid')).replace('modele-', '');
  await page.goto(`/#/syntheses/${id}?personnaliser=1`);
  await expect(page.getByRole('heading', { name: 'Ma synthèse hebdomadaire' })).toBeVisible({ timeout: 15_000 });
  await page.locator('[data-testid^="widget-"]').first().waitFor({ state: 'visible', timeout: 35_000 });

  // Ouvrir l’inspecteur du premier widget.
  await page.locator('[data-testid^="widget-"]').first().getByRole('button', { name: /Plus d’actions/ }).click();
  await page.getByRole('button', { name: /Éditer le bloc/ }).click();
  await expect(page.getByRole('dialog', { name: /Inspecteur/ })).toBeVisible();

  // Corriger le style : alignement centré + accent vert institutionnel.
  await page.getByLabel('Alignement du contenu').selectOption('center');
  await page.getByLabel('Accent').selectOption('brand');
  // L’autosave enregistre ; on attend la confirmation et l’absence d’erreur.
  await expect(page.getByText(/enregistrée/i)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('alert').filter({ hasText: /Enregistrement à reprendre/ })).toHaveCount(0);

  // Le style persiste après rechargement.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Ma synthèse hebdomadaire' })).toBeVisible({ timeout: 15_000 });
  await page.locator('[data-testid^="widget-"]').first().waitFor({ state: 'visible', timeout: 35_000 });
  await expect(page.locator('[data-widget-card]').first()).toHaveAttribute('data-style-align', 'center');
  await expect(page.locator('[data-widget-card]').first()).toHaveAttribute('data-style-accent', 'brand');
  expect(errors.snapshot().pageError).toEqual([]);
  expect(errors.snapshot().consoleError).toEqual([]);
});
