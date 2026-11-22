import { test, expect } from './fixture.js';
import { authenticate, collectErrors, loginAs } from './helpers.js';

async function callApi(base, session, method, path, body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: session.cookie, 'X-CSRF-Token': session.csrf },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

async function seedPage(base, session, refs, overrides = {}) {
  const result = await callApi(base, session, 'POST', '/api/reseaux/rapide', {
    reseau: 'facebook', page_url: 'https://facebook.com/v14-par-defaut', nom: '[DEMO] Page V14',
    nature: 'page', daira_id: refs.daira, commune_id: refs.commune, ...overrides,
  });
  expect(result.status, JSON.stringify(result.body)).toBeLessThan(300);
  return result.body.item;
}

test('179 — URL d’une page connue : sélection automatique, badge et commune suggérée', async ({ page, baseURL, testServer }) => {
  const session = await loginAs(baseURL, 'admin');
  await seedPage(baseURL, session, testServer.refs, {
    page_url: 'https://facebook.com/aintaya.news', nom: '[DEMO] Aintaya News',
  });
  const errors = collectErrors(page);
  await authenticate(page, baseURL);
  await page.goto('/#/anomalies/nouvelle');
  await page.fill('#lien_url', 'https://m.facebook.com/aintaya.news/posts/42/?fbclid=x');
  await expect(page.locator('[data-testid="source-picker"]')).toContainText('[DEMO] Aintaya News');
  await expect(page.locator('#source_reseau_id')).toHaveValue('[DEMO] Aintaya News');
  await expect(page.locator('[data-testid="source-message"]')).toContainText('Page enregistrée');
  await expect(page.locator('[data-testid="suggestion-commune_id"]')).toContainText('[DEMO] Commune');
  expect(errors.snapshot().pageError).toEqual([]);
});

test('180 — URL identifiable mais page absente : panneau prérempli, nom requis puis ajout', async ({ page, baseURL }) => {
  const session = await loginAs(baseURL, 'admin');
  const errors = collectErrors(page);
  await authenticate(page, baseURL);
  await page.goto('/#/anomalies/nouvelle');
  await page.fill('#lien_url', 'https://facebook.com/nouvelle-page-v14/posts/7');
  const panneau = page.locator('[data-testid="source-add-panel"]');
  await expect(panneau).toBeVisible();
  await expect(panneau).toContainText('nouvelle-page-v14');
  await expect(page.locator('#source_nom')).toHaveValue('Nouvelle Page V14');
  await expect(page.locator('#source_nature')).toHaveValue('page');
  await page.fill('#source_nom', '');
  await page.getByRole('button', { name: 'Enregistrer la page et la sélectionner' }).click();
  await expect(page.locator('#source_nom')).toHaveAttribute('aria-invalid', 'true');
  await page.fill('#source_nom', '[DEMO] Nouvelle Page V14');
  await page.getByRole('button', { name: 'Enregistrer la page et la sélectionner' }).click();
  await expect(panneau).toHaveCount(0);
  await expect(page.locator('[data-testid="source-picker"]')).toContainText('[DEMO] Nouvelle Page V14');
  const recherche = await callApi(baseURL, session, 'GET', '/api/reseaux/recherche?q=Nouvelle%20Page%20V14');
  expect(recherche.body.items.some((item) => item.nom === '[DEMO] Nouvelle Page V14')).toBe(true);
  expect(errors.snapshot().pageError).toEqual([]);
});

test('181 — Lien non identifiable : message FR/AR et aucune devinette', async ({ page, baseURL }) => {
  const errors = collectErrors(page);
  await page.addInitScript(() => localStorage.setItem('anm-language', 'ar'));
  await authenticate(page, baseURL);
  await page.goto('/#/anomalies/nouvelle');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.fill('#lien_url', 'https://www.facebook.com/share/p/19S9HP1xWn/');
  await expect(page.locator('[data-testid="source-message"]')).toContainText('لا يسمح الرابط');
  await expect(page.locator('[data-testid="source-add-panel"]')).toHaveCount(0);
  await page.addInitScript(() => localStorage.setItem('anm-language', 'fr'));
  await page.reload();
  await page.fill('#lien_url', 'https://vm.tiktok.com/ZMd6QwERT/');
  await expect(page.locator('[data-testid="source-message"]')).toContainText("Le lien ne permet pas d'identifier la page");
  await expect(page.locator('[data-testid="source-add-panel"]')).toHaveCount(0);
  expect(errors.snapshot().pageError).toEqual([]);
});

test('182 — Combobox normalisée, récentes en tête, pastilles réseau et nature', async ({ page, baseURL, testServer }) => {
  const session = await loginAs(baseURL, 'admin');
  await seedPage(baseURL, session, testServer.refs, {
    page_url: 'https://facebook.com/bladia-test', nom: '[DEMO] بلدية الاختبار',
  });
  await seedPage(baseURL, session, testServer.refs, {
    reseau: 'telegram', page_url: 'https://t.me/canal_v14', nom: '[DEMO] Canal V14', nature: 'chaine',
  });
  const errors = collectErrors(page);
  await authenticate(page, baseURL);
  await page.goto('/#/anomalies/nouvelle');
  await page.fill('#source_reseau_id', 'بلدية الاختبار');
  await expect(page.getByRole('option', { name: /بلدية الاختبار/ })).toBeVisible();
  await page.getByRole('option', { name: /بلدية الاختبار/ }).click();
  await expect(page.locator('[data-testid="source-picker"]')).toContainText('[DEMO] Commune');
  await expect(page.locator('[data-testid="source-picker"]')).toContainText('Page locale');
  await page.reload();
  await page.locator('#source_reseau_id').click();
  await expect(page.getByRole('option').first()).toContainText('[DEMO] بلدية الاختبار');
  await page.keyboard.press('Escape');
  await page.fill('#lien_url', 'https://t.me/canal_v14/42');
  await expect(page.locator('[data-testid="source-picker"]')).toContainText('[DEMO] Canal V14');
  await expect(page.locator('[data-testid="source-picker"]')).toContainText('Chaîne');
  expect(errors.snapshot().pageError).toEqual([]);
});

test('183 — Profils réservés à l’administrateur', async ({ page, baseURL }) => {
  await authenticate(page, baseURL, 'operateur');
  await page.goto('/#/anomalies/nouvelle');
  await page.locator('#source_reseau_id').click();
  await page.getByRole('option', { name: '+ Ajouter une page' }).click();
  await expect(page.locator('#source_nature option[value="profil"]')).toBeDisabled();
  await expect(page.locator('[data-testid="source-add-panel"]')).toContainText("réservés à l'administrateur");
});

test('186 — Changement de lien après sélection : confirmation sans écrasement silencieux', async ({ page, baseURL, testServer }) => {
  const session = await loginAs(baseURL, 'admin');
  await seedPage(baseURL, session, testServer.refs, {
    page_url: 'https://facebook.com/page-initiale', nom: '[DEMO] Page Initiale',
  });
  await authenticate(page, baseURL);
  await page.goto('/#/anomalies/nouvelle');
  await page.fill('#lien_url', 'https://facebook.com/page-initiale/posts/1');
  await expect(page.locator('[data-testid="source-picker"]')).toContainText('[DEMO] Page Initiale');
  await page.fill('#lien_url', 'https://facebook.com/autre-page-v14/posts/2');
  await expect(page.getByText('Le lien a changé après la sélection')).toBeVisible();
  await expect(page.locator('[data-testid="source-picker"]')).toContainText('[DEMO] Page Initiale');
  await expect(page.locator('[data-testid="source-add-panel"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Confirmer' }).click();
  await expect(page.locator('[data-testid="source-add-panel"]')).toBeVisible();
  await expect(page.locator('#source_nom')).toHaveValue('Autre Page V14');
});

test('V14 — conflit de correspondance après un choix manuel : aucun écrasement silencieux', async ({ page, baseURL, testServer }) => {
  const session = await loginAs(baseURL, 'admin');
  await seedPage(baseURL, session, testServer.refs, {
    page_url: 'https://facebook.com/choix-manuel-a', nom: '[DEMO] Choix Manuel A',
  });
  await seedPage(baseURL, session, testServer.refs, {
    page_url: 'https://facebook.com/choix-manuel-b', nom: '[DEMO] Choix Manuel B',
  });
  await authenticate(page, baseURL);
  await page.goto('/#/anomalies/nouvelle');
  await page.locator('#source_reseau_id').click();
  await page.getByRole('option', { name: /\[DEMO\] Choix Manuel A/ }).click();
  await expect(page.locator('[data-testid="source-picker"]')).toContainText('[DEMO] Choix Manuel A');
  await page.locator('#lien_url').fill('https://facebook.com/choix-manuel-b/posts/3');
  await expect(page.getByText('Remplacer par [DEMO] Choix Manuel B ?')).toBeVisible();
  await expect(page.locator('[data-testid="source-picker"]')).toContainText('[DEMO] Choix Manuel A');
  await expect(page.locator('[data-testid="source-add-panel"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Conserver mon choix' }).click();
  await expect(page.locator('[data-testid="source-picker"]')).toContainText('[DEMO] Choix Manuel A');
});

test('187 — Concurrence : un identifiant déjà pris sélectionne la page existante', async ({ baseURL, testServer }) => {
  const session = await loginAs(baseURL, 'admin');
  const premier = await seedPage(baseURL, session, testServer.refs, {
    page_url: 'https://facebook.com/page-concurrente', nom: '[DEMO] Page Concurrente',
  });
  const second = await callApi(baseURL, session, 'POST', '/api/reseaux/rapide', {
    reseau: 'facebook', page_url: 'https://www.facebook.com/page-concurrente/posts/1',
    nom: '[DEMO] Doublon concurrent', nature: 'page',
  });
  expect(second.status).toBe(200);
  expect(second.body.item.id).toBe(premier.id);
  expect(second.body.item.nom).toBe('[DEMO] Page Concurrente');
});

test('190 — Page Facebook profile.php à identifiant long : ajout par un opérateur sans erreur de validation', async ({ page, baseURL }) => {
  const session = await loginAs(baseURL, 'operateur');
  const errors = collectErrors(page);
  const nom = '[DEMO] 6000 logement Maktaa Kheira Q25/Site01/Ex Cosider';
  await authenticate(page, baseURL, 'operateur');
  await page.goto('/#/anomalies/nouvelle');
  await page.fill('#lien_url', 'https://www.facebook.com/profile.php?id=61590719786996');
  const panneau = page.locator('[data-testid="source-add-panel"]');
  await expect(panneau).toBeVisible();
  await expect(page.locator('#source_nature')).toHaveValue('page');
  await page.fill('#source_nom', nom);
  await page.getByRole('button', { name: 'Enregistrer la page et la sélectionner' }).click();
  await expect(panneau).toHaveCount(0);
  await expect(page.locator('[data-testid="source-picker"]')).toContainText(nom);
  const recherche = await callApi(baseURL, session, 'GET', '/api/reseaux/recherche?q=6000%20logement');
  const pageTrouvee = recherche.body.items.find((item) => item.nom === nom);
  expect(pageTrouvee).toMatchObject({ categorie: 'page', plateforme: 'facebook' });
  expect(pageTrouvee.identifiants).toEqual(expect.arrayContaining([
    expect.objectContaining({ reseau: 'facebook', type: 'id', valeur: '61590719786996' }),
  ]));
  expect(errors.snapshot().pageError).toEqual([]);
});
