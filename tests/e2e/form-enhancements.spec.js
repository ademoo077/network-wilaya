import { test, expect } from './fixture.js';
import { authenticate, pasteText, collectErrors } from './helpers.js';
import { expectAccessible, expectActionBarClear, expectNoOverflow } from './geometry.js';

async function choose(page, id, label) {
  await page.locator(`#${id}`).fill(label);
  await page.getByRole('option', { name: label, exact: true }).click();
}
async function complete(page, link) {
  await page.locator('#lien_url').fill(link);
  await choose(page, 'domaine_id', 'نفايات منزلية');
  await choose(page, 'type_id', 'مفرغة عشوائية');
  await choose(page, 'daira_id', '[DEMO] Daïra');
  await choose(page, 'commune_id', '[DEMO] Commune');
}

test.beforeEach(async ({ page, baseURL }) => { await authenticate(page, baseURL); await page.goto('/#/anomalies/nouvelle'); });

test('suggestions de types depuis le texte arabe, choix explicite et annulation groupée', async ({ page }) => {
  const errors = collectErrors(page);
  await choose(page, 'domaine_id', 'نفايات منزلية'); await choose(page, 'type_id', 'مفرغة عشوائية');
  await pasteText(page, '#smart-paste', 'بلاغ من المواطن: توجد حُفْرَةٌ كبيرة في الطريق قرب الحي. https://facebook.com/posts/type-suggestion');
  const hint = page.getByRole('button', { name: 'Choisir الطريق › حفرة', exact: true });
  await expect(hint).toBeVisible({ timeout: 1000 });
  await expect(page.locator('#type_id')).toHaveValue('مفرغة عشوائية');
  await hint.click(); await expect(page.locator('#domaine_id')).toHaveValue('الطريق'); await expect(page.locator('#type_id')).toHaveValue('حفرة');
  await page.getByRole('button', { name: 'Annuler la suggestion de type', exact: true }).click();
  await expect(page.locator('#domaine_id')).toHaveValue('نفايات منزلية'); await expect(page.locator('#type_id')).toHaveValue('مفرغة عشوائية');
  await expectAccessible(page); expect(errors.errors.pageError).toEqual([]); expect(errors.errors.consoleError).toEqual([]);
});

test('progression, résumé nommé des erreurs et recherche des agents par grade', async ({ page, baseURL }) => {
  const session = await authenticate(page, baseURL);
  const response = await page.request.post(`${baseURL}/api/ref/agents`, { headers: { 'X-CSRF-Token': session.csrf }, data: {
    full_name: '[DEMO] Agent progression', grade: 'رئيس فرع تقني', email: 'progress@example.test',
  } });
  expect(response.status()).toBe(201); await page.reload();
  await expect(page.getByRole('progressbar', { name: 'Champs obligatoires' })).toHaveAttribute('aria-valuenow', '1');
  await page.getByRole('button', { name: 'Aller à Classification', exact: true }).click(); await expect(page.locator('#domaine_id')).toBeFocused();
  await page.locator('#observations').focus(); await page.keyboard.press('Control+Enter');
  await expect(page.getByRole('link', { name: 'Lien de la publication : Ce champ est requis', exact: true })).toBeVisible();
  await expect(page.locator('#lien_url')).toBeFocused();
  await page.getByText('Options avancées', { exact: true }).click();
  await page.locator('#agent_id').fill('رئيس فرع تقني');
  await page.getByRole('option').filter({ hasText: '[DEMO] Agent progression' }).click();
  await expect(page.locator('#agent_id')).toHaveValue('[DEMO] Agent progression');
  await expect(page.getByText('progress@example.test', { exact: true })).toBeVisible();
});

test('photos locales : vignettes, retrait, limites et erreurs de fichiers visibles', async ({ page }) => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  await page.locator('#attachments').setInputFiles([{ name: 'terrain.png', mimeType: 'image/png', buffer: png }]);
  await expect(page.getByRole('img', { name: 'Photo à joindre : terrain.png', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Retirer terrain.png', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Photo à joindre : terrain.png', exact: true })).toHaveCount(0);
  await page.locator('#attachments').setInputFiles([{ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('message') }]);
  await expect(page.getByText(/notes.txt.*PNG, JPEG, WebP ou HEIC/)).toBeVisible();
  await page.locator('#attachments').setInputFiles(Array.from({ length: 6 }, (_, i) => ({ name: `photo-${i}.png`, mimeType: 'image/png', buffer: png })));
  await expect(page.getByRole('img', { name: /Photo à joindre/ })).toHaveCount(5);
  await expect(page.getByText(/photo-5.png.*5 photos maximum/)).toBeVisible();
  for (const width of [390, 768, 1024, 1440]) { await page.setViewportSize({ width, height: 1000 }); await expectNoOverflow(page); await expectActionBarClear(page); }
});

test('31 — enregistrer et dupliquer, second type, même vidéo, puis récents et raccourci nouveau', async ({ page, baseURL }) => {
  const link = `https://facebook.com/posts/duplicate-browser-${Date.now()}`;
  await complete(page, link);
  await page.getByRole('button', { name: 'Enregistrer et dupliquer', exact: true }).click();
  await expect(page.getByText(/Choisissez un autre type ou une autre commune/)).toBeVisible();
  await expect(page.locator('#lien_url')).toHaveValue(link); await expect(page.locator('#type_id')).toHaveValue('');
  await expect(page.locator('#gps_text')).toHaveValue('');
  await choose(page, 'domaine_id', 'نفايات منزلية'); await choose(page, 'type_id', 'تأخر في رفع النفايات');
  await page.locator('#observations').focus(); await page.keyboard.press('Control+Shift+Enter');
  await expect(page.locator('#lien_url')).toHaveValue(''); await expect(page.locator('#smart-paste')).toBeFocused();
  const response = await page.request.get(`${baseURL}/api/anomalies/check-link?url=${encodeURIComponent(link)}`);
  expect((await response.json()).item.matches).toHaveLength(2);
  await page.getByRole('button', { name: 'Réutiliser نفايات منزلية › تأخر في رفع النفايات', exact: true }).click();
  await expect(page.locator('#type_id')).toHaveValue('تأخر في رفع النفايات');
});

test('brouillon de modification conservé au rechargement et reprise explicite', async ({ page, testServer }) => {
  await page.goto(`/#/anomalies/${testServer.refs.ids[0]}/modifier`);
  await page.locator('#observations').fill('Modification locale à reprendre sans perte');
  await expect(page.getByText('Brouillon enregistré sur cet appareil', { exact: true })).toBeVisible();
  await page.reload(); await page.getByRole('button', { name: 'Reprendre', exact: true }).click();
  await expect(page.locator('#observations')).toHaveValue('Modification locale à reprendre sans perte');
});
