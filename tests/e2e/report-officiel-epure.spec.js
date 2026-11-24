import { test, expect } from './fixture.js';
import { authenticate, collectErrors } from './helpers.js';
import { expectAccessible, expectNoOverflow } from './geometry.js';

test('Rapport officiel — KPIs épurés, sans graphes ni urgentes ouvertes', async ({ page, baseURL }) => {
  await authenticate(page, baseURL, 'operateur');
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#/rapport?semaine=2026-11-22&outil=officiel');

  const paper = page.locator('article.report-paper');
  await expect(paper.getByRole('heading', { name: 'Synthèse hebdomadaire' })).toBeVisible({ timeout: 20_000 });

  const header = await paper.locator('header').innerText();
  expect(header).not.toContain('Administrateur');
  expect(header).not.toMatch(/\d{2}\/\d{2}\/\d{4}.*·/);

  const kpis = paper.locator('[data-report-kpis] [data-report-kpi]');
  await expect(kpis).toHaveCount(4);
  await expect(kpis.nth(0)).toContainText('Stock ouvert');
  await expect(kpis.nth(1)).toContainText('Délai moyen');
  await expect(kpis.nth(2)).toContainText('En cours');
  await expect(kpis.nth(3)).toContainText('Total des points noirs');

  await expect(paper.locator('.recharts-wrapper, .recharts-responsive-container')).toHaveCount(0);
  await expect(paper.getByRole('heading', { name: 'Urgentes ouvertes' })).toHaveCount(0);
  await expect(paper.getByText('Urgentes ouvertes', { exact: true })).toHaveCount(0);

  await expect(paper.getByRole('heading', { name: /Ouvertes depuis plus de/ })).toBeVisible();
  await expect(paper.getByRole('heading', { name: 'Veille citoyenne' })).toBeVisible();

  await expectAccessible(page);
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoOverflow(page);
  }
  expect(errors.snapshot().pageError).toEqual([]);
  expect(errors.snapshot().consoleError).toEqual([]);
});
