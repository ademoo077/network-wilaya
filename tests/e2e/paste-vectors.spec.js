import fs from 'node:fs';
import { test, expect } from './fixture.js';
import { authenticate, collectErrors, pasteText } from './helpers.js';

const vectors = JSON.parse(fs.readFileSync(new URL('../fixtures/paste-vectors.json', import.meta.url)));
for (const entry of ['#smart-paste', '#lien_url', '#gps_text', 'body']) {
  test(`37–44 — les ${vectors.length} vecteurs dans ${entry}`, async ({ page, baseURL }, info) => {
    test.setTimeout(180000); await authenticate(page, baseURL);
    await page.addInitScript(() => { for (const key of Object.keys(localStorage)) if (key.startsWith('anm-draft:')) localStorage.removeItem(key); });
    const errors = collectErrors(page);
    for (const vector of vectors) await test.step(vector.id, async () => {
      await page.goto('/#/anomalies/nouvelle');
      // Une navigation vers le même hash conserve le reducer : chaque vecteur part d'un document neuf.
      await page.reload(); await expect(page.locator('#smart-paste')).toBeVisible();
      await expect(page.locator('#gps_text')).toHaveValue('');
      if (entry === 'body') await page.locator('h1').click();
      await pasteText(page, entry, vector.texte);
      const expected = vector.attente;
      if (expected.plateforme) await expect(page.locator('#plateforme')).toHaveValue(expected.plateforme);
      if (expected.contenu) await expect(page.locator('#contenu_type')).toHaveValue(expected.contenu);
      if (expected.position) {
        await expect(page.locator('#gps_text')).toHaveValue(expected.position.map((v) => v.toFixed(6)).join(', '), { timeout: 1000 });
        await expect(page.locator('.smart-map-marker')).toBeVisible();
        await expect(page.locator('[data-gps-source]')).not.toBeEmpty();
      } else {
        await expect(page.locator('#gps_text')).toHaveValue(''); await expect(page.locator('.smart-map-marker')).toHaveCount(0);
      }
      if (expected.positions) await expect(page.locator('[data-position-choice]')).toHaveCount(expected.positions.length);
      if (expected.texteConserve) await expect(page.locator('#observations')).not.toHaveValue('');
      if (expected.dateEstimee) await expect(page.locator('#date_publication')).not.toHaveValue('');
      await expect(page.locator('[data-feedback]').first()).toBeVisible();
      await expect(page.getByRole('button', { name: 'Aperçu', exact: true })).toHaveCount(0);
      expect(errors.snapshot().pageError, vector.id).toEqual([]);
    });
    await info.attach('console.json', { body: JSON.stringify(errors.snapshot()), contentType: 'application/json' });
    expect(errors.snapshot().consoleError).toEqual([]);
  });
}
