import { test, expect } from './fixture.js';
import { authenticate, collectErrors, loginAs } from './helpers.js';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

test('R2 — aperçu de la fiche : photos existantes sans rôle visibles dans le comparateur', async ({ page, baseURL, testServer }) => {
  const session = await loginAs(baseURL, 'admin');
  for (const id of testServer.refs.ids) {
    const form = new FormData();
    form.append('file', new Blob([PNG], { type: 'image/png' }), 'preuve-importee.png');
    form.append('role', 'autre');
    const response = await fetch(`${baseURL}/api/anomalies/${id}/pieces`, {
      method: 'POST',
      headers: { Cookie: session.cookie, 'X-CSRF-Token': session.csrf },
      body: form,
    });
    expect(response.ok, `Import photo autre sur ${id}`).toBe(true);
  }
  await authenticate(page, baseURL);
  await page.goto('/#/anomalies');
  await expect(page.locator('tbody tr').first()).toBeVisible();
  const errors = collectErrors(page);
  await page.locator('tbody tr').first().getByRole('button', { name: 'Aperçu de la fiche' }).click();
  await expect(page.locator('[data-quick-view]')).toBeVisible();
  await expect(page.locator('[data-quick-view] [data-photo-comparator]')).toBeVisible();
  const images = page.locator('[data-quick-view] [data-photo-comparator] img');
  await expect(images.first()).toBeVisible();
  await expect.poll(() => images.first().evaluate((element) => element.naturalWidth)).toBeGreaterThan(0);
  expect(errors.errors.pageError).toEqual([]);
  expect(errors.errors.consoleError).toEqual([]);
});
