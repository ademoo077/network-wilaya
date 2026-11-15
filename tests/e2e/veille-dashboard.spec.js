import { test, expect } from './fixture.js';
import { authenticate, expectNotBlank } from './helpers.js';

test('Veille — tableau de bord : indicateurs, graphique et santé des sources', async ({ page, testServer }) => {
  await authenticate(page, testServer.base, 'admin');
  await page.goto(`${testServer.base}/#/veille/tableau`);
  await expectNotBlank(page);
  await expect(page.locator('h1').first()).toHaveText('Tableau de bord Veille');
  await expect(page.getByText('Publications collectées', { exact: true })).toBeVisible();
  await expect(page.getByText('Précision (triage)', { exact: true })).toBeVisible();
  await expect(page.getByText('Rappel estimé', { exact: true })).toBeVisible();
  await expect(page.getByText('Volume quotidien', { exact: true })).toBeVisible();
  await expect(page.getByText('Santé des sources', { exact: true })).toBeVisible();
  await expect(page.getByText('Alertes', { exact: true }).first()).toBeVisible();
  const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
  expect(width.scroll).toBeLessThanOrEqual(width.inner + 1);

  await page.goto(`${testServer.base}/#/veille`);
  await page.getByRole('button', { name: 'Alertes' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Alertes' }).first()).toBeVisible();
  await dialog.getByRole('button', { name: 'Fermer' }).click();
  await expect(dialog).toBeHidden();
});

test('Veille — conformité : registre, paramètres et effacement sur demande', async ({ page, testServer }) => {
  await authenticate(page, testServer.base, 'admin');
  await page.goto(`${testServer.base}/#/veille/conformite`);
  await expectNotBlank(page);
  await expect(page.locator('h1').first()).toHaveText('Conformité et registre');
  await expect(page.getByRole('heading', { name: 'Registre de traitement' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Charte d’usage' })).toBeVisible();
  await expect(page.getByText('Mesures de sécurité', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: /Ouvrir les paramètres/ }).click();
  await expect(page.getByRole('tab', { name: 'Paramètres' })).toHaveAttribute('aria-selected', 'true');
  const conservation = page.getByLabel('Conservation (jours)');
  await expect(conservation).toHaveValue('90');
  await conservation.fill('120');
  await page.getByRole('button', { name: 'Enregistrer les paramètres' }).click();
  await expect(page.getByText('Paramètres enregistrés.', { exact: true })).toBeVisible();
  const saved = await page.evaluate(async () => (await fetch('/api/veille/settings')).json());
  expect(saved.item.veille_conservation_jours).toBe('120');
  await conservation.fill('90');
  await page.getByRole('button', { name: 'Enregistrer les paramètres' }).click();

  await page.goto(`${testServer.base}/#/veille/conformite`);
  const id = testServer.refs.veilleElementId;
  await page.getByLabel('Identifiant de l’élément').fill(String(id));
  await page.getByLabel('Motif de la demande (facultatif)').fill('Test E2E');
  await page.getByRole('button', { name: 'Effacer', exact: true }).first().click();
  const confirm = page.getByRole('dialog');
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'Effacer', exact: true }).click();
  await expect(page.getByText('1 élément(s) effacé(s).', { exact: true })).toBeVisible();
  const remaining = await page.evaluate(async (elementId) => {
    const response = await fetch(`/api/veille/elements/${elementId}`);
    return response.status;
  }, id);
  expect(remaining).toBe(404);
});

test('Veille — tableau et conformité : mobile, arabe et RTL', async ({ page, testServer }) => {
  await authenticate(page, testServer.base, 'admin');
  await page.addInitScript(() => localStorage.setItem('anm-language', 'ar'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${testServer.base}/#/veille/tableau`);
  await page.reload();
  await expect(page.locator('h1').first()).toHaveText('لوحة متابعة الرصد');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  let width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
  expect(width.scroll).toBeLessThanOrEqual(width.inner + 1);

  await page.goto(`${testServer.base}/#/veille/conformite`);
  await expect(page.locator('h1').first()).toHaveText('الامتثال وسجل المعالجة');
  width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
  expect(width.scroll).toBeLessThanOrEqual(width.inner + 1);
});
