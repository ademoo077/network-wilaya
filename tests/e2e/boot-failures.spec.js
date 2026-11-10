import { test, expect } from './fixture.js';
import { authenticate, collectErrors, expectNotBlank } from './helpers.js';

for (const route of ['/carte', '/anomalies/nouvelle']) {
  test(`C1 / 33 — référentiels lents sur ${route}`, async ({ page, baseURL }, info) => {
    await authenticate(page, baseURL);
    const errors = collectErrors(page);
    await page.route('**/api/ref/bootstrap', async (request) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await request.continue();
    });
    await page.goto(`/#${route}`);
    await page.waitForTimeout(700);
    await info.attach('console.json', { body: JSON.stringify(errors.snapshot(), null, 2), contentType: 'application/json' });
    expect(errors.snapshot().consoleError).toEqual([]);
    await expect(page.getByRole('progressbar')).toBeVisible();
    await expect(page.locator('main h1').first()).toBeVisible({ timeout: 3000 });
    expect(errors.snapshot().pageError).toEqual([]);
  });
}

test('35 — bootstrap 500 puis Réessayer', async ({ page, baseURL }) => {
  await authenticate(page, baseURL);
  let failed = true;
  await page.route('**/api/ref/bootstrap', (route) => failed
    ? route.fulfill({ status: 500, json: { error: { code: 'TEST_FAILURE', message: 'Erreur simulée' } } }) : route.continue());
  await page.goto('/#/carte');
  await expect(page.getByRole('heading', { name: 'Écran indisponible' })).toBeVisible();
  await expectNotBlank(page);
  failed = false;
  await page.getByRole('button', { name: 'Réessayer', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Carte des anomalies' })).toBeVisible();
});

test('36 — chunk indisponible : un seul rechargement puis erreur utilisable', async ({ page, baseURL }) => {
  await authenticate(page, baseURL);
  let navigations = 0;
  page.on('request', (request) => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigations += 1; });
  await page.route('**/assets/MapPage-*.js', (route) => route.abort());
  await page.goto('/#/carte');
  await expect(page.getByRole('heading', { name: 'Une erreur est survenue' })).toBeVisible({ timeout: 8000 });
  await expect(page.getByRole('button', { name: 'Recharger la page' })).toBeVisible();
  expect(navigations).toBe(2);
  await page.getByRole('button', { name: 'Retour au tableau de bord' }).click();
  await expect(page.locator('main h1').first()).toContainText('Bonjour');
});

test('34 — territoire vide : alerte explicite', async ({ page, emptyServer }) => {
  await authenticate(page, emptyServer.base);
  const errors = collectErrors(page);
  await page.goto(`${emptyServer.base}/#/anomalies/nouvelle`);
  await expect(page.getByText('Aucune daïra/commune configurée')).toBeVisible();
  expect(errors.snapshot().consoleError).toEqual([]);
});
