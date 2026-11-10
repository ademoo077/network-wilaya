import { expect, test } from './fixture.js';
import { collectErrors, expectNotBlank, loginAs } from './helpers';

for (const hash of ['/carte', '/anomalies/nouvelle', '/anomalies', '/rapport', '/profil']) {
  test(`C1 — rechargement dur sur ${hash} n'affiche pas un ecran blanc`, async ({ page, baseURL }) => {
    const session = await loginAs(baseURL, 'admin');
    await page.context().addCookies([{ name: 'sid', value: session.token, url: baseURL }]);
    const errors = collectErrors(page);
    await page.goto(`${baseURL}/#${hash}`);
    await expect(page.locator('main h1').first()).toBeVisible();
    await page.reload();
    await expect(page.locator('main h1').first()).toBeVisible();
    await page.reload();
    const blank = await expectNotBlank(page, 3000);
    await expect(page.locator('main h1').first()).toBeVisible();
    expect(blank, `route ${hash}`).toBe(true);
    expect(errors.snapshot().pageError, `pageerror sur ${hash}`).toEqual([]);
    expect(errors.snapshot().consoleError, `console.error sur ${hash}`).toEqual([]);
    expect(errors.snapshot().requestFailed, `requêtes sur ${hash}`).toEqual([]);
  });
}
