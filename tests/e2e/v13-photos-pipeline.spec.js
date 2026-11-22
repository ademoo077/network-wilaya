import sharp from 'sharp';
import { todayAlgiers } from '@anm/shared';
import { test, expect } from './fixture.js';
import { authenticate, collectErrors } from './helpers.js';
import { expectNoOverflow, expectAccessible } from './geometry.js';

async function bootstrap(page, baseURL, testServer) {
  const payload = await (await page.request.get(`${baseURL}/api/ref/bootstrap`)).json();
  const refs = payload.refs || payload;
  const domain = refs.domaines.find((item) => item.types.some((type) => type.id === testServer.refs.type));
  const daira = refs.dairas.find((item) => item.id === testServer.refs.daira);
  return {
    domain: domain.name_fr || domain.name_ar,
    type: domain.types.find((item) => item.id === testServer.refs.type).name_ar,
    daira: daira.name_fr || daira.name_ar,
    commune: daira.communes.find((item) => item.id === testServer.refs.commune).name_fr,
  };
}

async function choose(page, id, label) {
  await page.locator(`#${id}`).fill(label);
  await page.getByRole('option', { name: label, exact: true }).first().click();
}

test('V13 — images versionnées, dérivés WebP/JPEG et cache immuable', async ({ page, baseURL, testServer }) => {
  const errors = collectErrors(page);
  const session = await authenticate(page, baseURL);
  const refs = await bootstrap(page, baseURL, testServer);
  await page.goto('/#/anomalies/nouvelle');
  await page.locator('#lien_url').fill(`https://facebook.com/v13-photos-${Date.now()}`);
  await page.locator('#lien_url').blur();
  await page.locator('#plateforme').selectOption('facebook');
  await page.locator('#date_signalement').fill(todayAlgiers());
  await choose(page, 'domaine_id', refs.domain);
  await choose(page, 'type_id', refs.type);
  await choose(page, 'daira_id', refs.daira);
  await choose(page, 'commune_id', refs.commune);
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).last().click();
  await expect(page.locator('h1')).toContainText('-');
  const id = Number(page.url().match(/#\/anomalies\/(\d+)/)?.[1]);
  expect(id).toBeGreaterThan(0);

  const png = await sharp({ create: { width: 640, height: 480, channels: 3, background: '#2c6699' } }).png().toBuffer();
  const upload = await page.request.post(`${baseURL}/api/anomalies/${id}/pieces`, {
    headers: { 'X-CSRF-Token': session.csrf },
    multipart: {
      file: { name: 'Par daïra.png', mimeType: 'image/png', buffer: png },
      role: 'avant',
    },
  });
  expect(upload.status()).toBe(201);
  const piece = (await upload.json()).item;
  expect(piece.hash).toMatch(/^[a-f0-9]{64}$/);
  expect(piece.largeur).toBe(640);
  expect(piece.hauteur).toBe(480);
  expect(piece.apercu_flou).toMatch(/^data:image\/webp;base64,/);
  expect(piece.variantes.mini).toContain('taille=mini');

  const mini = await page.request.get(`${baseURL}${piece.variantes.mini}`);
  expect(mini.status()).toBe(200);
  expect(mini.headers()['content-type']).toContain('image/webp');
  expect(mini.headers()['cache-control']).toBe('private, max-age=86400, immutable');
  const etag = mini.headers().etag;
  expect(etag).toMatch(/^".+"$/);
  const cached = await page.request.get(`${baseURL}${piece.variantes.mini}`, { headers: { 'If-None-Match': etag } });
  expect(cached.status()).toBe(304);
  const perimee = await page.request.get(`${baseURL}/api/photos/${piece.id}/file?v=0000000000000000`);
  expect(perimee.status()).toBe(404);
  const invalide = await page.request.get(`${baseURL}/api/photos/${piece.id}/file?taille=enorme`);
  expect(invalide.status()).toBe(400);

  await page.reload();
  const image = page.locator('img[src*="/api/photos/"]').first();
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((element) => element.naturalWidth)).toBeGreaterThan(0);
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expectNoOverflow(page);
  }
  await expectAccessible(page);
  expect(errors.snapshot().pageError).toEqual([]);
});
