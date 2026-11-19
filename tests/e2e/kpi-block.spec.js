import { test, expect } from './fixture.js';
import { authenticate, collectErrors } from './helpers.js';
import {
  expectAccessible, expectNoOverflow,
  expectNoWidgetClipping,
} from './geometry.js';

async function ouvrirCopie(page) {
  await page.goto('/#/syntheses');
  const card = page.locator('[data-testid^="modele-"]').filter({
    has: page.getByRole('heading', { name: 'Synthèse hebdomadaire standard' }),
  });
  await card.getByRole('button', { name: /Personnaliser/ }).click();
  await expect(page.getByRole('heading', { name: 'Ma synthèse hebdomadaire' })).toBeVisible({ timeout: 20_000 });
  await page.locator('[data-widget-id="kpi-executif"]').waitFor({ state: 'visible', timeout: 30_000 });
}

test('143 — bloc KPI complet : bibliothèque de mesures, sélection, objectifs, seuils et mise en page', async ({ page, baseURL }) => {
  await authenticate(page, baseURL, 'operateur');
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await ouvrirCopie(page);

  const kpiWidget = page.locator('[data-widget-id="kpi-executif"]');
  await expect(kpiWidget).toBeVisible({ timeout: 15_000 });

  const initialCount = await kpiWidget.locator('[data-kpi-grid]').getAttribute('data-kpi-count');
  expect(initialCount).not.toBeNull();
  const initialNumber = parseInt(initialCount, 10);
  expect(initialNumber).toBeGreaterThanOrEqual(1);

  await kpiWidget.getByRole('button', { name: /Plus d’actions/ }).click();
  await kpiWidget.getByRole('button', { name: 'Éditer le bloc' }).click();

  await expect(page.getByRole('heading', { name: 'Inspecteur' })).toBeVisible();

  await page.getByPlaceholder('Rechercher une mesure…').fill('délai');
  await expect(page.locator('[data-kpi-mesures-selector]')).toBeVisible();
  const searchResults = await page.locator('[data-kpi-mesures-selector] button').allTextContents();
  expect(searchResults.length).toBeGreaterThan(0);

  await page.getByPlaceholder('Rechercher une mesure…').fill('');

  await page.getByRole('button', { name: /Traitement/ }).click();
  await expect(page.getByText('Traitement', { exact: true })).toBeVisible();

  const mesListBefore = await page.locator('[data-kpi-mesures-list] li').count();
  expect(mesListBefore).toBeGreaterThanOrEqual(1);

  const lastMeasureAdd = page.getByRole('button', { name: /Délai P90/ });
  await lastMeasureAdd.click();
  await expect(page.locator('[data-kpi-mesures-list] li')).toHaveCount(mesListBefore + 1);

  // Remonter la mesure ajoutée (en fin de liste) jusqu'en première position.
  const mesuresList = page.locator('[data-kpi-mesures-list] li');
  for (let index = (await mesuresList.count()) - 1; index > 0; index -= 1) {
    await mesuresList.nth(index).getByRole('button', { name: 'Monter', exact: true }).click();
  }
  const afterReorder = await mesuresList.first().textContent();
  expect(afterReorder).toBeDefined();
  expect(afterReorder).toContain('Délai');

  await page.locator('input[type="number"]').nth(0).fill('15');
  await expect(page.locator('input[type="number"]').nth(0)).toHaveValue('15');

  await page.getByRole('button', { name: 'Ajouter un filtre' }).click();
  await expect(page.getByText('Aucun filtre')).not.toBeVisible();

  await page.getByRole('button', { name: 'Appliquer' }).click();
  await expect(page.getByRole('heading', { name: 'Inspecteur' })).not.toBeVisible();

  await expect(kpiWidget.locator('[data-kpi-item]')).toHaveCount(mesListBefore + 1);
  await expect(kpiWidget.locator('[data-kpi-grid]')).toHaveAttribute('data-kpi-count', String(mesListBefore + 1));

  const gridStyle = await kpiWidget.locator('[data-kpi-grid]').evaluate((el) => {
    const style = getComputedStyle(el);
    return { gridTemplateColumns: style.gridTemplateColumns, display: style.display };
  });
  expect(gridStyle.display).toBe('grid');
  expect(gridStyle.gridTemplateColumns.split(' ').length).toBeGreaterThan(1);

  await expectNoWidgetClipping(page);
  await expectNoOverflow(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await expectNoWidgetClipping(page);
  const mobileGrid = await kpiWidget.locator('[data-kpi-grid]').evaluate((el) => {
    const style = getComputedStyle(el);
    return { gridTemplateColumns: style.gridTemplateColumns, display: style.display };
  });
  expect(mobileGrid.display).toBe('grid');

  await page.setViewportSize({ width: 1440, height: 1000 });

  // L'inspecteur se ferme lors de l'application : le rouvrir pour objectifs et préréglages.
  await kpiWidget.getByRole('button', { name: /Plus d’actions/ }).click();
  await kpiWidget.getByRole('button', { name: 'Éditer le bloc' }).click();
  await expect(page.getByRole('heading', { name: 'Inspecteur' })).toBeVisible();

  const objectifInput = page.locator('input[type="number"]').first();
  await objectifInput.fill('20');
  await expect(objectifInput).toHaveValue('20');

  // Les préréglages sont exposés directement dans l'inspecteur, sous leur intitulé.
  await page.getByRole('button', { name: /Stock ouvert en fin de période/ }).click();
  await expect(page.locator('[data-kpi-mesures-list] li')).toHaveCount(1);

  await page.getByRole('button', { name: 'Appliquer' }).click();

  await expect(kpiWidget.locator('[data-kpi-item]')).toHaveCount(1);
  await expect(kpiWidget.locator('[data-kpi-value]')).toBeVisible();

  await expectAccessible(page);
  expect(errors.snapshot().pageError).toEqual([]);
  expect(errors.snapshot().consoleError).toEqual([]);
});

test('143b — bloc KPI : sélection de 24 mesures maximum', async ({ page, baseURL }) => {
  await authenticate(page, baseURL, 'operateur');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await ouvrirCopie(page);

  const kpiWidget = page.locator('[data-widget-id="kpi-executif"]');
  await kpiWidget.getByRole('button', { name: /Plus d’actions/ }).click();
  await kpiWidget.getByRole('button', { name: 'Éditer le bloc' }).click();

  const allSectionIds = [
    'cohorte', 'traitement', 'verification', 'intervention', 'stock', 'qualite', 'derivee',
  ];

  let added = 0;
  for (const group of allSectionIds) {
    await page.locator(`[data-kpi-group="${group}"]`).click();
    // Ne cliquer que les mesures non sélectionnées : cliquer une mesure active la
    // désélectionnerait et ferait osciller le compteur sous la limite de 24.
    const measureButtons = page.locator('[data-kpi-measure]:not(:disabled):not(.bg-brand-100)');
    while (await measureButtons.count() > 0 && added < 24) {
      await measureButtons.first().click();
      added += 1;
    }
    await page.locator(`[data-kpi-group="${group}"]`).click();
  }

  const selectedCount = await page.locator('[data-kpi-mesures-list] li').count();
  expect(selectedCount).toBeLessThanOrEqual(24);

  await page.getByRole('button', { name: 'Appliquer' }).click();
  await expect(kpiWidget.locator('[data-kpi-item]')).toHaveCount(selectedCount);
});