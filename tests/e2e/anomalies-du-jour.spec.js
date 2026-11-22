import { addDays, todayAlgiers } from '@anm/shared';
import { test, expect } from './fixture.js';
import { authenticate, collectErrors } from './helpers.js';
import { expectNoOverflow } from './geometry.js';

const queryParams = (url) => new URLSearchParams((url.split('#')[1] || '').split('?')[1] || '');

test('189 — option « Aujourd’hui » : seules les anomalies du jour, libellé FR/AR et RTL', async ({ page, baseURL }) => {
  const session = await authenticate(page, baseURL);
  const bootstrap = await (await page.request.get(`${baseURL}/api/ref/bootstrap`)).json();
  const domaine = bootstrap.domaines[0];
  const type = domaine.types[0];
  const daira = bootstrap.dairas.find((item) => item.communes?.length);
  const today = todayAlgiers();
  const created = await page.request.post(`${baseURL}/api/anomalies`, {
    headers: { 'x-csrf-token': session.csrf },
    data: {
      lien_url: `https://facebook.com/posts/hier-${Date.now()}`,
      date_signalement: addDays(today, -1),
      domaine_id: domaine.id,
      type_id: type.id,
      daira_id: daira.id,
      commune_id: daira.communes[0].id,
      observations: '[DEMO] Anomalie d’hier',
    },
  });
  expect(created.ok(), await created.text()).toBe(true);
  const oldReference = (await created.json()).item.reference;

  await page.goto('/#/anomalies');
  const errors = collectErrors(page);
  await expect(page.getByText('4 anomalie(s)')).toBeVisible();
  await expect(page.locator('[data-list-period] option[value="1"]')).toHaveText('Aujourd’hui');
  await page.locator('[data-list-period]').selectOption('1');

  const params = queryParams(page.url());
  expect(params.get('periode')).toBe('1');
  expect(params.get('from')).toBe(today);
  expect(params.get('to')).toBe(today);
  await expect(page.getByText('3 anomalie(s)')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Aujourd’hui' })).toBeVisible();
  await expect(page.locator('tbody')).not.toContainText(oldReference);

  await page.getByRole('button', { name: 'Aujourd’hui' }).click();
  const cleared = queryParams(page.url());
  expect(cleared.has('periode')).toBe(false);
  expect(cleared.has('from')).toBe(false);
  expect(cleared.has('to')).toBe(false);
  await expect(page.getByText('4 anomalie(s)')).toBeVisible();
  await page.locator('[data-list-period]').selectOption('1');

  await page.evaluate(() => localStorage.setItem('anm-language', 'ar'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('[data-list-period]')).toHaveValue('1');
  await expect(page.locator('[data-list-period] option[value="1"]')).toHaveText('اليوم');
  await expect(page.getByRole('button', { name: 'اليوم' })).toBeVisible();
  for (const width of [390, 768, 1024, 1440]) { await page.setViewportSize({ width, height: 900 }); await expectNoOverflow(page); }
  expect(errors.errors.pageError).toEqual([]);
});
