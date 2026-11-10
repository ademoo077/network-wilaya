import { test, expect } from './fixture.js';
import { authenticate, collectErrors } from './helpers.js';
import { expectNoOverflow, expectAccessible } from './geometry.js';

test('Agents scooters — grade, e-mail, recherche et modification conservés après F5', async ({ page, baseURL }) => {
  await authenticate(page, baseURL); const errors = collectErrors(page);
  await page.goto('/#/admin/referentiels'); await page.getByRole('tab', { name: /Agents/ }).click();
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nom', { exact: true }).fill('[DEMO] عون الاختبار');
  await dialog.getByLabel('Grade', { exact: true }).fill('مراقب طريق');
  await dialog.getByLabel('Adresse e-mail').fill('agent-browser@example.test');
  await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click(); await expect(dialog).toHaveCount(0);
  await page.getByRole('searchbox', { name: 'Rechercher', exact: true }).fill('agent-browser@example.test');
  const row = page.locator('tbody tr').filter({ hasText: 'agent-browser@example.test' });
  await expect(row).toContainText('مراقب طريق'); await row.getByRole('button', { name: 'Modifier' }).click();
  await dialog.getByLabel('Grade', { exact: true }).fill('رئيس فرع تقني');
  await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click(); await expect(dialog).toHaveCount(0);
  await page.reload(); await page.getByRole('tab', { name: /Agents/ }).click();
  await expect(row).toContainText('رئيس فرع تقني');
  await expectAccessible(page);
  for (const width of [390, 768, 1024, 1440]) { await page.setViewportSize({ width, height: 900 }); await expectNoOverflow(page); }
  expect(errors.errors.pageError).toEqual([]); expect(errors.errors.consoleError).toEqual([]);
});

test('Workflow — recommandations territoriales, conditions visibles et choix manuel conservé', async ({ page, baseURL, testServer }) => {
  const session = await authenticate(page, baseURL); const errors = collectErrors(page);
  const { domaine, daira, secondDaira } = testServer.refs;
  const response = await page.request.post(`${baseURL}/api/ref/epics`, { headers: { 'X-CSRF-Token': session.csrf }, data: {
    name: '[DEMO] Workflow', domaine_ids: [domaine], workflow: { missions: ['[DEMO] رفع النفايات'], perimetres: ['[DEMO] دائرة'],
      dairas: ['[DEMO] Daïra'], coordination: [], regles: [{ domaine_ids: [domaine], type_ids: [], conditionnelle: true,
        note_fr: '[DEMO] Confirmer le périmètre', note_ar: '[DEMO] تأكيد مجال التدخل' }] },
  } });
  expect(response.status()).toBe(201); const epic = (await response.json()).item;
  await page.goto('/#/anomalies/nouvelle');
  await page.locator('#domaine_id').fill('نفايات منزلية'); await page.getByRole('option', { name: 'نفايات منزلية', exact: true }).click();
  await page.locator('#daira_id').fill('[DEMO] Daïra'); await page.getByRole('option', { name: '[DEMO] Daïra', exact: true }).click();
  await page.getByText('Options avancées', { exact: true }).click();
  const choice = page.getByRole('button', { name: '[DEMO] Workflow · Conditions à confirmer', exact: true });
  await expect(choice).toBeVisible(); await expect(page.locator('#epic_id')).toHaveValue('');
  await choice.click(); await expect(page.locator('#epic_id')).toHaveValue(String(epic.id));
  await expect(page.getByText('[DEMO] Confirmer le périmètre', { exact: true })).toBeVisible();
  await page.locator('[data-workflow] summary').click(); await expect(page.getByText('[DEMO] رفع النفايات', { exact: true })).toBeVisible();
  await page.locator('#daira_id').fill('[DEMO] Autre daïra'); await page.getByRole('option', { name: '[DEMO] Autre daïra', exact: true }).click();
  await expect(page.getByText(/hors du périmètre déclaré/)).toBeVisible(); await expect(page.locator('#epic_id')).toHaveValue(String(epic.id));
  expect(daira).not.toBe(secondDaira); await expectAccessible(page);
  await page.setViewportSize({ width: 390, height: 900 }); await expectNoOverflow(page);
  expect(errors.errors.pageError).toEqual([]); expect(errors.errors.consoleError).toEqual([]);
});
