import { test, expect } from './fixture.js';
import { authenticate, pasteText, collectErrors } from './helpers.js';
import { expectActionBarClear, expectNoOverflow, expectCompactCards, expectAccessible } from './geometry.js';

test.beforeEach(async ({ page, baseURL }) => { await authenticate(page, baseURL); await page.goto('/#/anomalies/nouvelle'); await expect(page.locator('#smart-paste')).toBeVisible(); });
test('37 — remplissage instantané puis annulation exacte, y compris commune automatique', async ({ page }) => {
  await pasteText(page, '#smart-paste', 'https://google.com/maps/@36.7538,3.0588,17z');
  await expect(page.locator('#gps_text')).toHaveValue('36.753800, 3.058800', { timeout: 1000 });
  await expect(page.locator('#commune_id')).toHaveValue('[DEMO] Commune');
  await page.getByRole('button', { name: 'Annuler le remplissage', exact: true }).click();
  await expect(page.locator('#gps_text')).toHaveValue(''); await expect(page.locator('#commune_id')).toHaveValue('');
  await expect(page.locator('.smart-map-marker')).toHaveCount(0);
  await pasteText(page, '#smart-paste', '36.8,3.2'); await expect(page.locator('#gps_text')).toHaveValue('36.800000, 3.200000');
});
test('38 — saisie et blur, URL sans schéma et hôte inconnu', async ({ page }) => {
  await page.locator('#lien_url').fill('facebook.com/reel/12345');
  await expect(page.locator('#lien_url')).toHaveValue('https://facebook.com/reel/12345');
  await expect(page.locator('#plateforme')).toHaveValue('facebook');
  await expect(page.getByText('https:// ajouté automatiquement').first()).toBeVisible();
  await page.locator('#lien_url').fill('https://example.org/post'); await page.locator('#lien_url').blur();
  await expect(page.getByText('Plateforme non reconnue — choisissez-la si besoin').first()).toBeVisible();
});
test('39 — GPS saisi, déplacé sur la carte puis vidé', async ({ page }) => {
  await page.locator('#gps_text').fill('٣٦٫٧٥٣٨، ٣٫٠٥٨٨');
  await expect(page.locator('#gps_text')).toHaveValue('36.753800, 3.058800');
  await page.locator('.leaflet-container').click({ position: { x: 170, y: 130 } });
  await expect(page.locator('[data-gps-source]')).toContainText('Carte');
  await page.locator('#gps_text').fill(''); await expect(page.locator('.smart-map-marker')).toHaveCount(0);
});
test('40 — lien court lent : feedback immédiat, formulaire utilisable puis résultat et commune', async ({ page }) => {
  await pasteText(page, '#gps_text', 'https://maps.app.goo.gl/slow');
  await expect(page.getByText('Résolution du lien court…').first()).toBeVisible({ timeout: 100 });
  await page.locator('#observations').fill('La saisie reste disponible');
  await expect(page.locator('#gps_text')).toHaveValue('36.753800, 3.058800');
  await expect(page.locator('#commune_id')).toHaveValue('[DEMO] Commune');
  await expect(page.locator('#observations')).toHaveValue('La saisie reste disponible');
});
test('41 — réseau coupé : raison, ouvrir, mode d’emploi et réessayer', async ({ page }) => {
  await pasteText(page, '#lien_url', 'https://maps.app.goo.gl/network');
  await expect(page.getByText(/Internet indisponible depuis le serveur/).first()).toBeVisible();
  const open = page.getByRole('link', { name: 'Ouvrir le lien' }).first(); await expect(open).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(page.getByText("Copiez l'adresse de la page").first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Réessayer' }).first()).toBeEnabled();
  await page.locator('#observations').fill('Saisie préservée'); await expect(page.locator('#observations')).toHaveValue('Saisie préservée');
});
test('42 — deux requêtes rapprochées : dernière réponse uniquement', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/tools/resolve-link', async (route) => {
    const first = ++requests === 1; await new Promise((r) => setTimeout(r, first ? 800 : 40));
    await route.fulfill({ json: { ok: true, coords: { lat: first ? 36.75 : 36.8, lng: first ? 3.05 : 3.2, source: 'lien_court' }, urlFinale: 'https://google.com/maps/' } }).catch(() => {});
  });
  await pasteText(page, '#smart-paste', 'https://maps.app.goo.gl/first');
  await expect.poll(() => requests).toBe(1);
  await pasteText(page, '#smart-paste', 'https://maps.app.goo.gl/second');
  await expect(page.locator('#gps_text')).toHaveValue('36.800000, 3.200000');
  await page.waitForTimeout(900); await expect(page.locator('#gps_text')).toHaveValue('36.800000, 3.200000');
});
test('43 — toutes les valeurs manuelles et requête territoriale tardive sont protégées', async ({ page, testServer }) => {
  await page.locator('#plateforme').selectOption('instagram'); await page.locator('#observations').fill('Texte manuel protégé');
  await page.locator('#daira_id').fill('Autre'); await page.getByRole('option', { name: '[DEMO] Autre daïra', exact: true }).click();
  await page.locator('#commune_id').click(); await page.getByRole('option', { name: '[DEMO] Autre commune', exact: true }).click();
  await pasteText(page, '#smart-paste', 'https://facebook.com/posts/9999 36.7538,3.0588 — un autre message reçu');
  await expect(page.getByText('Commune identifiée par ses limites territoriales').first()).toBeVisible();
  await expect(page.locator('#daira_id')).toHaveValue('[DEMO] Autre daïra'); await expect(page.locator('#commune_id')).toHaveValue('[DEMO] Autre commune');
  await expect(page.locator('#observations')).toHaveValue('Texte manuel protégé'); await expect(page.locator('#plateforme')).toHaveValue('instagram');
  expect(testServer.refs.secondCommune).toBeTruthy();
  await expect(page.getByRole('button', { name: 'Remplacer', exact: true }).first()).toBeVisible();
});
test('44 — choix entre deux positions, aucune appliquée implicitement', async ({ page }) => {
  await pasteText(page, '#smart-paste', '36.75,3.05 et 36.78,3.09'); await expect(page.locator('#gps_text')).toHaveValue('');
  await page.locator('[data-position-choice]').nth(1).click(); await expect(page.locator('#gps_text')).toHaveValue('36.780000, 3.090000');
});
test('45–46 — géométrie, libellés accessibles et motif conditionnel à 390/768/1024/1440', async ({ page }) => {
  const errors = collectErrors(page);
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 }); await expectNoOverflow(page); await expectCompactCards(page);
    await expectActionBarClear(page);
  }
  // V12 : la vérification n'est plus proposée dans le formulaire ; le motif n'est plus requis à la création.
  await page.getByText('Options avancées', { exact: true }).click();
  await expect(page.locator('#verification')).toHaveCount(0);
  await expect(page.locator('#motif')).toHaveCount(0);
  await expect(page.getByLabel('Type de contenu', { exact: true })).toBeVisible();
  await expectAccessible(page); expect(errors.snapshot().pageError).toEqual([]);
});
test('brouillon, édition de texte ordinaire et recherche de type en premier', async ({ page }) => {
  await page.locator('#observations').focus();
  await page.locator('#observations').fill('Brouillon manuel à reprendre');
  await page.locator('#type_id').fill('حفرة');
  await page.getByRole('listbox').getByRole('option').first().click(); await expect(page.locator('#domaine_id')).not.toHaveValue('');
  await page.waitForTimeout(900); await page.reload(); await page.getByRole('button', { name: 'Reprendre', exact: true }).click();
  await expect(page.locator('#observations')).toHaveValue('Brouillon manuel à reprendre');
  await expect(page.locator('#domaine_id')).not.toHaveValue('');
});
