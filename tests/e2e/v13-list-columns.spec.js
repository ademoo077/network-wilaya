import { test, expect } from './fixture.js';
import { authenticate, collectErrors } from './helpers.js';
import { expectNoOverflow } from './geometry.js';

test('R1 — largeurs de colonnes par défaut : contenu contenu dans chaque cellule', async ({ page, baseURL }) => {
  // Simule une préférence vide enregistrée par une version antérieure au correctif.
  await page.addInitScript(() => {
    for (const id of [1, 2, 3, 4]) localStorage.setItem(`anm-list-widths-${id}`, '{}');
  });
  await authenticate(page, baseURL);
  await page.goto('/#/anomalies');
  await expect(page.locator('tbody tr').first()).toBeVisible();
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 1440, height: 1000 });

  expect(await page.locator('table').first().evaluate((table) => getComputedStyle(table).tableLayout)).toBe('fixed');
  const widths = await page.locator('thead th').evaluateAll((ths) => ths.map((th) => Math.round(th.getBoundingClientRect().width)));
  expect(new Set(widths).size).toBeGreaterThan(3);
  expect(widths[1]).toBeGreaterThanOrEqual(120); // référence : jamais écrasée à ~95 px

  const debordements = await page.locator('tbody tr').first().locator('td').evaluateAll((tds) => tds.filter((td) =>
    getComputedStyle(td).overflowX === 'visible' && td.scrollWidth > td.clientWidth + 2).length);
  expect(debordements).toBe(0);
  await expectNoOverflow(page);
  expect(errors.errors.pageError).toEqual([]);
  expect(errors.errors.consoleError).toEqual([]);
});
