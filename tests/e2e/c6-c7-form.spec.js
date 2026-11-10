import { expect, test } from './fixture.js';
import { expectNotBlank, loginAs } from './helpers';

test('C6 — le hint sous Statut porte sur le statut, pas sur la plateforme', async ({ page, baseURL }) => {
  const session = await loginAs(baseURL, 'admin');
  await page.context().addCookies([{ name: 'sid', value: session.token, url: baseURL }]);
  await page.goto(`${baseURL}/#/anomalies/nouvelle`);
  await expectNotBlank(page);
  const advanced = page.locator('summary');
  await expect(advanced).toBeVisible();
  await advanced.click();
  await expect(page.getByText('Pour passer en')).toBeVisible({ timeout: 8000 });
  await expect(page.getByLabel('Motif')).toBeHidden();
});
