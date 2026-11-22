import { todayAlgiers } from '@anm/shared';
import { test, expect } from './fixture.js';
import { authenticate, collectErrors } from './helpers.js';
import { expectNoOverflow, expectAccessible, expectActionBarClear } from './geometry.js';

const labelOf = (item) => item?.name_fr || item?.name_ar || item?.full_name || item?.name || '';

async function bootstrap(page, baseURL, testServer) {
  const payload = await (await page.request.get(`${baseURL}/api/ref/bootstrap`)).json();
  const refs = payload.refs || payload;
  const domain = refs.domaines.find((item) => item.types.some((type) => type.id === testServer.refs.type));
  const type = domain.types.find((item) => item.id === testServer.refs.type);
  const daira = refs.dairas.find((item) => item.id === testServer.refs.daira);
  const commune = daira.communes.find((item) => item.id === testServer.refs.commune);
  return {
    domain: { ...domain, label: labelOf(domain) }, type: { ...type, label: labelOf(type) },
    daira: { ...daira, label: labelOf(daira) }, commune: { ...commune, label: labelOf(commune) },
    epicId: testServer.refs.epic, agentName: labelOf(refs.agents.find((a) => a.id === testServer.refs.agent)),
  };
}

async function chooseCombobox(page, id, label) {
  if (typeof label !== 'string') throw new Error(`Libellé invalide pour ${id} : ${JSON.stringify(label)}`);
  await page.locator(`#${id}`).fill(label);
  await page.getByRole('option', { name: label, exact: true }).first().click();
}

async function fillRequired(page, refs) {
  await page.locator('#lien_url').fill(`https://facebook.com/v13-options-${Date.now()}`);
  await page.locator('#lien_url').blur();
  await page.locator('#plateforme').selectOption('facebook');
  await page.locator('#date_signalement').fill(todayAlgiers());
  await chooseCombobox(page, 'domaine_id', refs.domain.label);
  await chooseCombobox(page, 'type_id', refs.type.label);
  await chooseCombobox(page, 'daira_id', refs.daira.label);
  await chooseCombobox(page, 'commune_id', refs.commune.label);
}

test('174 — options avancées : exigences dérivées, agent automatique, champs conditionnels et barre visible', async ({ page, baseURL, testServer }) => {
  const errors = collectErrors(page);
  await authenticate(page, baseURL);
  await page.goto('/#/anomalies/nouvelle');
  await expect(page.locator('#smart-paste')).toBeVisible();
  const refs = await bootstrap(page, baseURL, testServer);
  await fillRequired(page, refs);
  await page.locator('details[data-advanced] summary').click();

  const labels = await page.locator('#statut option').allTextContents();
  expect(labels).toEqual(['Non traitée', 'En cours — intervenant requis', 'Traitée — intervenant, date, photo après requis']);
  const body = await page.locator('body').innerText();
  expect(body).not.toMatch(/vérification|vérifiée?/i);

  await expect(page.getByText('Agent affecté (automatique)')).toBeVisible();
  await expect(page.getByText('Aucun agent pour cette daïra')).toBeVisible();
  await page.getByRole('button', { name: 'Modifier l’affectation' }).click();
  await expect(page.locator('#agent_motif')).toBeVisible();
  await page.getByRole('button', { name: 'Appliquer' }).click();
  await expect(page.getByText(/obligatoire/).first()).toBeVisible();
  await chooseCombobox(page, 'agent_id', refs.agentName);
  await page.locator('#agent_motif').fill('Demande du service technique');
  await page.getByRole('button', { name: 'Appliquer' }).click();
  await expect(page.getByText('Affectation manuelle')).toBeVisible();
  await expect(page.locator('#agent_motif')).toHaveCount(0);

  await expect(page.locator('#intervenant_autre')).toBeVisible();
  await page.locator('#epic_id').selectOption('__autre__');
  await expect(page.locator('#intervenant_autre')).toBeVisible();
  await page.locator('#intervenant_autre').fill('Brigade municipale');

  await page.locator('#statut').selectOption('traite');
  await page.locator('#epic_id').selectOption('__autre__');
  await page.locator('#intervenant_autre').fill('');
  await page.locator('#date_traitement').fill('');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).last().click();
  await expect(page.getByText('Complétez les exigences indiquées dans le libellé du statut.').first()).toBeVisible();

  await page.locator('#epic_id').selectOption('__autre__');
  await page.locator('#intervenant_autre').fill('Brigade municipale');
  await page.locator('#date_traitement').fill(todayAlgiers());
  await page.getByText('Sans photo après', { exact: true }).click();
  await page.locator('#sans_photo_motif').fill('Intervention nocturne, prise de vue impossible');
  await expect(page.getByText('Une photo après ou un motif est obligatoire pour clore l’anomalie.')).toHaveCount(0);

  for (const width of [768, 1080]) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoOverflow(page); await expectActionBarClear(page);
    const shortcut = page.getByText(/Ctrl\+Entrée/);
    await expect(shortcut).toBeVisible();
    const fits = await shortcut.evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
    expect(fits, 'Aide des raccourcis tronquée').toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expectAccessible(page);
  expect(errors.snapshot().pageError).toEqual([]);
});

test('174 — création Non traitée → En cours → Traitée avec exigences et sans mention de vérification (FR/AR)', async ({ page, baseURL, testServer }) => {
  await authenticate(page, baseURL);
  const refs = await bootstrap(page, baseURL, testServer);
  await page.goto('/#/anomalies/nouvelle');
  await fillRequired(page, refs);
  await page.locator('details[data-advanced] summary').click();
  await page.locator('#epic_id').selectOption(String(refs.epicId));
  await page.locator('#statut').selectOption('en_cours');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).last().click();
  await expect(page.locator('h1')).toContainText('-');
  await expect(page.getByText('En cours', { exact: true }).first()).toBeVisible();

  await page.getByRole('link', { name: 'Modifier' }).click();
  await expect(page.locator('details[data-advanced]')).toBeVisible();
  await page.locator('#statut').selectOption('traite');
  await page.locator('#date_traitement').fill(todayAlgiers());
  await page.getByText('Sans photo après', { exact: true }).click();
  await page.locator('#sans_photo_motif').fill('Contrôle visuel uniquement');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).last().click();
  await expect(page.getByText('Traitée', { exact: true }).first()).toBeVisible();
  expect(await page.locator('body').innerText()).not.toMatch(/vérification|vérifiée?/i);

  await page.addInitScript(() => localStorage.setItem('anm-language', 'ar'));
  await page.reload();
  await expect(page.getByText('معالجة', { exact: true }).first()).toBeVisible();
  expect(await page.locator('body').innerText()).not.toMatch(/التحقق|للتحقق|تم التحقق/);
  await expectAccessible(page);
});
