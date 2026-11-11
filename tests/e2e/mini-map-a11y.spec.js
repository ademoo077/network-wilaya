import { test, expect } from './fixture.js';
import { authenticate, collectErrors } from './helpers.js';
import { expectAccessible } from './geometry.js';

for (const [lang, label] of [['fr', 'Coordonnées GPS'], ['ar', 'إحداثيات GPS']]) {
  test(`repère GPS accessible en ${lang} — fiche, saisie, déplacement et retrait`, async ({ page, baseURL, testServer }) => {
    const errors = collectErrors(page);
    await page.addInitScript((language) => localStorage.setItem('anm-language', language), lang);
    await authenticate(page, baseURL);
    await page.goto(`/#/anomalies/${testServer.refs.ids[0]}`);
    await expect(page.locator('h1')).toBeVisible();
    const marker = page.locator('.leaflet-marker-icon').filter({ has: page.locator('.smart-map-marker') });
    await expect(marker).toHaveCount(1);
    await expect(marker).toHaveAccessibleName(`${label} : 36.753800, 3.058800`);
    await expect(marker).not.toHaveClass(/leaflet-marker-draggable/);
    await expectAccessible(page);

    await page.goto('/#/anomalies/nouvelle');
    await page.locator('#gps_text').fill('36.7538,3.0588');
    await expect(marker).toHaveAccessibleName(`${label} : 36.753800, 3.058800`);
    await expect(marker).toHaveClass(/leaflet-marker-draggable/);
    await page.locator('#gps_text').fill('36.76,3.066');
    await expect(marker).toHaveAccessibleName(`${label} : 36.760000, 3.066000`);
    await expectAccessible(page);
    await page.locator('#gps_text').fill('');
    await expect(marker).toHaveCount(0);
    expect(errors.snapshot()).toEqual({ pageError: [], consoleError: [], requestFailed: [] });
  });
}
