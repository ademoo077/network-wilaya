import { expect, test } from '@playwright/test';
import { expectNotBlank, loginAs } from './helpers';

test('C8 — barre d’actions collante ne recouvre pas les champs visibles', async ({ page, baseURL }) => {
  const session = await loginAs(baseURL, 'admin');
  await page.context().addCookies([{ name: 'sid', value: session.token, url: baseURL }]);
  await page.goto(`${baseURL}/#/anomalies/nouvelle`);
  await expectNotBlank(page);
  await page.locator('#observations').scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);
  const geometry = await page.evaluate(() => {
    const bars = Array.from(document.querySelectorAll('div')).filter((el) => String(el.className || '').includes('fixed') && String(el.className || '').includes('bottom-0'));
    const bar = bars[bars.length - 1];
    const field = document.getElementById('observations');
    const barRect = bar?.getBoundingClientRect();
    const fieldRect = field?.getBoundingClientRect();
    return { barTop: barRect?.top, fieldBottom: fieldRect?.bottom, fieldTop: fieldRect?.top };
  });
  expect(geometry, 'barre d’actions').not.toBeNull();
  expect(geometry.fieldBottom, 'champ en dessous de la barre').toBeLessThanOrEqual(geometry.barTop + 1);
});
