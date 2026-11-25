import { test, expect } from './fixture.js';
import { authenticate, collectErrors } from './helpers.js';
import { expectAccessible, expectNoOverflow } from './geometry.js';

async function ouvrirAtelierImpression(page, baseURL) {
  await authenticate(page, baseURL);
  await page.goto('/#/syntheses');
  await page.getByRole('heading', { name: 'Modèles de synthèse' }).waitFor({ timeout: 15_000 });
  await page.locator('[data-testid^="modele-"]').filter({ has: page.getByRole('heading', { name: 'Synthèse hebdomadaire standard' }) })
    .getByRole('button', { name: /Personnaliser/ }).click();
  await page.locator('[data-widget-id]').first().waitFor({ state: 'visible', timeout: 35_000 });
  await page.getByRole('button', { name: /^Imprimer/ }).first().click();
  return page.getByRole('dialog', { name: /Préparer le rapport officiel/ });
}

test('V19 / phase 1 — fiche d’impression sobre, statique et sans débordement', async ({ page, baseURL }) => {
  const errors = collectErrors(page);
  const dialog = await ouvrirAtelierImpression(page, baseURL);
  await dialog.waitFor({ state: 'visible', timeout: 15_000 });

  await expect(dialog.locator('input[value^="N° "]')).toHaveCount(1);
  await expect(dialog.locator('[data-print-period-block] input[type="date"]')).toHaveCount(2);
  await expect(dialog.getByText(/Une seule période/)).toBeVisible();

  const documentPrint = page.locator('[data-print-document]');
  await expect(documentPrint).toHaveAttribute('data-orientation', 'portrait');
  await expect(documentPrint).toHaveClass(/print-portrait/);

  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('[data-print-header]')).toBeVisible();
  await expect(page.locator('[data-print-meta]')).not.toContainText('—');
  const metaBoxes = await page.locator('[data-print-meta] > span').evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().top));
  expect(Math.max(...metaBoxes) - Math.min(...metaBoxes)).toBeLessThan(4);

  const marges = await documentPrint.evaluate((element) => {
    const style = getComputedStyle(element);
    return { left: parseFloat(style.paddingLeft), right: parseFloat(style.paddingRight) };
  });
  expect(Math.abs(marges.left - marges.right)).toBeLessThanOrEqual(1.2);

  const kpi = page.locator('[data-kpi-grid]').first();
  if (await kpi.count()) {
    const limites = await page.evaluate(() => {
      const grille = document.querySelector('[data-kpi-grid]');
      const pageElement = grille?.closest('.print-page');
      if (!grille || !pageElement) return null;
      const g = grille.getBoundingClientRect();
      const p = pageElement.getBoundingClientRect();
      const premier = grille.querySelector('[data-kpi-item]');
      return {
        droites: g.right <= p.right + 1,
        bordure: premier ? parseFloat(getComputedStyle(premier).borderRightWidth) : 0,
      };
    });
    expect(limites).not.toBeNull();
    expect(limites.droites).toBe(true);
    expect(limites.bordure).toBeGreaterThan(0);
  }

  const legerdes = page.locator('[data-chart-legend] li');
  if (await legerdes.count()) {
    const styleLegende = await legerdes.first().evaluate((element) => {
      const style = getComputedStyle(element);
      return { minWidth: style.minWidth, whiteSpace: style.whiteSpace, wordBreak: style.wordBreak };
    });
    expect(styleLegende.whiteSpace).toBe('normal');
    expect(styleLegende.wordBreak).toBe('normal');
    const retours = await legerdes.evaluateAll((elements) => elements.map((element) => {
      const texte = (element.textContent || '').trim();
      if (texte.length >= 20) return 0;
      const range = document.createRange();
      range.selectNodeContents(element);
      return range.getClientRects().length;
    }));
    expect(Math.max(...retours)).toBeLessThan(4);
  }

  await page.locator('[data-chart]').first().hover({ force: true }).catch(() => {});
  const tooltip = page.locator('.recharts-tooltip-wrapper, [role="tooltip"], [data-tooltip]').first();
  if (await tooltip.count()) await expect(tooltip).toBeHidden();

  await expect(page.locator('[data-print-table]')).toHaveCount(await page.locator('[data-screen-table]').count());
  const interactifs = page.locator('[data-print-document] button, [data-print-document] [role="button"], [data-print-document] [data-widget-handle]');
  if (await interactifs.count()) await expect(interactifs.first()).toBeHidden();
  await page.emulateMedia({ media: 'screen' });

  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expectNoOverflow(page);
  }
  await expectAccessible(page);
  expect(errors.snapshot().pageError).toEqual([]);
  expect(errors.snapshot().consoleError).toEqual([]);
});

test('V19 / phase 1 — formats A4 et A5 symétriques en paysage', async ({ page, baseURL }) => {
  await ouvrirAtelierImpression(page, baseURL);
  const dialog = page.getByRole('dialog', { name: /Préparer le rapport officiel/ });
  await dialog.getByRole('combobox', { name: 'Format' }).selectOption('a5');
  await dialog.getByRole('combobox', { name: 'Orientation A4' }).selectOption('landscape');

  const documentPrint = page.locator('[data-print-document]');
  await expect(documentPrint).toHaveAttribute('data-format', 'a5');
  await expect(documentPrint).toHaveAttribute('data-orientation', 'landscape');
  await expect(documentPrint).toHaveClass(/print-landscape/);
  const dims = await documentPrint.evaluate((element) => ({
    width: getComputedStyle(element).getPropertyValue('--page-w-mm').trim(),
    height: getComputedStyle(element).getPropertyValue('--page-h-mm').trim(),
    font: getComputedStyle(element.querySelector('.official-print-body')).fontSize,
  }));
  expect(dims.width).toBe('210mm');
  expect(dims.height).toBe('148mm');
  expect(parseFloat(dims.font)).toBeGreaterThanOrEqual(9);
});

test('V19 / phase 3 — 500 lignes conservées avec en-têtes répétés à l’impression', async ({ page, baseURL }) => {
  await authenticate(page, baseURL);
  await page.route('**/api/syntheses/evaluer', async (route) => {
    const response = await route.fetch();
    const payload = await response.json();
    if (Array.isArray(payload.items) && payload.items.length) {
      payload.items = payload.items.map((modele) => {
        if (!Array.isArray(modele.lignes)) return modele;
        const dimension = modele.colonnes?.dimensions?.[0] || { id: 'daira', label_fr: 'Daïra', label_ar: 'دايرة', type: 'texte' };
        const valeurs = Object.fromEntries((modele.colonnes?.mesures || [{ id: 'recues' }]).map((mesure) => [mesure.id, 1]));
        return {
          ...modele,
          lignes: Array.from({ length: 500 }, (_, index) => ({
            dimensions: [{ ...dimension, key: `D-${index + 1}`, label_fr: `Daïra ${index + 1}`, label_ar: `دايرة ${index + 1}` }],
            valeurs,
          })),
          totaux: { valeurs },
        };
      });
    }
    await route.fulfill({ response, json: payload });
  });

  await page.goto('/#/syntheses');
  await page.getByRole('heading', { name: 'Modèles de synthèse' }).waitFor({ timeout: 15_000 });
  await page.locator('[data-testid^="modele-"]').filter({ has: page.getByRole('heading', { name: 'Synthèse hebdomadaire standard' }) })
    .getByRole('button', { name: /Personnaliser/ }).click();
  await page.locator('[data-screen-table]').first().waitFor({ state: 'visible', timeout: 35_000 });

  const ecran = page.locator('[data-screen-table]').first();
  const conteneur = ecran.locator('..');
  await expect(ecran.locator('tbody tr[data-ligne]')).toHaveCount(12);
  await expect(conteneur.locator('[data-print-table] tbody tr[data-ligne]')).toHaveCount(500);

  await page.emulateMedia({ media: 'print' });
  await expect(conteneur.locator('[data-print-table]')).toBeVisible();
  await expect(conteneur.locator('[data-print-table] thead th').first()).toBeVisible();
  const entetes = await conteneur.locator('[data-print-table] thead').evaluate((element) => getComputedStyle(element).display);
  expect(entetes).toBe('table-header-group');
});

test('V19 / phase 4 — sources manuelles, liste blanche et recherche en ligne désactivée', async ({ page, baseURL }) => {
  const session = await authenticate(page, baseURL);
  const ajout = await page.request.post(`${baseURL}/api/syntheses/sources`, {
    headers: { 'X-CSRF-Token': session.csrf }, data: { domaine: 'exemple.dz' },
  });
  expect(ajout.status(), await ajout.text()).toBe(201);

  const dialog = await ouvrirAtelierImpression(page, baseURL);
  await expect(dialog.locator('[data-source-search]')).toBeDisabled();
  await expect(dialog.locator('[data-source-search]')).not.toBeChecked();
  await expect(dialog.getByText(/Aucune recherche en ligne/)).toBeVisible();
  await expect(dialog.locator('[data-whitelist-domain]')).toContainText('exemple.dz');

  await dialog.getByLabel('Titre de la source').fill('Note interne');
  await dialog.getByLabel('URL de la source').fill('https://autre.dz/document');
  await expect(dialog.locator('[data-source-error]')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Ajouter la source' })).toBeDisabled();

  await dialog.getByLabel('URL de la source').fill('https://exemple.dz/document');
  await expect(dialog.locator('[data-source-error]')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Ajouter la source' }).click();
  await expect(dialog.locator('[data-source-list]')).toContainText('Note interne');

  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('[data-print-sources]')).toContainText('Note interne');
  await expect(page.locator('[data-print-sources]')).toContainText('exemple.dz/document');
});

test('V19 / phase 5 — identité Cabinet, validation et grille A5 à six colonnes', async ({ page, baseURL }) => {
  await ouvrirAtelierImpression(page, baseURL);
  const dialog = page.getByRole('dialog', { name: /Préparer le rapport officiel/ });
  await dialog.getByLabel('Objet').fill('Suivi hebdomadaire');
  await dialog.getByLabel('Destinataire').fill('Cabinet du Wali');
  await dialog.getByLabel('Statut du document').selectOption('valide');

  const preview = page.locator('[data-print-document]');
  await expect(preview).toHaveAttribute('data-statut', 'valide');
  await dialog.getByRole('button', { name: 'Enregistrer comme modèle' }).click();
  await expect(page.getByText(/Réglages d’impression enregistrés/)).toBeVisible();

  await dialog.getByRole('combobox', { name: 'Format' }).selectOption('a5');
  await expect(preview).toHaveAttribute('data-small', '1');
  const colonnes = await preview.locator('[data-largeur="pleine"]').first()
    .evaluate((element) => getComputedStyle(element).gridColumnEnd);
  expect(colonnes).toBe('span 6');

  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('[data-print-header]')).toContainText('Suivi hebdomadaire');
  await expect(page.locator('[data-print-header]')).toContainText('Cabinet du Wali');
  const filigrane = await preview.evaluate((element) => getComputedStyle(element, '::before').content);
  expect(filigrane).toBe('none');
});
