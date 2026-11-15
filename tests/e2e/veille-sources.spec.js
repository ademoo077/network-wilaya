import { test, expect } from './fixture.js';
import { authenticate, expectNotBlank } from './helpers.js';

async function openSources(page, base) {
  await authenticate(page, base, 'admin');
  await page.goto(`${base}/#/veille/reglages`);
  await expectNotBlank(page);
  await page.getByRole('tab', { name: 'Sources' }).click();
  await expect(page.getByRole('button', { name: 'Ajouter une source' })).toBeVisible();
}

test('Veille — sources : création, pause, modification et suppression', async ({ page, testServer }) => {
  await openSources(page, testServer.base);

  await page.getByRole('button', { name: 'Ajouter une source' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Nom de la source').fill('Flux E2E');
  await dialog.getByLabel('URL du flux').fill('https://exemple.dz/e2e.xml');
  await dialog.getByLabel('Fréquence (minutes)').fill('45');
  await dialog.getByRole('button', { name: 'Enregistrer la source' }).click();

  await expect(dialog).toBeHidden();
  const row = page.locator('li', { hasText: 'Flux E2E' });
  await expect(row).toBeVisible();
  await expect(row).toContainText('Active');
  await expect(row).toContainText('RSS');
  await expect(row).toContainText('toutes les 45 min');

  await row.getByRole('button', { name: 'Mettre en pause' }).click();
  await expect(row).toContainText('Inactive');
  await row.getByRole('button', { name: 'Réactiver' }).click();
  await expect(row).toContainText('Active');

  await row.getByRole('button', { name: 'Modifier', exact: true }).click();
  const edit = page.getByRole('dialog');
  await expect(edit.getByLabel('Nom de la source')).toHaveValue('Flux E2E');
  await expect(edit.getByLabel('URL du flux')).toHaveValue('https://exemple.dz/e2e.xml');
  await edit.getByLabel('Nom de la source').fill('Flux E2E renommé');
  await edit.getByRole('button', { name: 'Enregistrer la source' }).click();
  await expect(edit).toBeHidden();
  await expect(page.locator('li', { hasText: 'Flux E2E renommé' })).toBeVisible();

  const renamed = page.locator('li', { hasText: 'Flux E2E renommé' });
  await renamed.getByRole('button', { name: 'Supprimer' }).click();
  const confirm = page.getByRole('dialog', { name: 'Supprimer la source' });
  await expect(confirm).toContainText('Flux E2E renommé');
  await confirm.getByRole('button', { name: 'Supprimer' }).click();
  await expect(confirm).toBeHidden();
  await expect(page.locator('li', { hasText: 'Flux E2E renommé' })).toHaveCount(0);
});

test('Veille — sources : le jeton Facebook reste masqué et conservé à la modification', async ({ page, testServer }) => {
  await openSources(page, testServer.base);

  await page.getByRole('button', { name: 'Ajouter une source' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Connecteur').selectOption('facebook_page_geree');
  await dialog.getByLabel('Nom de la source').fill('Page E2E');
  await dialog.getByLabel('Identifiant de page').fill('123456789');
  await dialog.getByLabel("Jeton d'accès de page").fill('EAAB-e2e-secret-token-123');
  await dialog.getByRole('button', { name: 'Enregistrer la source' }).click();
  await expect(dialog).toBeHidden();

  const row = page.locator('li', { hasText: 'Page E2E' });
  await expect(row).toBeVisible();
  await expect(row).toContainText('Page Facebook gérée');
  await row.getByRole('button', { name: 'Modifier', exact: true }).click();

  const edit = page.getByRole('dialog');
  const token = edit.getByLabel("Jeton d'accès de page");
  await expect(token).toHaveValue('');
  await expect(token).toHaveAttribute('placeholder', 'Laisser vide pour conserver le jeton actuel');
  await edit.getByLabel('Nom de la source').fill('Page E2E modifiée');
  await edit.getByRole('button', { name: 'Enregistrer la source' }).click();
  await expect(edit).toBeHidden();
  await expect(page.locator('li', { hasText: 'Page E2E modifiée' })).toBeVisible();

  const stored = await page.evaluate(async () => {
    const response = await fetch('/api/veille/sources', { headers: { Accept: 'application/json' } });
    return response.json();
  });
  const listed = stored.items.find((item) => item.nom === 'Page E2E modifiée');
  expect(listed.config_masquee.page_token).toBe('••••••••');
  expect(JSON.stringify(stored)).not.toContain('EAAB-e2e-secret-token-123');
});

test('Veille — sources : import CSV analysé, idempotent et rattaché à une source inactive', async ({ page, testServer }) => {
  await openSources(page, testServer.base);
  const csv = 'texte,url,date\n'
    + '"Fuite d\'eau rue Didouche, Alger Centre",https://exemple.dz/import/e2e-1,2026-11-12\n'
    + 'Dépôt sauvage à Bab El Oued,https://exemple.dz/import/e2e-2,2026-11-11\n';

  await page.getByRole('button', { name: 'Importer un fichier' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/5 Mo et 20 000 lignes/)).toBeVisible();
  await dialog.locator('input[type="file"]').setInputFiles({
    name: 'signalements-e2e.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf8'),
  });
  await expect(dialog.getByLabel('Format du fichier')).toHaveValue('csv');
  await expect(dialog.getByLabel('Nom de la source d’import')).toHaveValue('signalements-e2e');
  await dialog.getByRole('button', { name: 'Importer' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText('2 nouvel(aux) élément(s) sur 2.', { exact: true })).toBeVisible();
  const row = page.locator('li', { hasText: 'signalements-e2e' });
  await expect(row).toBeVisible();
  await expect(row).toContainText('Import de fichier');
  await expect(row).toContainText('Inactive');

  const stored = await page.evaluate(async () => (await fetch('/api/veille/sources')).json());
  const source = stored.items.find((item) => item.nom === 'signalements-e2e');
  expect(source).toBeTruthy();
  expect(source.type).toBe('import');
  expect(source.actif).toBe(0);

  await page.getByRole('button', { name: 'Importer un fichier' }).click();
  await page.getByRole('dialog').locator('input[type="file"]').setInputFiles({
    name: 'signalements-e2e.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf8'),
  });
  await page.getByRole('dialog').getByRole('button', { name: 'Importer' }).click();
  await expect(page.getByText('0 nouvel(aux) élément(s) sur 2.', { exact: true })).toBeVisible();
});

test('Veille — sources : un opérateur ne peut ni configurer ni lire les secrets', async ({ page, testServer }) => {
  await page.goto(testServer.base);
  await authenticate(page, testServer.base, 'admin');
  const created = await page.evaluate(async () => {
    const me = await fetch('/api/auth/me').then((response) => response.json());
    const response = await fetch('/api/veille/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': me.csrf },
      body: JSON.stringify({
        type: 'facebook_page_geree', nom: 'Page secrète',
        config: { page_id: '987654', page_token: 'EAAB-never-shown-token' },
      }),
    });
    return { status: response.status, body: await response.json() };
  });
  expect(created.status).toBe(201);

  await page.context().clearCookies();
  await authenticate(page, testServer.base, 'operateur');
  const listed = await page.evaluate(async () => (await fetch('/api/veille/sources')).json());
  const item = listed.items.find((source) => source.nom === 'Page secrète');
  expect(item).toBeTruthy();
  expect(item.config_masquee).toBeUndefined();
  expect(JSON.stringify(listed)).not.toContain('EAAB-never-shown-token');

  const forbidden = await page.evaluate(async () => {
    const me = await fetch('/api/auth/me').then((response) => response.json());
    const response = await fetch('/api/veille/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': me.csrf },
      body: JSON.stringify({ type: 'rss', nom: 'Refusée', config: { url: 'https://exemple.dz/refusee.xml' } }),
    });
    return response.status;
  });
  expect(forbidden).toBe(403);

  await page.goto(`${testServer.base}/#/veille/reglages`);
  await page.reload();
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByRole('tab', { name: 'Sources' })).toHaveCount(0);
});
