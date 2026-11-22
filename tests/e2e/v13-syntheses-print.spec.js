import fs from 'node:fs';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import sharp from 'sharp';
import { todayAlgiers } from '@anm/shared';
import { test, expect } from './fixture.js';
import { authenticate, collectErrors } from './helpers.js';
import { expectAccessible, expectNoOverflow } from './geometry.js';

async function createTreatedPair(page, baseURL, session, testServer, suffix) {
  const cree = await page.request.post(`${baseURL}/api/anomalies`, {
    headers: { 'X-CSRF-Token': session.csrf },
    data: {
      lien_url: `https://facebook.com/v13-planche-${suffix}-${Date.now()}`,
      plateforme: 'facebook', date_signalement: todayAlgiers(),
      domaine_id: testServer.refs.domaine, type_id: testServer.refs.type,
      daira_id: testServer.refs.daira, commune_id: testServer.refs.commune,
      observations: `[DEMO] Planche V13 ${suffix}`,
      epic_id: testServer.refs.epic, agent_id: testServer.refs.agent,
    },
  });
  expect(cree.status(), await cree.text()).toBe(201);
  const item = (await cree.json()).item;
  const patch = await page.request.patch(`${baseURL}/api/anomalies/${item.id}`, {
    headers: { 'X-CSRF-Token': session.csrf },
    data: { version: item.version, statut: 'traite', epic_id: testServer.refs.epic,
      date_traitement: todayAlgiers(), sans_photo_motif: 'Planche préparée pour le test',
      motif: 'Clôture pour la planche photographique' },
  });
  expect(patch.status(), await patch.text()).toBe(200);
  const image = await sharp({ create: { width: 640, height: 480, channels: 3, background: suffix === 'a' ? '#226699' : '#992266' } }).png().toBuffer();
  for (const role of ['avant', 'apres']) {
    const uploaded = await page.request.post(`${baseURL}/api/anomalies/${item.id}/pieces`, {
      headers: { 'X-CSRF-Token': session.csrf },
      multipart: { file: { name: `${suffix}-${role}.png`, mimeType: 'image/png', buffer: image }, role },
    });
    expect(uploaded.status()).toBe(201);
  }
  return { id: item.id, reference: item.reference };
}

test('V13 / 176 — planche avant/après, exports liés, galerie et largeurs persistées', async ({ page, baseURL, testServer }) => {
  const errors = collectErrors(page);
  const session = await authenticate(page, baseURL);
  const paires = [await createTreatedPair(page, baseURL, session, testServer, 'a'),
    await createTreatedPair(page, baseURL, session, testServer, 'b')];

  await page.goto('/#/syntheses');
  await page.getByRole('heading', { name: 'Modèles de synthèse' }).waitFor({ timeout: 15_000 });
  await page.locator('[data-testid^="modele-"]').filter({ has: page.getByRole('heading', { name: 'Synthèse hebdomadaire standard' }) })
    .getByRole('button', { name: /Personnaliser/ }).click();
  await page.locator('[data-testid^="widget-"]').first().waitFor({ state: 'visible', timeout: 35_000 });
  await page.getByRole('button', { name: /Ajouter un widget/ }).click();
  const galerie = page.getByRole('dialog', { name: /Galerie de widgets/ });
  await galerie.getByRole('button', { name: /Comparer avant \/ après/ }).first().click();
  const zone = page.locator('[data-photo-pairs]');
  await zone.waitFor({ state: 'visible', timeout: 20_000 });
  await expect(zone).toHaveAttribute('data-photo-pairs-per-page', '12');
  await expect(page.locator('[data-photo-pair]')).toHaveCount(2);
  const cartes = page.locator('[data-photo-pair]');
  const images = cartes.first().locator('img');
  await expect(images).toHaveCount(2);
  await expect.poll(() => images.first().evaluate((element) => element.naturalWidth)).toBeGreaterThan(0);
  const referenceAffichee = await cartes.first().locator('[data-photo-legend] bdi').first().innerText();
  expect(paires.map((paire) => paire.reference)).toContain(referenceAffichee);
  await expect(cartes.first().locator('[data-photo-legend]')).toContainText('[DEMO] Commune');
  await expect(cartes.first().locator('[data-photo-legend] time')).toHaveCount(2);
  const positions = await cartes.evaluateAll((elements) => elements.map((element) => Math.round(element.getBoundingClientRect().top)));
  expect(positions[0]).toBe(positions[1]);

  await page.emulateMedia({ media: 'print' });
  const rupture = await cartes.first().evaluate((element) => getComputedStyle(element).breakInside);
  expect(rupture).toBe('avoid');
  await page.emulateMedia({ media: 'screen' });

  const exportResponse = await page.request.get(`${baseURL}/api/anomalies/export?format=xlsx`);
  const exportBody = await exportResponse.body();
  expect(exportResponse.status(), exportBody.toString('utf8').slice(0, 400)).toBe(200);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(exportBody);
  const sheet = workbook.getWorksheet('Anomalies');
  expect(sheet.getRow(1).values).toContain('Lien');
  const archive = await JSZip.loadAsync(exportBody);
  const feuilleXml = await archive.file('xl/worksheets/sheet1.xml').async('string');
  const relationsXml = await archive.file('xl/worksheets/_rels/sheet1.xml.rels').async('string');
  expect(feuilleXml).toContain('<hyperlinks>');
  expect(relationsXml).toMatch(/Target="https:\/\//);
  expect(feuilleXml).not.toContain('facebook.com');

  const plancheDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Planche PDF' }).click();
  const planche = await plancheDownload;
  expect(await planche.failure()).toBeNull();
  expect(planche.suggestedFilename()).toMatch(/\.pdf$/);
  const pdf = fs.readFileSync(await planche.path());
  expect(pdf.subarray(0, 8).toString()).toBe('%PDF-1.4');
  expect(pdf.includes(Buffer.from('/Subtype /Image'))).toBe(true);
  expect(pdf.includes(Buffer.from('Page 1 / 1'))).toBe(true);

  await page.goto('/#/anomalies');
  await page.locator('[data-list-mode="galerie"]').click();
  await expect(page.locator('[data-list-gallery]')).toBeVisible();
  await expect(page.locator('[data-gallery-item]').first()).toBeVisible();
  await expect(page.locator('[data-gallery-item]').first().locator('[data-gallery-photos] img')).toHaveCount(2);
  await page.locator('[data-list-mode="standard"]').click();
  const entete = page.locator('th').filter({ hasText: 'Référence' }).first();
  const avant = await entete.evaluate((element) => element.getBoundingClientRect().width);
  const poignee = page.locator('[data-resize-handle="reference"]');
  const box = await poignee.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 70, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  const apres = await entete.evaluate((element) => element.getBoundingClientRect().width);
  expect(apres).toBeGreaterThan(avant + 20);
  await page.reload();
  await expect.poll(() => page.locator('th').filter({ hasText: 'Référence' }).first()
    .evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(avant + 20);

  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expectNoOverflow(page);
  }
  await expectAccessible(page);
  expect(errors.snapshot().pageError).toEqual([]);
  expect(errors.snapshot().consoleError).toEqual([]);
});

test('V13 / 176 — HEIC converti en JPEG par le pipeline', async ({ page, baseURL, testServer }) => {
  const session = await authenticate(page, baseURL, 'operateur');
  let heic = await sharp({ create: { width: 24, height: 24, channels: 3, background: '#336699' } }).avif().toBuffer();
  heic = Buffer.from(heic);
  heic.write('heic', 8, 4, 'ascii');
  const upload = await page.request.post(`${baseURL}/api/anomalies/${testServer.refs.ids[0]}/pieces`, {
    headers: { 'X-CSRF-Token': session.csrf },
    multipart: { file: { name: 'v13.heic', mimeType: 'image/heic', buffer: heic }, role: 'avant' },
  });
  expect(upload.status(), await upload.text()).toBe(201);
  const piece = (await upload.json()).item;
  expect(piece.mime).toBe('image/jpeg');
  expect(piece.variantes.mini).toContain('taille=mini');
  const fichier = await page.request.get(`${baseURL}${piece.url}`);
  expect(fichier.status()).toBe(200);
  expect(fichier.headers()['content-type']).toContain('image/jpeg');
  const metadata = await sharp(await fichier.body()).metadata();
  expect(metadata.format).toBe('jpeg');
});
