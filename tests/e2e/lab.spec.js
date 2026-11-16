import { test, expect } from './fixture.js';
import { authenticate, collectErrors } from './helpers.js';
import { expectAccessible, expectNoOverflow } from './geometry.js';

test('Laboratoire — évaluation automatique, dimension, filtre, tri et graphique', async ({ page, baseURL }) => {
  await authenticate(page, baseURL); const errors = collectErrors(page);
  await page.goto('/#/laboratoire');
  await expect(page.getByRole('heading', { name: 'Laboratoire de synthèses' })).toBeVisible();
  await expect(page.locator('[data-testid="lab-builder"]')).toBeVisible();
  await expect(page.locator('[data-testid="lab-kpi-recues"]')).toContainText('3', { timeout: 10_000 });
  await expect(page.locator('[data-testid="lab-results"]')).toBeVisible();

  await page.getByTestId('lab-add-dimension').click();
  await page.getByTestId('lab-dimension-1').selectOption('commune');
  await page.getByTestId('lab-evaluate').click();
  await expect(page.locator('[data-testid="lab-table"]')).toBeVisible();
  await expect(page.locator('[data-testid="lab-row"]')).toHaveCount(1);

  await page.getByTestId('lab-dimension-1').selectOption('statut');
  await page.getByTestId('lab-evaluate').click();
  await expect(page.locator('[data-testid="lab-row"]')).toHaveCount(2);
  await expect(page.locator('[data-testid="lab-chart"]')).toBeVisible();

  await page.getByTestId('lab-add-filter').click();
  const filterValue = page.getByLabel('Valeur 1').first();
  await filterValue.fill('Non traitées');
  await filterValue.press('Enter');
  await page.getByTestId('lab-evaluate').click();
  await expect(page.locator('[data-testid="lab-kpi-recues"]')).toContainText('2');
  await expect(page.locator('[data-testid="lab-row"]')).toHaveCount(1);

  await page.getByRole('button', { name: /Fiches reçues/ }).click();
  await expect(page.locator('th[aria-sort="descending"]')).toHaveCount(1);

  await expectAccessible(page);
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoOverflow(page);
  }
  expect(errors.snapshot().pageError).toEqual([]);
  expect(errors.snapshot().consoleError).toEqual([]);
});

test('Laboratoire — enregistrement, chargement et duplication de modèle', async ({ page, baseURL }) => {
  await authenticate(page, baseURL); const errors = collectErrors(page);
  await page.goto('/#/laboratoire');
  await expect(page.locator('[data-testid="lab-kpi-recues"]')).toContainText('3', { timeout: 10_000 });

  await page.getByTestId('lab-save-open').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nom du modèle').fill('Lab E2E');
  await dialog.getByLabel('Description').fill('Modèle de contrôle V8');
  await dialog.getByRole('button', { name: 'Enregistrer le modèle' }).click();
  await expect(page.getByText('Modèle enregistré : « Lab E2E ».')).toBeVisible();
  await expect(page.getByTestId('lab-model-select')).toContainText('Lab E2E');

  await page.getByTestId('lab-add-dimension').click();
  await page.getByTestId('lab-dimension-1').selectOption('commune');
  await page.getByTestId('lab-evaluate').click();
  await expect(page.locator('[data-testid="lab-row"]')).toHaveCount(1);

  await page.getByTestId('lab-load-model').click();
  await expect(page.getByText('Modèle « Lab E2E » chargé.')).toBeVisible();
  await expect(page.locator('[data-testid="lab-dimension-1"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="lab-kpi-recues"]')).toContainText('3');

  await page.getByTestId('lab-duplicate-model').click();
  await expect(page.getByText('Modèle dupliqué : « Copie de Lab E2E ».')).toBeVisible();
  await expect(page.getByTestId('lab-model-select')).toContainText('Copie de Lab E2E');
  expect(errors.snapshot().pageError).toEqual([]);
  expect(errors.snapshot().consoleError).toEqual([]);
});

test('Laboratoire — arabe RTL et thème sombre sans débordement', async ({ page, baseURL }) => {
  await authenticate(page, baseURL);
  await page.addInitScript(() => { localStorage.setItem('anm-language', 'ar'); localStorage.setItem('anm-theme', 'dark'); });
  await page.goto('/#/laboratoire');
  await expect(page.locator('html[dir="rtl"]')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'مختبر التركيبات' })).toBeVisible();
  await expect(page.locator('[data-testid="lab-kpi-recues"]')).toContainText('3', { timeout: 10_000 });
  for (const width of [390, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoOverflow(page);
  }
});

test('Laboratoire — lecteur en lecture seule', async ({ page, baseURL }) => {
  await authenticate(page, baseURL, 'lecteur'); const errors = collectErrors(page);
  await page.goto('/#/laboratoire');
  await expect(page.locator('[data-testid="lab-kpi-recues"]')).toContainText('3', { timeout: 10_000 });
  await expect(page.getByTestId('lab-save-open')).toHaveCount(0);
  await expect(page.getByTestId('lab-duplicate-model')).toHaveCount(0);
  expect(errors.snapshot().pageError).toEqual([]);
});
