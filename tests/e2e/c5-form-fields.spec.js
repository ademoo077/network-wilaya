import { expect, test } from './fixture.js';
import { expectNotBlank, loginAs } from './helpers';

test('C5 — catégories et types proposent un texte indicatif', async ({ page, baseURL }) => {
  const session = await loginAs(baseURL, 'admin');
  await page.context().addCookies([{ name: 'sid', value: session.token, url: baseURL }]);
  await page.goto(`${baseURL}/#/anomalies/nouvelle`);
  await expectNotBlank(page);
  await expect(page.getByPlaceholder('Choisir une catégorie…')).toBeVisible();
  await expect(page.getByPlaceholder('Rechercher un type…')).toBeVisible();
});
