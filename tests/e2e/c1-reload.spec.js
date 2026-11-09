import { expect, test } from '@playwright/test';
import { collectErrors, expectNotBlank, loginAs } from './helpers';

for (const hash of ['/carte', '/anomalies/nouvelle', '/anomalies', '/rapport', '/profil']) {
  test(`C1 — rechargement dur sur ${hash} n'affiche pas un ecran blanc`, async ({ page, baseURL }) => {
    const session = await loginAs(baseURL, 'admin');
    await page.context().addCookies([{ name: 'sid', value: session.token, url: baseURL }]);
    const errors = collectErrors(page);
    await page.goto(`${baseURL}/#${hash}`);
    await page.reload();
    const blank = await expectNotBlank(page, 6000);
    expect(blank, `route ${hash}`).toBe(true);
    expect(errors.snapshot().pageError, `pageerror sur ${hash}`).toEqual([]);
  });
}
