import { test, expect } from './fixture.js';
import { authenticate, collectErrors } from './helpers.js';
import { expectAccessible, expectNoOverflow } from './geometry.js';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const files = (...names) => names.map((name) => ({ name, mimeType: 'image/png', buffer: PNG }));

test('V12 / 163 — photos avant/après, comparateur, légendes et géométrie FR/AR', async ({ page, baseURL, testServer }) => {
  const errors = collectErrors(page);
  await authenticate(page, baseURL);
  await page.goto('/#/anomalies');
  await expect(page.getByRole('columnheader', { name: 'Photos' })).toBeVisible();
  await expect(page.locator('[aria-label="Une photo après ou un motif est obligatoire pour clore l’anomalie."]').first()).toBeVisible();

  await page.goto(`/#/anomalies/${testServer.refs.ids[0]}`);
  await expect(page.locator('[data-photo-comparison]')).toBeVisible();
  await page.locator('[data-photo-upload="avant"]').setInputFiles(files('avant.png'));
  await expect(page.locator('[data-photo-group="avant"] [data-piece-id]')).toHaveCount(1);
  await page.locator('[data-photo-upload="apres"]').setInputFiles(files('apres.png'));
  await expect(page.locator('[data-photo-group="apres"] [data-piece-id]')).toHaveCount(1);
  await expect(page.locator('[data-photo-comparator]')).toBeVisible();
  await expect(page.locator('[data-photo-slider]')).toBeVisible();
  await page.locator('[data-photo-group="avant"] [data-piece-id] button').first().click();
  await expect(page.getByRole('dialog')).toContainText('avant.png');
  await page.keyboard.press('Escape');

  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expectNoOverflow(page);
  }
  await expectAccessible(page);
  await page.addInitScript(() => { localStorage.setItem('anm-language', 'ar'); });
  await page.reload();
  await expect(page.locator('[data-photo-comparison]')).toBeVisible();
  expect(await page.locator('html').getAttribute('dir')).toBe('rtl');
  await expectNoOverflow(page);
  expect(errors.snapshot().pageError).toEqual([]);
});

test('V12 / 164 — clôture : motif obligatoire sans photo, puis marquage d’une photo après', async ({ page, baseURL, testServer }) => {
  const errors = collectErrors(page);
  await authenticate(page, baseURL);
  await page.goto(`/#/anomalies/${testServer.refs.ids[0]}`);
  await page.getByRole('button', { name: 'Marquer traitée' }).click();
  let dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Une photo après ou un motif est obligatoire pour clore l’anomalie.')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Confirmer' }).click();
  await expect(dialog.getByText('Une photo après ou un motif est obligatoire pour clore l’anomalie.')).toBeVisible();
  await dialog.getByLabel('Sans photo après').check();
  await dialog.getByLabel('Motif de l’absence de photo').fill('Accès interdit au site');
  await dialog.getByRole('button', { name: 'Confirmer' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('Accès interdit au site')).toBeVisible();
  expect(errors.snapshot().pageError).toEqual([]);
});

test('V12 / 167 — une photo avant peut être promue photo après depuis le dialogue de clôture', async ({ page, baseURL, testServer }) => {
  await authenticate(page, baseURL);
  await page.goto(`/#/anomalies/${testServer.refs.ids[0]}`);
  await page.locator('[data-photo-upload="avant"]').setInputFiles(files('preuve-avant.png'));
  await expect(page.locator('[data-photo-group="avant"] [data-piece-id]')).toHaveCount(1);
  await page.locator('[data-photo-upload="avant"]').setInputFiles(files('seconde-avant.png'));
  await expect(page.locator('[data-photo-group="avant"] [data-piece-id]')).toHaveCount(2);
  await page.getByRole('button', { name: 'Marquer traitée' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('[data-photo-select]').first().click();
  await expect(dialog.getByRole('button', { name: 'Confirmer' })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Confirmer' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('[data-photo-group="apres"] [data-piece-id]')).toHaveCount(1);
  await expect(page.locator('[data-photo-slider]')).toBeVisible();
});
