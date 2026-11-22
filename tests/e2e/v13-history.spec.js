import { test, expect } from './fixture.js';
import { authenticate, collectErrors } from './helpers.js';
import { expectNoOverflow, expectAccessible } from './geometry.js';

test('V13 / 175 — chronologie lisible : libellés, dates JJ/MM/AAAA et motif en citation', async ({ page, baseURL, testServer }) => {
  const errors = collectErrors(page);
  const session = await authenticate(page, baseURL);
  const created = await page.request.post(`${baseURL}/api/ref/agents`, {
    headers: { 'X-CSRF-Token': session.csrf }, data: { full_name: '[DEMO] Agent 2', actif: 1 },
  });
  expect(created.ok()).toBe(true);
  await page.goto(`/#/anomalies/${testServer.refs.ids[0]}`);
  await expect(page.locator('h1')).toBeVisible();

  // Une action avec motif alimente l'historique.
  await page.getByRole('button', { name: 'Sans suite' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox').fill('Signalement non fondé après contrôle terrain.');
  await dialog.getByRole('button', { name: 'Confirmer' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('Anomalie classée sans suite.')).toBeVisible();
  await page.reload();

  // Attendre que la fiche et sa chronologie soient effectivement rendues.
  await expect(page.getByText('Signalement non fondé après contrôle terrain.').first()).toBeVisible();
  await expect(page.locator('[data-history-timeline]')).toBeVisible();
  await expect(page.locator('[data-history-avatar]').first()).toBeVisible();
  await expect(page.locator('[data-history-relative]').first()).toHaveText(/il y a|à l’instant/);
  await page.locator('[data-history-filter]').selectOption('statut');
  await expect(page.locator('[data-history-timeline]')).toBeVisible();
  await page.locator('[data-history-filter]').selectOption('photo');
  await expect(page.getByText(/Aucun événement de ce type/)).toBeVisible();
  await page.locator('[data-history-filter]').selectOption('tous');
  await expect(page.locator('[data-detail-agent]')).toBeVisible();
  await expect(page.locator('[data-detail-source]')).toBeVisible();

  // La réaffectation reste possible depuis la fiche et alimente la chronologie.
  await page.getByRole('button', { name: 'Réaffecter' }).click();
  const reassign = page.getByRole('dialog');
  await reassign.locator('select').selectOption({ label: '[DEMO] Agent 2' });
  await reassign.locator('textarea').fill('Renfort du service de permanence.');
  await reassign.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(reassign).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('Renfort du service de permanence.').first()).toBeVisible();
  const body = await page.locator('body').innerText();

  // Aucune valeur technique ne doit apparaître à l'écran.
  expect(body).not.toMatch(/\bnon_traite\b|\ben_cours\b|\btraite\b/);
  expect(body).not.toMatch(/\b\d{4}-\d{2}-\d{2}T/);
  // Les libellés lisibles et le motif sont présents.
  expect(body).toMatch(/Statut|Classement|Sans suite|Non traitée|Traitée/);
  expect(body).toContain('Signalement non fondé après contrôle terrain.');

  await expectNoOverflow(page);
  await expectAccessible(page);

  // La chronologie reste lisible et sans débordement en arabe RTL.
  await page.getByRole('button', { name: 'Changer la langue' }).click();
  await expect(page.getByText('Signalement non fondé après contrôle terrain.').first()).toBeVisible();
  await expectNoOverflow(page);
  await expectAccessible(page);

  expect(errors.snapshot().pageError).toEqual([]);
});
