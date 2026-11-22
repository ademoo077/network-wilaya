import { syntheseModelePayloadSchema, zodFields } from '@anm/shared';
import { test, expect } from './fixture.js';
import { authenticate } from './helpers.js';

const widgets = (definition) => definition.sections.flatMap((section) => section.colonnes.flat());
const savedStatus = (page) => page.getByRole('status').filter({ hasText: /enregistrée/i });
const saveAlert = (page) => page.getByRole('alert').filter({ hasText: /Enregistrement à reprendre/ });

async function personalizeReport(page) {
  await page.goto('/#/rapport?semaine=2026-11-15');
  await expect(page.getByRole('heading', { name: 'Synthèse hebdomadaire standard' })).toBeVisible();
  const response = page.waitForResponse((item) => item.request().method() === 'POST' && item.url().endsWith('/personnaliser'));
  await page.getByRole('button', { name: 'Personnaliser', exact: true }).click();
  const { item } = await (await response).json();
  await expect(page.getByRole('heading', { name: 'Ma synthèse hebdomadaire' })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`modele=${item.id}(?:&|$)`));
  await expect(page.getByLabel('Semaine du rapport')).toHaveValue('2026-11-15');
  return item;
}

async function addWidget(page) {
  await page.getByRole('button', { name: /Ajouter un widget/ }).first().click();
  await page.getByRole('dialog', { name: /Galerie de widgets/ }).getByRole('button', { name: /Fiches reçues/ }).first().click();
}

test('Rapport — autosave accepte le refus Zod réel d’un serveur sans version', async ({ page, baseURL }) => {
  await authenticate(page, baseURL, 'operateur');
  const legacySchema = syntheseModelePayloadSchema.omit({ version: true });
  const requests = [];
  await page.route('**/api/syntheses/modeles/*', (route) => {
    if (route.request().method() !== 'PUT') return route.continue();
    const body = route.request().postDataJSON();
    requests.push(body);
    const parsed = legacySchema.safeParse(body);
    if (parsed.success) return route.continue();
    return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({
      error: { code: 'VALIDATION', message: 'Modèle invalide', fields: zodFields(parsed.error) },
    }) });
  });
  const copy = await personalizeReport(page);
  await addWidget(page);
  await expect(savedStatus(page)).toBeVisible();
  await page.waitForTimeout(1_600);
  expect(requests).toHaveLength(2);
  expect(requests[0].version).toBe(copy.version);
  expect(requests[1].version).toBeUndefined();
  expect(requests[1].description).toBe(copy.description);
  await expect(saveAlert(page)).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Ma synthèse hebdomadaire' })).toBeVisible();
  await expect(page.locator('[data-testid^="widget-"]')).toHaveCount(4);
});

test('Rapport — un ancien serveur rejette le flux V15 puis accepte le repli sans layout', async ({ page, baseURL }) => {
  await authenticate(page, baseURL, 'operateur');
  const requests = [];
  await page.route('**/api/syntheses/modeles/*', (route) => {
    if (route.request().method() !== 'PUT') return route.continue();
    const body = route.request().postDataJSON();
    requests.push(body);
    if (requests.length === 1) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({
      error: { code: 'VALIDATION', message: 'Modèle invalide', fields: { 'definition.layout': "Unrecognized key(s) in object: 'largeur'" } },
    }) });
    if (requests.length === 2) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({
      error: { code: 'VALIDATION', message: 'Modèle invalide', fields: { definition: "Unrecognized key(s) in object: 'layout'" } },
    }) });
    return route.continue();
  });
  await personalizeReport(page);
  await page.getByLabel('Placement des widgets').selectOption('libre');
  await expect(savedStatus(page)).toBeVisible({ timeout: 10_000 });
  expect(requests).toHaveLength(3);
  expect(requests[0].definition.layout.schema_version).toBe(2);
  expect(requests[1].definition.layout.schema_version).toBe(1);
  expect(requests[1].definition.layout).toBeTruthy();
  expect(requests[2].definition.layout).toBeUndefined();
  await expect(saveAlert(page)).toHaveCount(0);
  await expect(page.getByText('Modèle invalide', { exact: true })).toHaveCount(0);
});

for (const refusal of [
  { label: 'version invalide', status: 400, error: { code: 'VALIDATION', message: 'Version invalide', fields: { version: 'Nombre entier positif requis' } } },
  { label: 'conflit de version', status: 409, error: { code: 'SYNTHESE_VERSION_CONFLIT', message: 'Le modèle a été modifié entre-temps', fields: { version: 2 } } },
]) {
  test(`Rapport — ${refusal.label} conserve le verrou et suspend l’autosave`, async ({ page, baseURL }) => {
    await authenticate(page, baseURL, 'operateur');
    const requests = [];
    await page.route('**/api/syntheses/modeles/*', (route) => {
      if (route.request().method() !== 'PUT') return route.continue();
      requests.push(route.request().postDataJSON());
      return route.fulfill({ status: refusal.status, contentType: 'application/json', body: JSON.stringify({ error: refusal.error }) });
    });
    const copy = await personalizeReport(page);
    await addWidget(page);
    await expect(saveAlert(page)).toBeVisible();
    await page.waitForTimeout(2_000);
    expect(requests).toHaveLength(1);
    expect(requests[0].version).toBe(copy.version);
    await expect(savedStatus(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Enregistrer/ }).first()).toBeEnabled();
  });
}

test('Rapport — une modification pendant un PUT lent est ensuite sauvegardée sans perte', async ({ page, baseURL }) => {
  await authenticate(page, baseURL, 'operateur');
  let releaseFirst;
  let startedFirst;
  const gate = new Promise((resolve) => { releaseFirst = resolve; });
  const firstStarted = new Promise((resolve) => { startedFirst = resolve; });
  const requests = [];
  await page.route('**/api/syntheses/modeles/*', async (route) => {
    if (route.request().method() !== 'PUT') return route.continue();
    requests.push(route.request().postDataJSON());
    if (requests.length === 1) {
      startedFirst();
      await gate;
    }
    return route.continue();
  });
  try {
    const copy = await personalizeReport(page);
    await addWidget(page);
    await firstStarted;
    await addWidget(page);
    await expect(page.locator('[data-testid^="widget-"]')).toHaveCount(5);
    await expect(savedStatus(page)).toHaveCount(0);
    releaseFirst();
    await expect(savedStatus(page)).toBeVisible();
    expect(requests).toHaveLength(2);
    expect(requests.map((body) => body.version)).toEqual([copy.version, copy.version + 1]);
    expect(widgets(requests[0].definition)).toHaveLength(4);
    expect(widgets(requests[1].definition)).toHaveLength(5);
    const reread = await page.request.get(`${baseURL}/api/syntheses/modeles/${copy.id}`);
    expect(reread.status()).toBe(200);
    const { item } = await reread.json();
    expect(item.description).toBe(copy.description);
    expect(item.version).toBe(copy.version + 2);
    expect(widgets(item.definition)).toHaveLength(5);
    await page.reload();
    await expect(page.locator('[data-testid^="widget-"]')).toHaveCount(5);
    await expect(page.getByLabel('Semaine du rapport')).toHaveValue('2026-11-15');
  } finally { releaseFirst(); }
});

test('Rapport — une nouvelle modification reprend l’autosave après un refus', async ({ page, baseURL }) => {
  await authenticate(page, baseURL, 'operateur');
  const requests = [];
  await page.route('**/api/syntheses/modeles/*', (route) => {
    if (route.request().method() !== 'PUT') return route.continue();
    requests.push(route.request().postDataJSON());
    if (requests.length > 1) return route.continue();
    return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({
      error: { code: 'VALIDATION', message: 'Définition refusée', fields: { definition: 'Invalide' } },
    }) });
  });
  const copy = await personalizeReport(page);
  await addWidget(page);
  await expect(saveAlert(page)).toBeVisible();
  await page.waitForTimeout(2_000);
  expect(requests).toHaveLength(1);
  await addWidget(page);
  await expect(savedStatus(page)).toBeVisible();
  await expect(saveAlert(page)).toHaveCount(0);
  expect(requests).toHaveLength(2);
  expect(requests.map((body) => body.version)).toEqual([copy.version, copy.version]);
  expect(widgets(requests[1].definition)).toHaveLength(5);
  await page.reload();
  await expect(page.locator('[data-testid^="widget-"]')).toHaveCount(5);
});

test('Rapport — une synthèse vide créée reste ouverte et enregistrable dans le studio', async ({ page, baseURL }) => {
  await authenticate(page, baseURL, 'operateur');
  await page.goto('/#/rapport?semaine=2026-11-15&outil=modeles');
  const created = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().endsWith('/api/syntheses/modeles'));
  await page.getByRole('button', { name: 'Nouvelle synthèse', exact: true }).click();
  const { item } = await (await created).json();
  await expect(page.getByRole('heading', { name: item.nom, exact: true })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`modele=${item.id}(?:&|$)`));
  await addWidget(page);
  await expect(savedStatus(page)).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: item.nom, exact: true })).toBeVisible();
  await expect(page.locator('[data-testid^="widget-"]')).toHaveCount(1);
  await expect(page.getByLabel('Semaine du rapport')).toHaveValue('2026-11-15');
});

test('Rapport — revenir au standard conserve une version éditable après navigation', async ({ page, baseURL }) => {
  await authenticate(page, baseURL, 'operateur');
  const copy = await personalizeReport(page);
  await addWidget(page);
  await expect(savedStatus(page)).toBeVisible();
  const reset = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().endsWith('/reinitialiser'));
  await page.getByRole('button', { name: 'Revenir au standard', exact: true }).click();
  expect((await reset).status()).toBe(200);
  await expect(page.locator('[data-testid^="widget-"]')).toHaveCount(3);
  await page.getByRole('button', { name: 'Modèles', exact: true }).click();
  await page.getByTestId(`modele-${copy.id}`).getByRole('button', { name: 'Ouvrir', exact: true }).click();
  await expect(page.getByRole('heading', { name: copy.nom, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Personnaliser', exact: true }).click();
  await addWidget(page);
  await expect(savedStatus(page)).toBeVisible();
  await expect(saveAlert(page)).toHaveCount(0);
  const reread = await page.request.get(`${baseURL}/api/syntheses/modeles/${copy.id}`);
  const { item } = await reread.json();
  expect(item.version).toBe(copy.version + 3);
  expect(widgets(item.definition)).toHaveLength(4);
});
