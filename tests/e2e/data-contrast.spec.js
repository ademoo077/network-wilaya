import { test, expect } from './fixture.js';
import { authenticate, collectErrors } from './helpers.js';
import { expectAccessible, expectNoOverflow } from './geometry.js';

for (const [lang, width] of [['fr', 768], ['ar', 1440]]) {
  test(`contrastes des données en mode sombre — ${lang} / ${width} px`, async ({ page, baseURL, testServer }) => {
    const errors = collectErrors(page);
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript((language) => {
      localStorage.setItem('anm-language', language);
      localStorage.setItem('anm-theme', 'dark');
    }, lang);
    await authenticate(page, baseURL);
    for (const route of ['/anomalies', '/carte', `/anomalies/${testServer.refs.ids[0]}`]) {
      await page.goto(`/#${route}`);
      await expect(page.locator('h1')).toBeVisible();
      if (route === '/anomalies') await expect(page.locator('tbody tr').first()).toBeVisible();
      else await expect(page.locator('.leaflet-container')).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      await expect(page.locator('html')).toHaveAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
      await expectNoOverflow(page);
      await expectAccessible(page);
    }
    expect(errors.snapshot()).toEqual({ pageError: [], consoleError: [], requestFailed: [] });
  });
}
