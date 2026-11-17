import fs from 'node:fs';
import ExcelJS from 'exceljs';
import { test, expect } from './fixture.js';
import { authenticate, collectErrors, loginAs } from './helpers.js';
import { expectAccessible, expectCompactCards, expectNoOverflow } from './geometry.js';

const fr = JSON.parse(fs.readFileSync(new URL('../../client/src/i18n/fr-reseaux.json', import.meta.url)));
const ar = JSON.parse(fs.readFileSync(new URL('../../client/src/i18n/ar-reseaux.json', import.meta.url)));
const dict = (lang) => lang === 'ar' ? ar : fr;
const dialog = (page, key, lang = 'fr') => page.getByRole('dialog', { name: dict(lang)[key], exact: true });
const openRecord = (page, name, lang = 'fr') => page.getByRole('button', { name: dict(lang)['social.openNamed'].replace('{nom}', name), exact: true });
const kpi = (page, key, value) => expect(page.locator(`[data-social-kpi="${key}"]`).getByText(String(value), { exact: true })).toBeVisible();

async function createAccount(page, base, session, body = {}) {
  const result = await page.request.post(`${base}/api/reseaux-sociaux`, { headers: { 'X-CSRF-Token': session.csrf, Cookie: `sid=${session.token}` },
    data: { nom: '[DEMO] Écologie quartier اسم', lien_url: 'https://facebook.com/demo.ecologie', plateforme: 'facebook', categorie: 'page', ...body } });
  expect(result.status()).toBe(201);
  return (await result.json()).item;
}
async function exportFile(page, label) {
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: label, exact: true }).click();
  const downloaded = await downloading;
  expect(await downloaded.failure()).toBeNull();
  return fs.readFileSync(await downloaded.path());
}
async function expectControlsSeparate(root) {
  const collisions = await root.evaluate((element) => {
    // Les rectangles des champs hors d'un panneau défilant existent encore,
    // mais seule leur intersection avec ses zones visibles peut recouvrir une action.
    const clippedBox = (node) => {
      const rect = node.getBoundingClientRect();
      const box = { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      for (let parent = node.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent); const bounds = parent.getBoundingClientRect();
        if (['auto', 'scroll', 'hidden', 'clip'].includes(style.overflowX)) {
          box.left = Math.max(box.left, bounds.left); box.right = Math.min(box.right, bounds.right);
        }
        if (['auto', 'scroll', 'hidden', 'clip'].includes(style.overflowY)) {
          box.top = Math.max(box.top, bounds.top); box.bottom = Math.min(box.bottom, bounds.bottom);
        }
      }
      return box;
    };
    const controls = [...element.querySelectorAll('button, a, input, select, textarea')]
      .map((node) => ({ node, box: clippedBox(node) })).filter(({ box }) => box.right > box.left && box.bottom > box.top);
    return controls.flatMap((first, index) => controls.slice(index + 1).filter((second) => !first.node.contains(second.node) && !second.node.contains(first.node)
      && first.box.left + 1 < second.box.right && second.box.left + 1 < first.box.right
      && first.box.top + 1 < second.box.bottom && second.box.top + 1 < first.box.bottom)
      .map((second) => [first.node.textContent || first.node.id, second.node.textContent || second.node.id]));
  });
  expect(collisions, 'Champs et actions séparés').toEqual([]);
}
async function expectFooterInDialog(panel, button) {
  const [outer, control, body, footer] = await Promise.all([panel.boundingBox(), button.boundingBox(), panel.locator('[data-dialog-body]').boundingBox(), panel.locator('[data-dialog-footer]').boundingBox()]);
  expect(control.y).toBeGreaterThanOrEqual(outer.y);
  expect(control.y + control.height).toBeLessThanOrEqual(outer.y + outer.height);
  expect(control.x).toBeGreaterThanOrEqual(outer.x);
  expect(control.x + control.width).toBeLessThanOrEqual(outer.x + outer.width);
  expect(body.y + body.height, 'La zone des champs s’arrête avant les actions').toBeLessThanOrEqual(footer.y);
}

test('Répertoire social — saisie administrateur, correction, désactivation, filtres et exports persistants', async ({ page, baseURL, testServer }) => {
  await authenticate(page, baseURL);
  const errors = collectErrors(page);
  await page.goto('/#/admin/reseaux-sociaux');
  await expect(page.getByRole('heading', { name: fr['social.title'], exact: true })).toBeVisible();
  await page.getByRole('button', { name: fr['social.add'], exact: true }).first().click();
  const form = dialog(page, 'social.add');
  await form.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(form.getByText(fr['social.nameRequired'], { exact: true })).toBeVisible();
  await form.getByLabel(fr['social.name'], { exact: true }).fill('[DEMO] Écologie quartier اسم');
  await form.getByLabel(fr['social.link'], { exact: true }).fill('https://facebook.com/demo.ecologie');
  await form.getByLabel(fr['social.accountType'], { exact: true }).selectOption('profil');
  await expect(form.getByLabel('Commune', { exact: true })).toBeDisabled();
  await form.getByLabel(fr['social.ca'], { exact: true }).selectOption(String(testServer.refs.daira));
  await form.getByLabel('Commune', { exact: true }).selectOption(String(testServer.refs.commune));
  await form.getByLabel(fr['social.observations'], { exact: true }).fill('Déchets et espaces verts — حي تجريبي');
  const created = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().endsWith('/api/reseaux-sociaux'));
  await form.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  const response = await created;
  expect(response.status()).toBe(201); expect(response.request().headers()['x-csrf-token']).toBeTruthy();
  const item = (await response.json()).item;
  expect(item).toMatchObject({ categorie: 'profil', commune_id: testServer.refs.commune, version: 1 });
  const detail = dialog(page, 'social.detail');
  await expect(detail.getByRole('heading', { name: item.nom, exact: true })).toBeVisible();
  await detail.getByRole('button', { name: fr['social.edit'], exact: true }).click();
  const editing = dialog(page, 'social.edit');
  await editing.getByLabel(fr['social.link'], { exact: true }).fill('https://tiktok.com/@demo.ecologie/video/123');
  await expect(editing.getByLabel(fr['social.network'], { exact: true })).toHaveValue('tiktok');
  await editing.getByLabel(fr['social.active'], { exact: true }).uncheck();
  await editing.getByLabel(fr['social.verificationLabel'], { exact: true }).selectOption('verifie');
  const changed = page.waitForResponse((res) => res.request().method() === 'PATCH' && res.url().endsWith(`/api/reseaux-sociaux/${item.id}`));
  await editing.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  const patch = await changed;
  expect(patch.request().postDataJSON()).toEqual({ version: 1, lien_url: 'https://tiktok.com/@demo.ecologie/video/123', plateforme: 'tiktok', actif: 0, verification: 'verifie' });
  await expect(detail.getByText(fr['social.inactive'], { exact: true })).toBeVisible();
  await detail.getByRole('button', { name: 'Fermer', exact: true }).click();
  await page.getByLabel(fr['social.activity'], { exact: true }).selectOption('0');
  await page.getByLabel(fr['social.network'], { exact: true }).selectOption('tiktok');
  await page.getByLabel(fr['social.search'], { exact: true }).fill('ecologie');
  await kpi(page, 'total', 1);
  await page.reload();
  await expect(page.getByLabel(fr['social.activity'], { exact: true })).toHaveValue('0');
  await expect(page.getByLabel(fr['social.network'], { exact: true })).toHaveValue('tiktok');
  await expect(page.getByLabel(fr['social.search'], { exact: true })).toHaveValue('ecologie');
  await expect(openRecord(page, item.nom)).toBeVisible();
  const csv = (await exportFile(page, fr['social.exportCsv'])).toString('utf8');
  expect(csv).toContain(item.nom); expect(csv).toContain('Déchets et espaces verts'); expect(csv).toContain('TikTok');
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(await exportFile(page, fr['social.exportExcel']));
  expect(workbook.getWorksheet('Répertoire').rowCount).toBe(2);
  expect(workbook.getWorksheet('Par réseau').getCell('B2').value).toBe(1);
  await openRecord(page, item.nom).click();
  await page.reload();
  await expect(detail.getByRole('heading', { name: item.nom, exact: true })).toBeVisible();
  await expect(detail.getByText(fr['social.inactive'], { exact: true })).toBeVisible();
  expect(errors.snapshot().pageError).toEqual([]);
  expect(errors.snapshot().consoleError).toEqual([]);
});

test('Répertoire social — un doublon inactif reste intact et la saisie peut être corrigée manuellement', async ({ page, baseURL }) => {
  const session = await authenticate(page, baseURL);
  await createAccount(page, baseURL, session, { nom: '[DEMO] Compte désactivé', actif: 0 });
  await page.goto('/#/');
  await page.getByRole('link', { name: fr['nav.socialDirectory'], exact: true }).click();
  await expect(page).toHaveURL(/\/#\/reseaux-sociaux$/);
  await page.getByRole('button', { name: fr['social.add'], exact: true }).click();
  const form = dialog(page, 'social.add');
  await form.getByLabel(fr['social.name'], { exact: true }).fill('[DEMO] Nouveau nom à conserver');
  await form.getByLabel(fr['social.link'], { exact: true }).fill('http://m.facebook.com/DEMO.ECOLOGIE/?fbclid=abc');
  const duplicate = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().endsWith('/api/reseaux-sociaux'));
  await form.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  expect((await duplicate).status()).toBe(409);
  await expect(form.getByText(fr['social.duplicateHelp'], { exact: true })).toBeVisible();
  await expect(form.getByText('[DEMO] Compte désactivé', { exact: true })).toBeVisible();
  await expect(form.getByLabel(fr['social.name'], { exact: true })).toHaveValue('[DEMO] Nouveau nom à conserver');
  const before = await (await page.request.get(`${baseURL}/api/reseaux-sociaux`)).json();
  expect(before.total).toBe(1); expect(before.items[0]).toMatchObject({ nom: '[DEMO] Compte désactivé', actif: 0, version: 1 });
  await form.getByLabel(fr['social.link'], { exact: true }).fill('https://facebook.com/demo.ecologie.nouveau');
  await form.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(dialog(page, 'social.detail').getByRole('heading', { name: '[DEMO] Nouveau nom à conserver', exact: true })).toBeVisible();
  const after = await (await page.request.get(`${baseURL}/api/reseaux-sociaux`)).json();
  expect(after.total).toBe(2);
  expect(after.items.find((row) => row.nom === '[DEMO] Compte désactivé')).toMatchObject({ actif: 0, version: 1 });
});

test('Répertoire social — pagination, tri, filtres, statistiques et exports portent sur la même sélection complète', async ({ page, baseURL, testServer }) => {
  const session = await authenticate(page, baseURL);
  await Promise.all(Array.from({ length: 12 }, (_, index) => createAccount(page, baseURL, session, {
    nom: `[DEMO] Annuaire ${String(index).padStart(2, '0')}`, lien_url: `https://facebook.com/demo.annuaire.${index}`,
    categorie: index % 3 === 0 ? 'profil' : 'page', daira_id: testServer.refs.daira, commune_id: testServer.refs.commune,
  })));
  await createAccount(page, baseURL, session, { nom: '[DEMO] Hors filtre', daira_id: testServer.refs.secondDaira, commune_id: testServer.refs.secondCommune });
  await page.goto(`/#/reseaux-sociaux?daira_id=${testServer.refs.daira}&pageSize=10&sort=nom&dir=desc`);
  await kpi(page, 'total', 12); await kpi(page, 'pages', 8); await kpi(page, 'profils', 4);
  const listing = page.locator('[data-social-list]');
  await expect(listing.locator('table tbody tr')).toHaveCount(10);
  await expect(openRecord(page, '[DEMO] Annuaire 11')).toBeVisible();
  await listing.getByRole('button', { name: 'Suivant', exact: true }).click();
  await expect(listing.locator('table tbody tr')).toHaveCount(2);
  await kpi(page, 'total', 12);
  await page.reload();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByLabel('Lignes par page', { exact: true })).toHaveValue('10');
  await expect(listing.locator('table tbody tr')).toHaveCount(2);
  await expect(openRecord(page, '[DEMO] Annuaire 01')).toBeVisible();
  const expected = Array.from({ length: 12 }, (_, index) => `[DEMO] Annuaire ${String(11 - index).padStart(2, '0')}`);
  const csv = (await exportFile(page, fr['social.exportCsv'])).toString('utf8');
  expect(csv.split('\r\n')).toHaveLength(13);
  expect(csv.indexOf(expected[0])).toBeLessThan(csv.indexOf(expected[11]));
  expect(csv).not.toContain('[DEMO] Hors filtre');
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(await exportFile(page, fr['social.exportExcel']));
  expect(workbook.getWorksheet('Répertoire').getColumn(1).values.slice(2)).toEqual(expected);
  expect(workbook.getWorksheet('Par réseau').getCell('B2').value).toBe(12);
  expect(workbook.getWorksheet('Par type').getRows(2, 2).map((row) => [row.getCell(1).value, row.getCell(2).value])).toEqual([['Page locale', 8], ['Profil citoyen', 4]]);
  expect(JSON.parse(workbook.getWorksheet('Périmètre').getCell('B4').value)).toMatchObject({ daira_id: testServer.refs.daira });
  expect((await (await page.request.get(`${baseURL}/api/reseaux-sociaux?commune_id=${testServer.refs.secondCommune}`)).json()).items.map((row) => row.nom)).toEqual(['[DEMO] Hors filtre']);
  await page.getByRole('tab', { name: fr['social.statistics'], exact: true }).click();
  await page.locator('[data-social-stats] section').filter({ has: page.getByRole('heading', { name: fr['social.byType'], exact: true }) })
    .getByRole('button', { name: /Page locale/ }).click();
  await kpi(page, 'total', 8);
  await expect(page).toHaveURL(/categorie=page/);
  await expect(page).not.toHaveURL(/page=2/);
  await expect(listing.locator('table tbody tr')).toHaveCount(8);
  expect((await exportFile(page, fr['social.exportCsv'])).toString('utf8').split('\r\n')).toHaveLength(9);
});

test('Répertoire social — les 95 liens fournis sont intégrés, classés et jamais écrasés à la relance', async ({ page, baseURL }) => {
  await authenticate(page, baseURL);
  await page.goto('/#/reseaux-sociaux');
  await page.getByRole('button', { name: fr['social.import'], exact: true }).click();
  const importing = dialog(page, 'social.importTitle');
  await importing.getByRole('button', { name: fr['social.previewSupplied'], exact: true }).click();
  await expect(importing.getByRole('button', { name: 'Importer 95 nouvelles fiches', exact: true })).toBeEnabled();
  await expect(importing.getByText('Alger-centre-العاصمة الجزائرية', { exact: true })).toBeVisible();
  const committed = page.waitForResponse((response) => response.url().endsWith('/api/reseaux-sociaux/import/commit'));
  await importing.getByRole('button', { name: 'Importer 95 nouvelles fiches', exact: true }).click();
  expect((await (await committed).json()).item.created).toBe(95);
  await expect(importing.getByText(fr['social.importDone'], { exact: true })).toBeVisible();
  await importing.getByRole('button', { name: fr['social.finish'], exact: true }).click();
  await kpi(page, 'total', 95); await kpi(page, 'pages', 79); await kpi(page, 'profils', 10);
  await page.getByRole('tab', { name: fr['social.statistics'], exact: true }).click();
  await expect(page.getByRole('heading', { name: fr['social.byNetwork'], exact: true })).toBeVisible();
  const stats = (await (await page.request.get(`${baseURL}/api/reseaux-sociaux/stats`)).json()).item;
  expect(stats.resume).toMatchObject({ total: 95, pages: 79, profils: 10, groupes: 6, reseaux: 2 });
  expect(stats.reseaux.map((row) => [row.key, row.total])).toEqual([['facebook', 94], ['tiktok', 1]]);
  await page.getByRole('tab', { name: fr['social.directory'], exact: true }).click();
  await page.getByLabel(fr['social.search'], { exact: true }).fill('algercentre.org');
  await openRecord(page, 'Alger-centre-العاصمة الجزائرية').click();
  const detail = dialog(page, 'social.detail');
  await expect(detail.getByText('ALGER CENTRE', { exact: true }).last()).toBeVisible();
  await expect(detail.getByText(fr['social.sourceTrace'], { exact: true })).toBeVisible();
  await detail.getByRole('button', { name: fr['social.edit'], exact: true }).click();
  const editing = dialog(page, 'social.edit');
  await editing.getByLabel(fr['social.name'], { exact: true }).fill('[DEMO] Nom corrigé par administrateur');
  await editing.getByLabel(fr['social.active'], { exact: true }).uncheck();
  await editing.getByLabel(fr['social.observations'], { exact: true }).fill('[DEMO] Correction à préserver');
  await editing.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(detail.getByRole('heading', { name: '[DEMO] Nom corrigé par administrateur', exact: true })).toBeVisible();
  await detail.getByRole('button', { name: 'Fermer', exact: true }).click();
  await page.getByRole('button', { name: fr['social.import'], exact: true }).click();
  await importing.getByRole('button', { name: fr['social.previewSupplied'], exact: true }).click();
  await expect(importing.getByRole('button', { name: 'Importer 0 nouvelles fiches', exact: true })).toBeDisabled();
  await expect(importing.getByText(fr['social.nothingToImport'], { exact: true })).toBeVisible();
  await importing.getByRole('button', { name: 'Annuler', exact: true }).click();
  const list = (await (await page.request.get(`${baseURL}/api/reseaux-sociaux?q=algercentre.org`)).json());
  expect(list.total).toBe(1);
  expect(list.items[0]).toMatchObject({ nom: '[DEMO] Nom corrigé par administrateur', nom_source: 'Alger-centre-العاصمة الجزائرية', actif: 0,
    observations: '[DEMO] Correction à préserver', version: 2 });
  const refs = await (await page.request.get(`${baseURL}/api/ref/bootstrap`)).json();
  expect(refs.dairas).toHaveLength(2); expect(refs.dairas.flatMap((row) => row.communes)).toHaveLength(2);
});

test('Répertoire social — import Excel avec cellules fusionnées, hyperliens, doublons et nom absent', async ({ page, baseURL }) => {
  await authenticate(page, baseURL);
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet('Autre feuille').addRow(['ne pas importer']);
  const sheet = workbook.addWorksheet('LIEN');
  sheet.addRow(['CA', 'COMMUNES', 'lien', '', 'autres']);
  sheet.addRow(['[DEMO] Daïra', '[DEMO] Commune', { text: 'https://facebook.com/affiche', hyperlink: 'https://facebook.com/demo.excel' },
    { richText: [{ text: '[DEMO] ' }, { text: 'Page Excel اسم' }] }, 'https://tiktok.com/@demo.excel/video/123', '[DEMO] Profil Excel']);
  sheet.addRow(['', '', 'http://m.facebook.com/DEMO.EXCEL/?fbclid=abc', '[DEMO] Doublon', 'javascript:alert(1)', 'Non importé']);
  sheet.addRow(['', '', 'https://facebook.com/groups/123456']);
  sheet.mergeCells('A2:A4'); sheet.mergeCells('B2:B4');
  await page.goto('/#/reseaux-sociaux');
  await page.getByRole('button', { name: fr['social.import'], exact: true }).click();
  const importing = dialog(page, 'social.importTitle');
  await importing.getByLabel(fr['social.chooseFile'], { exact: true }).setInputFiles({ name: 'tableau-test.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(await workbook.xlsx.writeBuffer()) });
  const analyzed = page.waitForResponse((response) => response.url().endsWith('/api/reseaux-sociaux/import/preview'));
  await importing.getByRole('button', { name: fr['social.previewFile'], exact: true }).click();
  const preview = (await (await analyzed).json()).item;
  expect(preview.summary).toMatchObject({ total: 5, nouveaux: 3, doublons: 1, erreurs: 1 });
  expect(preview.rows.find((row) => row.ligne === 2 && row.colonne === 'C')).toMatchObject({ lien_url: 'https://facebook.com/demo.excel', nom: '[DEMO] Page Excel اسم' });
  await importing.getByRole('button', { name: 'Importer 3 nouvelles fiches', exact: true }).click();
  await expect(importing.getByText(fr['social.importDone'], { exact: true })).toBeVisible();
  await importing.getByRole('button', { name: fr['social.finish'], exact: true }).click();
  await kpi(page, 'total', 3);
  await openRecord(page, fr['social.missingName']).click();
  const detail = dialog(page, 'social.detail');
  await detail.getByRole('button', { name: fr['social.edit'], exact: true }).click();
  const editing = dialog(page, 'social.edit');
  await editing.getByLabel(fr['social.active'], { exact: true }).uncheck();
  await editing.getByLabel(fr['social.observations'], { exact: true }).fill('[DEMO] Nom à confirmer, ne pas inventer');
  await editing.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(detail.getByText(fr['social.inactive'], { exact: true })).toBeVisible();
  const listed = await (await page.request.get(`${baseURL}/api/reseaux-sociaux`)).json();
  expect(listed.items.find((row) => row.categorie === 'groupe')).toMatchObject({ nom: '', actif: 0, verification: 'a_verifier', nom_source: '', ligne_source: 4 });
  expect(listed.items.every((row) => row.commune_id !== null)).toBe(true);
  expect(listed.items.find((row) => row.nom === '[DEMO] Page Excel اسم').lien_url).toBe('https://facebook.com/demo.excel');
});

for (const role of ['lecteur', 'operateur']) {
  test(`Répertoire social — ${role} consulte les noms, statistiques et exports sans outils administrateur`, async ({ page, baseURL, testServer }) => {
    const admin = await loginAs(baseURL);
    await createAccount(page, baseURL, admin, { daira_id: testServer.refs.daira, commune_id: testServer.refs.commune });
    await authenticate(page, baseURL, role);
    const errors = collectErrors(page);
    await page.goto('/#/reseaux-sociaux?onglet=statistiques');
    await kpi(page, 'total', 1);
    await expect(page.getByRole('button', { name: fr['social.add'], exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: fr['social.import'], exact: true })).toHaveCount(0);
    await openRecord(page, '[DEMO] Écologie quartier اسم').click();
    const detail = dialog(page, 'social.detail');
    await expect(detail.getByRole('button', { name: fr['social.edit'], exact: true })).toHaveCount(0);
    await expect(detail.getByRole('link', { name: fr['social.openLink'], exact: true })).toHaveAttribute('rel', 'noopener noreferrer');
    await detail.getByRole('button', { name: 'Fermer', exact: true }).click();
    expect((await exportFile(page, fr['social.exportCsv'])).toString('utf8')).toContain('[DEMO] Écologie quartier اسم');
    await page.goto('/#/admin/reseaux-sociaux');
    await expect(page).toHaveURL(/\/#\/$/);
    expect(errors.snapshot().pageError).toEqual([]); expect(errors.snapshot().consoleError).toEqual([]);
  });
}

test('Répertoire social — conflit de version : aucun écrasement ni nouvelle tentative automatique', async ({ page, baseURL }) => {
  const session = await authenticate(page, baseURL);
  const item = await createAccount(page, baseURL, session);
  await page.goto(`/#/reseaux-sociaux?fiche=${item.id}`);
  await dialog(page, 'social.detail').getByRole('button', { name: fr['social.edit'], exact: true }).click();
  const form = dialog(page, 'social.edit');
  await form.getByLabel(fr['social.name'], { exact: true }).fill('[DEMO] Brouillon en conflit');
  const concurrent = await page.request.patch(`${baseURL}/api/reseaux-sociaux/${item.id}`, { headers: { 'X-CSRF-Token': session.csrf }, data: { version: 1, nom: '[DEMO] Modification concurrente' } });
  expect(concurrent.status()).toBe(200);
  const bodies = [];
  await page.route('**/api/reseaux-sociaux/*', (route) => {
    if (route.request().method() === 'PATCH') bodies.push(route.request().postDataJSON());
    return route.continue();
  });
  await form.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(form.getByText(fr['social.conflict'], { exact: true })).toBeVisible();
  await expect(form.getByRole('button', { name: 'Enregistrer', exact: true })).toBeDisabled();
  await form.getByLabel(fr['social.name'], { exact: true }).fill('[DEMO] Brouillon encore modifié');
  await expect(form.getByRole('button', { name: 'Enregistrer', exact: true })).toBeDisabled();
  expect(bodies).toEqual([{ version: 1, nom: '[DEMO] Brouillon en conflit' }]);
  let reloads = 0;
  await page.route(`**/api/reseaux-sociaux/${item.id}`, (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    reloads += 1;
    if (reloads === 1) return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { code: 'ERREUR_INTERNE', message: 'Rechargement temporairement indisponible' } }) });
    return route.fallback();
  });
  await form.getByRole('button', { name: fr['social.reloadRecord'], exact: true }).click();
  await expect(form.getByText('Rechargement temporairement indisponible', { exact: true })).toBeVisible();
  await expect(form.getByRole('button', { name: 'Enregistrer', exact: true })).toBeDisabled();
  await form.getByLabel(fr['social.name'], { exact: true }).fill('[DEMO] Brouillon après échec de rechargement');
  await expect(form.getByRole('button', { name: 'Enregistrer', exact: true })).toBeDisabled();
  expect(bodies).toHaveLength(1);
  await form.getByRole('button', { name: fr['social.reloadRecord'], exact: true }).click();
  await expect(form.getByLabel(fr['social.name'], { exact: true })).toHaveValue('[DEMO] Modification concurrente');
  await form.getByLabel(fr['social.observations'], { exact: true }).fill('[DEMO] Nouvelle observation après rechargement');
  await form.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(dialog(page, 'social.detail').getByRole('heading', { name: '[DEMO] Modification concurrente', exact: true })).toBeVisible();
  expect(bodies[1]).toEqual({ version: 2, observations: '[DEMO] Nouvelle observation après rechargement' });
  const saved = (await (await page.request.get(`${baseURL}/api/reseaux-sociaux/${item.id}`)).json()).item;
  expect(saved).toMatchObject({ nom: '[DEMO] Modification concurrente', version: 3 });
});

test('Répertoire social — un refus conserve le formulaire ; Échap protège le brouillon et la reprise est manuelle', async ({ page, baseURL }) => {
  await authenticate(page, baseURL);
  const bodies = [];
  await page.route('**/api/reseaux-sociaux', (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    bodies.push(route.request().postDataJSON());
    if (bodies.length === 1) return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { code: 'ERREUR_INTERNE', message: 'Refus temporaire de test' } }) });
    return route.continue();
  });
  await page.goto('/#/reseaux-sociaux');
  await page.getByRole('button', { name: fr['social.add'], exact: true }).first().click();
  const form = dialog(page, 'social.add');
  await form.getByLabel(fr['social.name'], { exact: true }).fill('[DEMO] Brouillon préservé');
  await form.getByLabel(fr['social.link'], { exact: true }).fill('https://facebook.com/demo.brouillon');
  await form.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(form.getByText('Refus temporaire de test', { exact: true })).toBeVisible();
  expect(bodies).toHaveLength(1);
  await page.keyboard.press('Escape');
  await expect(form.getByText(fr['social.unsaved'], { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(form.getByLabel(fr['social.name'], { exact: true })).toHaveValue('[DEMO] Brouillon préservé');
  await page.keyboard.press('Escape');
  await expect(form.getByText(fr['social.unsaved'], { exact: true })).toBeVisible();
  await form.getByRole('button', { name: fr['social.keepEditing'], exact: true }).click();
  await expect(form.getByLabel(fr['social.name'], { exact: true })).toHaveValue('[DEMO] Brouillon préservé');
  await form.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(dialog(page, 'social.detail').getByRole('heading', { name: '[DEMO] Brouillon préservé', exact: true })).toBeVisible();
  expect(bodies).toHaveLength(2); expect(bodies[1]).toEqual(bodies[0]);
});

test('Répertoire social — une réponse de liste invalide ne devient pas une fausse base vide', async ({ page, baseURL }) => {
  const session = await authenticate(page, baseURL);
  await createAccount(page, baseURL, session);
  let calls = 0;
  await page.route('**/api/reseaux-sociaux?*', (route) => {
    calls += 1;
    if (calls === 1) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) });
    return route.continue();
  });
  await page.goto('/#/reseaux-sociaux');
  const listing = page.locator('[data-social-list]');
  await expect(listing.getByText(fr['social.badResponse'], { exact: true })).toBeVisible();
  await expect(listing.getByText(fr['social.empty'], { exact: true })).toHaveCount(0);
  await listing.getByRole('button', { name: 'Réessayer', exact: true }).click();
  await expect(openRecord(page, '[DEMO] Écologie quartier اسم')).toBeVisible();
  expect(calls).toBe(2);
});

test('Répertoire social — le détail d’un libellé non rattaché sélectionne exactement ses fiches', async ({ page, baseURL }) => {
  const session = await authenticate(page, baseURL);
  await createAccount(page, baseURL, session, { nom: '[DEMO] Commune A', ca_libelle: '[DEMO] CA A', commune_libelle: '[DEMO] Commune A' });
  await createAccount(page, baseURL, session, { nom: '[DEMO] Commune A bis', lien_url: 'https://facebook.com/demo.bis', ca_libelle: '[DEMO] CA A', commune_libelle: '[DEMO] Commune A bis' });
  await page.goto('/#/reseaux-sociaux?onglet=statistiques');
  await kpi(page, 'total', 2);
  await page.locator('[data-social-stats] table').getByRole('button', { name: '[DEMO] Commune A', exact: true }).click();
  await kpi(page, 'total', 1);
  await expect(openRecord(page, '[DEMO] Commune A')).toBeVisible();
  await expect(openRecord(page, '[DEMO] Commune A bis')).toHaveCount(0);
  await expect(page.getByText(fr['social.attachmentFilter'], { exact: false })).toBeVisible();
  await page.reload();
  await kpi(page, 'total', 1);
  await page.getByRole('button', { name: fr['social.clearAttachmentFilter'], exact: true }).click();
  await kpi(page, 'total', 2);
});

for (const lang of ['fr', 'ar']) for (const theme of ['light', 'dark']) {
  test(`Répertoire social — FR/AR, thèmes, formulaires et statistiques accessibles / ${lang} / ${theme}`, async ({ page, baseURL, testServer }, info) => {
    test.setTimeout(120_000);
    await page.addInitScript(({ lang, theme }) => { localStorage.setItem('anm-language', lang); localStorage.setItem('anm-theme', theme); }, { lang, theme });
    const session = await authenticate(page, baseURL);
    const name = '[DEMO] Page environnement et cadre de vie — صفحة البيئة والإطار المعيشي للحي التجريبي';
    await createAccount(page, baseURL, session, { nom: name, daira_id: testServer.refs.daira, commune_id: testServer.refs.commune,
      observations: '[DEMO] Déchets, eau et espaces verts. ملاحظات عن النفايات والمياه والمساحات الخضراء' });
    await createAccount(page, baseURL, session, { nom: '[DEMO] Profil citoyen مواطن', lien_url: 'https://tiktok.com/@demo.citoyen', plateforme: 'tiktok', categorie: 'profil' });
    const text = dict(lang);
    const common = JSON.parse(fs.readFileSync(new URL(`../../client/src/i18n/${lang}.json`, import.meta.url)));
    const errors = collectErrors(page);
    for (const width of [390, 768, 1024, 1440]) {
      await test.step(`${width} px`, async () => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/#/reseaux-sociaux?onglet=statistiques');
        await expect(page.getByRole('heading', { name: text['social.title'], exact: true })).toBeVisible();
        await kpi(page, 'total', 2);
        await expect(page.locator('html')).toHaveAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        const shares = page.locator('[data-social-share]');
        await expect(shares).toHaveCount(4);
        for (const share of await shares.all()) {
          const total = share.locator('[data-share-total]'); const percentage = share.locator('[data-share-percentage]');
          await expect(total).toHaveText('1'); await expect(total).toHaveAttribute('dir', 'ltr');
          await expect(percentage).toHaveText('50 %'); await expect(percentage).toHaveAttribute('dir', 'ltr');
          const [countBox, shareBox] = await Promise.all([total.boundingBox(), percentage.boundingBox()]);
          const gap = lang === 'ar' ? countBox.x - (shareBox.x + shareBox.width) : shareBox.x - (countBox.x + countBox.width);
          expect(gap, 'Le compteur et son pourcentage restent distincts, même en RTL').toBeGreaterThanOrEqual(7);
        }
        await expect(page.locator('[data-social-coverage-ratio]')).toHaveText('1 / 2');
        await expect(page.locator('[data-social-coverage-ratio]')).toHaveAttribute('dir', 'ltr');
        await expect(page.locator('[data-social-coverage-percentage]')).toHaveText('50 %');
        await expect(page.locator('[data-social-coverage-percentage]')).toHaveAttribute('dir', 'ltr');
        await expectNoOverflow(page); await expectCompactCards(page); await expectAccessible(page);
        await expectControlsSeparate(page.locator('[data-social-workspace]'));
        if (width === 1440) await info.attach(`repertoire-${lang}-${theme}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
        await page.getByRole('button', { name: text['social.add'], exact: true }).click();
        const form = dialog(page, 'social.add', lang);
        await expect(form).toBeVisible(); await expectNoOverflow(page); await expectAccessible(page); await expectControlsSeparate(form);
        await expectFooterInDialog(form, form.getByRole('button', { name: common['common.save'], exact: true }));
        await form.locator('[data-dialog-body]').evaluate((element) => { element.scrollTop = element.scrollHeight; });
        await expect(form.getByLabel(text['social.observations'], { exact: true })).toBeInViewport();
        await expectControlsSeparate(form);
        await expectFooterInDialog(form, form.getByRole('button', { name: common['common.save'], exact: true }));
        await form.getByRole('button', { name: common['common.close'], exact: true }).click();
        await openRecord(page, name, lang).click();
        const detail = dialog(page, 'social.detail', lang);
        await expect(detail.getByRole('heading', { name, exact: true })).toBeVisible();
        await expectNoOverflow(page); await expectAccessible(page);
        await detail.getByRole('button', { name: common['common.close'], exact: true }).click();
        await page.getByRole('button', { name: text['social.import'], exact: true }).click();
        const importing = dialog(page, 'social.importTitle', lang);
        await importing.getByRole('button', { name: text['social.previewSupplied'], exact: true }).click();
        const commit = importing.getByRole('button', { name: text['social.importValid'].replace('{count}', '95'), exact: true });
        await expect(commit).toBeEnabled();
        await expectNoOverflow(page); await expectAccessible(page); await expectControlsSeparate(importing);
        const previewTable = importing.getByRole('region', { name: text['social.importPreviewTable'], exact: true });
        await previewTable.focus(); await previewTable.press('End');
        await expect.poll(() => previewTable.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
        await expectControlsSeparate(importing);
        await expectFooterInDialog(importing, commit);
        await importing.getByRole('button', { name: common['common.cancel'], exact: true }).click();
        await page.reload(); await kpi(page, 'total', 2);
      });
    }
    expect(errors.snapshot().pageError).toEqual([]); expect(errors.snapshot().consoleError).toEqual([]);
  });
}

test('Répertoire social — cinq vues, file de qualification avec raccourcis et annulation', async ({ page, baseURL }) => {
  const session = await authenticate(page, baseURL);
  const item = await createAccount(page, baseURL, session, { nom: '[DEMO] À qualifier vite' });
  const errors = collectErrors(page);
  await page.goto('/#/reseaux?onglet=qualifier');
  await expect(page).toHaveURL(/onglet=qualifier/);
  const queue = page.locator('[data-qualify-queue]');
  await expect(queue.locator(`[data-qualify-item="${item.id}"]`)).toBeVisible();
  const stored = async () => (await (await page.request.get(`${baseURL}/api/reseaux-sociaux/${item.id}`)).json()).item;
  await page.keyboard.press('g');
  await expect.poll(stored).toMatchObject({ categorie: 'groupe', verification: 'verifie', actif: 1 });
  await expect(page.getByRole('button', { name: fr['social.qualify.undo'], exact: true })).toBeEnabled();
  await page.keyboard.press('z');
  await expect.poll(stored).toMatchObject({ categorie: 'page', verification: 'a_verifier', actif: 1 });
  await queue.locator(`[data-qualify-item="${item.id}"]`).getByRole('button', { name: fr['social.qualify.action.ignorer'] }).click();
  await expect.poll(stored).toMatchObject({ verification: 'verifie', actif: 0 });
  await page.getByRole('tab', { name: fr['social.tab.imports'], exact: true }).click();
  await expect(page.locator('[data-social-imports]')).toBeVisible();
  await page.getByRole('tab', { name: fr['social.tab.quality'], exact: true }).click();
  await expect(page.locator('[data-social-quality]')).toBeVisible();
  await expect(page.locator('[data-social-quality]').getByText(fr['social.quality.toReview'], { exact: true })).toBeVisible();
  expect(errors.snapshot().pageError).toEqual([]); expect(errors.snapshot().consoleError).toEqual([]);
});

test('Répertoire social — un aperçu peut être annulé sans aucune écriture', async ({ page, baseURL }) => {
  await authenticate(page, baseURL);
  await page.goto('/#/reseaux?onglet=imports');
  await page.getByRole('button', { name: fr['social.imports.start'], exact: true }).click();
  const importing = dialog(page, 'social.importTitle');
  await importing.getByRole('button', { name: fr['social.previewSupplied'], exact: true }).click();
  await expect(importing.getByRole('button', { name: fr['social.imports.cancelPreview'], exact: true })).toBeEnabled();
  await expect(importing.getByRole('button', { name: fr['social.importValid'].replace('{count}', '95'), exact: true })).toBeEnabled();
  await importing.getByRole('button', { name: fr['social.imports.cancelPreview'], exact: true }).click();
  await expect(page.getByText(fr['social.imports.cancelled'], { exact: true })).toBeVisible();
  expect((await (await page.request.get(`${baseURL}/api/reseaux-sociaux`)).json()).total).toBe(0);
});
