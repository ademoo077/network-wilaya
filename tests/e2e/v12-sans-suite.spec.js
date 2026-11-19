import { test, expect } from './fixture.js';
import { authenticate, collectErrors } from './helpers.js';
import { expectAccessible } from './geometry.js';

test('V12 — vérification masquée et classement « Sans suite » avec motif obligatoire', async ({ page, baseURL, testServer }) => {
  const errors = collectErrors(page);
  await authenticate(page, baseURL);

  await page.goto('/#/anomalies');
  await expect(page.getByRole('button', { name: /À vérifier/ })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: 'Vérification' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Non affectées/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Mes anomalies/ })).toBeVisible();

  await page.goto(`/#/anomalies/${testServer.refs.ids[0]}`);
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('#verification')).toHaveCount(0);

  const sansSuite = page.getByRole('button', { name: 'Sans suite' });
  await expect(sansSuite).toBeVisible();
  await sansSuite.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const confirm = dialog.getByRole('button', { name: 'Confirmer' });
  await expect(confirm).toBeDisabled();
  await dialog.getByRole('textbox').fill('Signalement non fondé après contrôle terrain.');
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('Anomalie classée sans suite.')).toBeVisible();
  await expect(page.getByText('Sans suite', { exact: true }).first()).toBeVisible();
  await expectAccessible(page);
  expect(errors.snapshot().pageError).toEqual([]);
});
