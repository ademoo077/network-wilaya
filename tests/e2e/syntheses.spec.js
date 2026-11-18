import { test, expect } from './fixture.js';
import { authenticate, collectErrors } from './helpers.js';
import { expectAccessible, expectNoOverflow } from './geometry.js';

test('Synthèse — galerie, personnalisation, ajout de widget, figeage et édition', async ({ page, baseURL }) => {
  await authenticate(page, baseURL, 'operateur');
  const errors = collectErrors(page);
  await page.goto('/#/syntheses');
  await expect(page.getByRole('heading', { name: 'Modèles de synthèse' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId(/^modele-\d+$/).first()).toBeVisible();

  // Personnaliser le modèle système hebdomadaire → copie-écriture « Ma synthèse hebdomadaire ».
  const hebdoCard = page.locator('[data-testid^="modele-"]').filter({ has: page.getByRole('heading', { name: 'Synthèse hebdomadaire standard' }) });
  await hebdoCard.getByRole('button', { name: /Personnaliser/ }).click();
  await expect(page.getByRole('heading', { name: 'Ma synthèse hebdomadaire' })).toBeVisible({ timeout: 15_000 });
  // Attendre que l'évaluation des widgets du modèle soit terminée (cartes rendues avec data-testid).
  await page.locator('[data-testid^="widget-"]').first().waitFor({ state: 'visible', timeout: 35_000 });

  // Ajouter un widget depuis la galerie.
  await page.getByRole('button', { name: /Ajouter un widget/ }).click();
  const galerie = page.getByRole('dialog', { name: /Galerie de widgets/ });
  await expect(galerie).toBeVisible();
  const avant = await page.locator('[data-testid^="widget-"]').count();
  await galerie.getByRole('button', { name: /Fiches reçues/ }).first().click();
  await page.waitForFunction(() => document.querySelectorAll('[data-testid^="widget-"]').length > 3, { timeout: 20_000 });
  await expect(await page.locator('[data-testid^="widget-"]').count()).toBeGreaterThan(avant);

  // Enregistrer (autosave / manuel).
  await page.getByRole('button', { name: /Enregistrer/ }).first().click();
  await expect(page.getByText(/enregistrée/i)).toBeVisible({ timeout: 10_000 });

  // Figer l’édition → immuable.
  await page.getByRole('button', { name: /Figer l’édition/ }).click();
  await expect(page.getByText(/figée/i)).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: /Éditions/ }).click();
  const editions = page.getByRole('dialog', { name: /Éditions/ });
  await expect(editions).toBeVisible();
  await editions.getByRole('button', { name: /Ouvrir/ }).first().click();
  const figee = page.getByRole('dialog', { name: /Édition figée/ });
  await expect(figee).toBeVisible();
  await page.locator('[data-testid^="widget-"]').first().waitFor({ state: 'visible', timeout: 10_000 });

  await expectAccessible(page);
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoOverflow(page);
  }
  expect(errors.snapshot().pageError).toEqual([]);
  expect(errors.snapshot().consoleError).toEqual([]);
});

test('Synthèse — arabe RTL et lecteur ne peut pas personnaliser', async ({ page, baseURL }) => {
  await authenticate(page, baseURL, 'lecteur');
  await page.addInitScript(() => { localStorage.setItem('anm-language', 'ar'); });
  await page.goto('/#/syntheses');
  await expect(page.getByRole('heading', { name: 'نماذج التركيب' })).toBeVisible();
  await expect(page.getByRole('button', { name: /تخصيص/ })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 900 });
  await expectNoOverflow(page);
});

test('Synthèse — personnalisation compatible quand la route copy-on-write manque', async ({ page, baseURL }) => {
  await authenticate(page, baseURL, 'operateur');
  await page.route('**/api/syntheses/modeles/*/personnaliser', (route) => route.fulfill({
    status: 404,
    contentType: 'application/json',
    body: JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Ressource introuvable' } }),
  }));
  await page.goto('/#/syntheses');
  const card = page.locator('[data-testid^="modele-"]').filter({ has: page.getByRole('heading', { name: 'Synthèse hebdomadaire standard' }) });
  await card.getByRole('button', { name: /Personnaliser/ }).click();
  await expect(page.getByRole('heading', { name: 'Ma synthèse hebdomadaire' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Ressource introuvable', { exact: true })).toHaveCount(0);
});

test('Synthèse — autosave compatible avec le schéma serveur sans version', async ({ page, baseURL }) => {
  await authenticate(page, baseURL, 'operateur');
  let attempts = 0;
  await page.route('**/api/syntheses/modeles/*', async (route) => {
    const request = route.request();
    if (request.method() !== 'PUT') return route.continue();
    attempts += 1;
    const body = request.postDataJSON();
    if (attempts === 1) {
      expect(body.version).toBeTruthy();
      return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({
        error: { code: 'VALIDATION', message: 'Modèle invalide', fields: { version: 'Champ inconnu' } },
      }) });
    }
    expect(body.version).toBeUndefined();
    return route.continue();
  });
  await page.goto('/#/syntheses');
  const card = page.locator('[data-testid^="modele-"]').filter({ has: page.getByRole('heading', { name: 'Synthèse hebdomadaire standard' }) });
  await card.getByRole('button', { name: /Personnaliser/ }).click();
  await page.getByRole('button', { name: /Ajouter un widget/ }).click();
  await page.getByRole('dialog', { name: /Galerie de widgets/ }).getByRole('button', { name: /Fiches reçues/ }).first().click();
  await expect(page.getByRole('status').filter({ hasText: /enregistrée/i })).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(1_200);
  expect(attempts).toBe(2);
});

test('Synthèse — une validation refusée ne provoque pas une boucle autosave', async ({ page, baseURL }) => {
  await authenticate(page, baseURL, 'operateur');
  let attempts = 0;
  let refuseSave = true;
  await page.route('**/api/syntheses/modeles/*', (route) => {
    if (route.request().method() !== 'PUT') return route.continue();
    attempts += 1;
    if (!refuseSave) return route.continue();
    return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({
      error: { code: 'VALIDATION', message: 'Définition refusée', fields: { definition: 'Invalide' } },
    }) });
  });
  await page.goto('/#/syntheses');
  const card = page.locator('[data-testid^="modele-"]').filter({ has: page.getByRole('heading', { name: 'Synthèse hebdomadaire standard' }) });
  await card.getByRole('button', { name: /Personnaliser/ }).click();
  await page.getByRole('button', { name: /Ajouter un widget/ }).click();
  await page.getByRole('dialog', { name: /Galerie de widgets/ }).getByRole('button', { name: /Fiches reçues/ }).first().click();
  const saveError = page.getByRole('alert').filter({ hasText: /Enregistrement à reprendre/ });
  await expect(saveError).toBeVisible({ timeout: 10_000 });
  await expect(saveError.getByRole('button', { name: 'Réessayer maintenant' })).toBeVisible();
  await expect(page.getByText('Modèle invalide', { exact: true })).toHaveCount(0);
  await page.waitForTimeout(2_000);
  expect(attempts).toBe(1);
  await expect(page.getByRole('button', { name: /Enregistrer/ }).first()).toBeEnabled();
  refuseSave = false;
  await page.getByRole('button', { name: /Enregistrer/ }).first().click();
  await expect(page.getByRole('status').filter({ hasText: /enregistrée/i })).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: /Enregistrement à reprendre/ })).toHaveCount(0);
  expect(attempts).toBe(2);
  await page.reload();
  await expect(page.locator('[data-testid^="widget-"]')).toHaveCount(4);
});
