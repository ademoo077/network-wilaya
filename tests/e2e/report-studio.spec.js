import { test, expect } from './fixture.js';
import { authenticate, collectErrors } from './helpers.js';
import { expectAccessible, expectNoOverflow } from './geometry.js';

test('Rapport — studio unifié, semaine héritée, modèles et laboratoire', async ({ page, baseURL }) => {
  await authenticate(page, baseURL, 'operateur');
  const errors = collectErrors(page);
  const evaluation = page.waitForRequest((request) => request.method() === 'POST' && request.url().endsWith('/api/syntheses/evaluer'));

  await page.goto('/#/rapport?semaine=2026-11-15');
  await expect(page.getByRole('heading', { name: 'Studio de synthèses' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel('Semaine du rapport')).toHaveValue('2026-11-15');
  await expect(page.getByRole('heading', { name: 'Synthèse hebdomadaire standard' })).toBeVisible({ timeout: 15_000 });
  await page.locator('[data-testid^="widget-"]').first().waitFor({ state: 'visible', timeout: 20_000 });

  const request = await evaluation;
  const requetes = request.postDataJSON().requetes;
  expect(requetes.length).toBeGreaterThan(0);
  expect(requetes.every((item) => item.periode?.mode === 'plage' && item.periode.debut === '2026-11-15' && item.periode.fin === '2026-11-21')).toBe(true);

  await page.getByRole('button', { name: 'Modèles' }).click();
  await expect(page.getByRole('heading', { name: 'Modèles de synthèse' })).toBeVisible();
  await page.getByRole('button', { name: 'Laboratoire' }).click();
  await expect(page.getByRole('heading', { name: 'Laboratoire de synthèses' })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Composer' }).click();
  await expect(page.getByRole('heading', { name: 'Synthèse hebdomadaire standard' })).toBeVisible({ timeout: 15_000 });

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Studio de synthèses' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel('Semaine du rapport')).toHaveValue('2026-11-15');

  await page.getByRole('button', { name: 'Imprimer' }).click();
  const printDialog = page.getByRole('dialog', { name: 'Préparer le rapport officiel' });
  await expect(printDialog).toBeVisible();
  await printDialog.getByLabel('Titre du rapport').fill('Rapport officiel — recette');
  await printDialog.getByLabel('Référence').fill('REC-2026-11');
  await printDialog.getByLabel('Orientation A4').selectOption('landscape');
  await printDialog.getByRole('button', { name: 'Annuler' }).click();
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('heading', { name: 'Rapport officiel — recette' })).toBeVisible();
  await expect(page.locator('[data-print-document]')).toHaveClass(/print-landscape/);
  await page.emulateMedia({ media: 'screen' });

  await expectAccessible(page);
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoOverflow(page);
  }
  expect(errors.snapshot().pageError).toEqual([]);
  expect(errors.snapshot().consoleError).toEqual([]);
});

test('Rapport — un ancien identifiant revient au modèle hebdomadaire', async ({ page, baseURL }) => {
  await authenticate(page, baseURL, 'operateur');
  await page.goto('/#/rapport?semaine=2026-11-15&outil=composition&modele=999999');
  await expect(page.getByRole('heading', { name: 'Synthèse hebdomadaire standard' })).toBeVisible({ timeout: 15_000 });
  await expect(page).not.toHaveURL(/modele=999999/);
  await expect(page.getByText('Ressource introuvable', { exact: true })).toHaveCount(0);
});
