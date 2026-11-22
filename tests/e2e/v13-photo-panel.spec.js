import { test, expect } from './fixture.js';
import { authenticate, collectErrors } from './helpers.js';
import { expectNoOverflow, expectAccessible } from './geometry.js';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const files = (...names) => names.map((name) => ({ name, mimeType: 'image/png', buffer: PNG }));

test('V13 / 169 — panneau Photos unifié : comparateur, modes, plein écran et galerie', async ({ page, baseURL, testServer }) => {
  const errors = collectErrors(page);
  await authenticate(page, baseURL);
  await page.goto(`/#/anomalies/${testServer.refs.ids[0]}`);
  await expect(page.locator('[data-photo-comparison]')).toBeVisible();
  await page.locator('[data-photo-upload="avant"]').setInputFiles(files('avant.png'));
  await expect(page.locator('[data-photo-group="avant"] [data-piece-id]')).toHaveCount(1);
  await page.locator('[data-photo-upload="apres"]').setInputFiles(files('apres.png'));
  await expect(page.locator('[data-photo-group="apres"] [data-piece-id]')).toHaveCount(1);

  const frame = page.locator('[data-photo-comparator] [class*="aspect-[4/3]"]').first();
  const box = await frame.boundingBox();
  expect(box.width / box.height).toBeCloseTo(4 / 3, 1);
  await expect(page.locator('[data-photo-comparator]').getByText('Photo avant', { exact: true }).first()).toBeVisible();
  await expect(page.locator('[data-photo-comparator]').getByText('Photo après', { exact: true }).first()).toBeVisible();

  const slider = page.locator('[data-photo-slider]');
  await expect(slider).toBeVisible();
  await page.locator('[data-photo-mode="side"]').click();
  await expect(slider).toHaveCount(0);
  await page.locator('[data-photo-mode="slider"]').click();
  await expect(slider).toBeVisible();
  await slider.focus();
  await slider.press('ArrowRight');
  expect(Number(await slider.getAttribute('aria-valuenow'))).toBeGreaterThan(50);
  await page.reload();
  await expect(page.locator('[data-photo-slider]')).toBeVisible();

  await page.locator('[data-photo-group="avant"] [data-piece-id] button').first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('[data-photo-counter]')).toHaveText('1 / 2');
  await dialog.getByRole('button', { name: 'Photo suivante' }).click();
  await expect(dialog.locator('[data-photo-counter]')).toHaveText('2 / 2');
  await dialog.getByRole('button', { name: 'Zoom avant' }).click();
  await expect(dialog.locator('[data-photo-lightbox] img')).toHaveAttribute('style', /scale\(1\.25\)/);
  await dialog.getByRole('button', { name: 'Pivoter' }).click();
  await expect(dialog.locator('[data-photo-lightbox] img')).toHaveAttribute('style', /rotate\(90deg\)/);
  await expect(dialog.getByRole('link', { name: 'Télécharger' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  await page.getByRole('button', { name: 'Tout sélectionner' }).click();
  await expect(page.getByRole('button', { name: 'Télécharger la sélection (ZIP)' })).toBeEnabled();

  const avantTile = page.locator('[data-photo-group="avant"] [data-piece-id]').first();
  await avantTile.locator('img').evaluate((element) => element.dispatchEvent(new Event('error', { bubbles: true })));
  await expect(page.getByRole('button', { name: 'Image indisponible — Réessayer' })).toBeVisible();
  await page.getByRole('button', { name: 'Image indisponible — Réessayer' }).click();
  await expect(page.locator('[data-photo-group="avant"] [data-piece-id] img')).toHaveCount(1);

  await avantTile.locator('summary').click();
  await avantTile.getByRole('button', { name: 'Photo après' }).click();
  await expect(page.locator('[data-photo-group="apres"] [data-piece-id]')).toHaveCount(2);

  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expectNoOverflow(page);
  }
  await expectAccessible(page);
  await page.addInitScript(() => { localStorage.setItem('anm-language', 'ar'); });
  await page.reload();
  expect(await page.locator('html').getAttribute('dir')).toBe('rtl');
  await expect(page.locator('[data-photo-comparison]')).toBeVisible();
  await expectNoOverflow(page);
  expect(errors.snapshot().pageError).toEqual([]);
});

test('V13 / 170 — clôture avec photo après téléversée et aperçu dans le dialogue', async ({ page, baseURL, testServer }) => {
  const errors = collectErrors(page);
  await authenticate(page, baseURL);
  await page.goto(`/#/anomalies/${testServer.refs.ids[0]}`);
  await page.locator('[data-photo-upload="avant"]').setInputFiles(files('preuve-avant.png'));
  await expect(page.locator('[data-photo-group="avant"] [data-piece-id]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Marquer traitée' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('[data-photo-dialog-upload]')).toBeVisible();
  await dialog.locator('[data-photo-dialog-upload]').setInputFiles(files('preuve-apres.png'));
  await expect(dialog.locator('[data-photo-dialog-preview]')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Confirmer' })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Confirmer' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('[data-photo-group="apres"] [data-piece-id]')).toHaveCount(1);
  await expect(page.locator('[data-sans-photo-motif]')).toHaveCount(0);
  expect(errors.snapshot().pageError).toEqual([]);
});
