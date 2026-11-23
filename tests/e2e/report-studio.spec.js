import { todayAlgiers, weekStart } from '@anm/shared';
import { test, expect } from './fixture.js';
import { authenticate, collectErrors } from './helpers.js';
import { expectAccessible, expectNoOverflow } from './geometry.js';

for (const [lang, theme] of [['fr', 'light'], ['fr', 'dark'], ['ar', 'light'], ['ar', 'dark']]) {
  test(`Studio — géométrie et accessibilité ${lang}/${theme}`, async ({ page, baseURL }) => {
    await authenticate(page, baseURL, 'operateur');
    const errors = collectErrors(page);
    await page.addInitScript(({ language, dark }) => {
      localStorage.setItem('anm-language', language);
      localStorage.setItem('anm-theme', dark);
    }, { language: lang, dark: theme });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/#/rapport?semaine=2026-11-15');
    await expect(page.locator('html')).toHaveAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page.locator('[data-kpi-value]').first()).toBeVisible({ timeout: 20_000 });
    await expectNoOverflow(page);
    const widths = await page.locator('[data-synthese-grid] > section').evaluateAll((items) => items.map((item) => item.getBoundingClientRect().width));
    expect(widths[1]).toBeLessThan(widths[2]);
    expect(await page.locator('[data-report-studio]').evaluate((element) => element.getBoundingClientRect().height)).toBeLessThanOrEqual(140);
    await expectAccessible(page);
    expect(errors.snapshot().pageError).toEqual([]);
    expect(errors.snapshot().consoleError).toEqual([]);
  });
}

test('Rapport — studio unifié, semaine héritée, modèles et laboratoire', async ({ page, baseURL }) => {
  await authenticate(page, baseURL, 'operateur');
  const errors = collectErrors(page);
  const evaluation = page.waitForRequest((request) => request.method() === 'POST' && request.url().endsWith('/api/syntheses/evaluer'));

  await page.goto('/#/rapport?semaine=2026-11-15');
  await expect(page.getByRole('heading', { name: 'Studio de synthèses' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel('Semaine du rapport')).toHaveValue('2026-11-15');
  await expect(page.getByRole('heading', { name: 'Synthèse hebdomadaire standard' })).toBeVisible({ timeout: 15_000 });
  await page.locator('[data-testid^="widget-"]').first().waitFor({ state: 'visible', timeout: 20_000 });

  const request = await evaluation;
  const requetes = request.postDataJSON().requetes;
  expect(requetes.length).toBeGreaterThan(0);
  expect(requetes.every((item) => item.periode?.mode === 'plage' && item.periode.debut === '2026-11-15' && item.periode.fin === '2026-11-21')).toBe(true);

  await page.getByRole('button', { name: 'Modèles' }).click();
  await expect(page.getByRole('heading', { name: 'Modèles de synthèse' })).toBeVisible();
  await page.getByRole('button', { name: 'Laboratoire' }).click();
  await expect(page.getByRole('heading', { name: 'Laboratoire de synthèses' })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Composer' }).click();
  await expect(page.getByRole('heading', { name: 'Synthèse hebdomadaire standard' })).toBeVisible({ timeout: 15_000 });

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Studio de synthèses' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel('Semaine du rapport')).toHaveValue('2026-11-15');

  await page.getByRole('button', { name: 'Imprimer' }).click();
  const printDialog = page.getByRole('dialog', { name: 'Préparer le rapport officiel' });
  await expect(printDialog).toBeVisible();
  await printDialog.getByLabel('Titre du rapport').fill('Rapport officiel — recette');
  await printDialog.getByLabel('Référence').fill('REC-2026-11');
  await printDialog.getByLabel('Orientation A4').selectOption('landscape');
  await printDialog.getByRole('button', { name: 'Annuler' }).click();
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('heading', { name: 'Rapport officiel — recette' })).toBeVisible();
  await expect(page.locator('[data-print-document]')).toHaveClass(/print-landscape/);
  await page.emulateMedia({ media: 'screen' });

  await expectAccessible(page);
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoOverflow(page);
  }
  expect(errors.snapshot().pageError).toEqual([]);
  expect(errors.snapshot().consoleError).toEqual([]);
});

test('Rapport — un ancien identifiant revient au modèle hebdomadaire', async ({ page, baseURL }) => {
  await authenticate(page, baseURL, 'operateur');
  await page.goto('/#/rapport?semaine=2026-11-15&outil=composition&modele=999999');
  await expect(page.getByRole('heading', { name: 'Synthèse hebdomadaire standard' })).toBeVisible({ timeout: 15_000 });
  await expect(page).not.toHaveURL(/modele=999999/);
  await expect(page.getByText('Ressource introuvable', { exact: true })).toHaveCount(0);
});

test('Rapport — la semaine du studio pilote le laboratoire', async ({ page, baseURL }) => {
  await authenticate(page, baseURL, 'operateur');
  const errors = collectErrors(page);
  const firstEvaluation = page.waitForRequest((request) => request.method() === 'POST' && request.url().endsWith('/api/syntheses/evaluer'));

  await page.goto('/#/rapport?semaine=2026-11-15&outil=laboratoire');
  await expect(page.getByRole('heading', { name: 'Laboratoire de synthèses' })).toBeVisible({ timeout: 15_000 });
  const labBuilder = page.getByTestId('lab-builder');
  await expect(labBuilder).toBeVisible();
  await expect(labBuilder.getByLabel('Du', { exact: true })).toHaveValue('2026-11-15');
  await expect(labBuilder.getByLabel('Au', { exact: true })).toHaveValue('2026-11-21');
  await expect(page.getByText('Semaine du rapport : 15/11/2026 → 21/11/2026')).toBeVisible();

  const initial = await firstEvaluation;
  const initialSpecs = initial.postDataJSON().requetes;
  expect(initialSpecs).toHaveLength(1);
  expect(initialSpecs[0].periode).toMatchObject({ mode: 'plage', debut: '2026-11-15', fin: '2026-11-21' });

  const nextEvaluation = page.waitForRequest((request) => request.method() === 'POST' && request.url().endsWith('/api/syntheses/evaluer'));
  await page.getByLabel('Semaine du rapport').fill('2026-11-22');
  await expect(labBuilder.getByLabel('Du', { exact: true })).toHaveValue('2026-11-22');
  await expect(labBuilder.getByLabel('Au', { exact: true })).toHaveValue('2026-11-28');
  await expect(page.getByText('Semaine du rapport : 22/11/2026 → 28/11/2026')).toBeVisible();
  const followed = await nextEvaluation;
  expect(followed.postDataJSON().requetes[0].periode).toMatchObject({ mode: 'plage', debut: '2026-11-22', fin: '2026-11-28' });

  await expectAccessible(page);
  expect(errors.snapshot().pageError).toEqual([]);
  expect(errors.snapshot().consoleError).toEqual([]);
});

test('Rapport — l’onglet officiel et la personnalisation suivent la semaine sans retour arrière', async ({ page, baseURL }) => {
  await authenticate(page, baseURL, 'operateur');
  const errors = collectErrors(page);
  const models = await (await page.request.get(`${baseURL}/api/syntheses/modeles`)).json();
  const weekly = models.items.find((item) => item.cle_systeme === 'hebdomadaire');
  expect(weekly).toBeTruthy();

  await page.goto(`/#/rapport?semaine=2026-11-15&outil=officiel&modele=${weekly.id}&source=${weekly.id}`);
  await expect(page.locator('article.report-paper').getByRole('heading', { name: 'Synthèse hebdomadaire' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel('Semaine du rapport')).toHaveValue('2026-11-15');

  await page.getByLabel('Semaine du rapport').fill('2026-11-29');
  await expect(page.getByLabel('Semaine du rapport')).toHaveValue('2026-11-29');
  await expect(page).toHaveURL(/semaine=2026-11-29/);
  await expect(page).toHaveURL(new RegExp(`source=${weekly.id}`));
  await expect(page.locator('article.report-paper').getByText('29/11/2026 → 05/12/2026')).toBeVisible();

  await page.getByRole('button', { name: 'Composer' }).click();
  await expect(page.getByRole('heading', { name: 'Synthèse hebdomadaire standard' })).toBeVisible({ timeout: 15_000 });
  await page.getByLabel('Semaine du rapport').fill('2026-12-06');
  await expect(page).toHaveURL(/semaine=2026-12-06/);
  await expect(page).toHaveURL(new RegExp(`source=${weekly.id}`));
  await expect(page.getByLabel('Semaine du rapport')).toHaveValue('2026-12-06');

  expect(errors.snapshot().pageError).toEqual([]);
  expect(errors.snapshot().consoleError).toEqual([]);
});

test('113 — Studio : grille 12 colonnes, KPI lisibles, anneau entier et tableau sans scroll', async ({ page, baseURL }) => {
  await authenticate(page, baseURL, 'operateur');
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#/rapport?semaine=2026-11-15');
  await expect(page.locator('[data-synthese-grid] > section')).toHaveCount(3, { timeout: 20_000 });
  await expect(page.locator('[data-kpi-value]').first()).toBeVisible({ timeout: 20_000 });

  const geometry = await page.evaluate(() => {
    const grid = document.querySelector('[data-synthese-grid]');
    const ring = document.querySelector('[data-anneau-chart]');
    const tableRegion = document.querySelector('[data-widget-table]')?.parentElement;
    const box = (element) => { const r = element?.getBoundingClientRect(); return r && { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width }; };
    return {
      gridWidth: grid.getBoundingClientRect().width,
      widths: [...grid.children].map((child) => child.getBoundingClientRect().width),
      labels: [...document.querySelectorAll('[data-kpi-label]')].map((el) => ({ text: el.textContent, scroll: el.scrollWidth, client: el.clientWidth })),
      values: [...document.querySelectorAll('[data-kpi-value]')].map((el) => ({ height: el.getBoundingClientRect().height, line: parseFloat(getComputedStyle(el).lineHeight) })),
      ring: box(ring), ringCard: box(ring?.closest('[data-widget-card]')), svg: box(ring?.querySelector('svg')), legend: box(document.querySelector('[data-anneau-legende]')),
      cards: [...document.querySelectorAll('[data-card]')].map((card) => ({ scroll: card.scrollWidth, client: card.clientWidth })),
      table: tableRegion && { scroll: tableRegion.scrollWidth, client: tableRegion.clientWidth },
    };
  });
  expect(geometry.widths[0]).toBeGreaterThan(geometry.gridWidth * 0.95);
  expect(geometry.widths[1]).toBeGreaterThan((geometry.gridWidth / 3) * 0.95);
  expect(geometry.widths[1]).toBeLessThan((geometry.gridWidth / 3) * 1.05);
  expect(geometry.widths[2]).toBeGreaterThan((geometry.gridWidth * 2) / 3 * 0.95);
  expect(geometry.widths[2]).toBeLessThan((geometry.gridWidth * 2) / 3 * 1.05);
  expect(geometry.labels.every((item) => item.scroll <= item.client + 1), 'Libellés KPI tronqués').toBe(true);
  expect(geometry.values.every((item) => item.height <= item.line * 1.5 + 1), 'Valeurs KPI sur plusieurs lignes').toBe(true);
  expect(geometry.svg.left).toBeGreaterThanOrEqual(geometry.ring.left - 1);
  expect(geometry.svg.right).toBeLessThanOrEqual(geometry.ring.right + 1);
  expect(geometry.svg.bottom).toBeLessThanOrEqual(geometry.ring.bottom + 1);
  expect(geometry.ring.bottom).toBeLessThanOrEqual(geometry.ringCard.bottom + 1);
  expect(geometry.legend.top).toBeGreaterThanOrEqual(geometry.ring.bottom - 1);
  expect(geometry.cards.every((card) => card.scroll <= card.client + 1), 'Contenu de widget comprimé ou débordant').toBe(true);
  expect(geometry.table.scroll).toBeLessThanOrEqual(geometry.table.client + 1);
  await expect(page.getByText(/Page\s+\d+\s*\/\s*\d+/)).toHaveCount(0);

  for (const width of [1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const table = await page.locator('[data-widget-table]').evaluate((element) => ({ scroll: element.parentElement.scrollWidth, client: element.parentElement.clientWidth }));
    expect(table.scroll, `Défilement horizontal du tableau à ${width} px`).toBeLessThanOrEqual(table.client + 1);
  }
  await expectAccessible(page);
  expect(errors.snapshot().pageError).toEqual([]);
  expect(errors.snapshot().consoleError).toEqual([]);
});

test('114 — Studio : en-tête compact, aucun jargon, menu entier et largeur d’affichage', async ({ page, baseURL }) => {
  await authenticate(page, baseURL, 'operateur');
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#/rapport?semaine=2026-11-15');
  await expect(page.locator('[data-display-width]')).toHaveAttribute('data-display-width', 'max', { timeout: 20_000 });

  const headerHeight = await page.locator('[data-report-studio]').evaluate((element) => element.getBoundingClientRect().height);
  expect(headerHeight, 'En-tête du studio trop haut').toBeLessThanOrEqual(140);
  await expect(page.locator('[data-studio-toolbar]')).toHaveCount(1);
  const text = await page.locator('body').innerText();
  for (const forbidden of ['SQL', 'catalogue contrôlé', '{{', 'undefined', '[object']) {
    expect(text, `Texte technique visible : ${forbidden}`).not.toContain(forbidden);
  }
  const lefts = await page.locator('aside a').evaluateAll((items) => items.map((item) => item.getBoundingClientRect().left));
  expect(lefts.length).toBeGreaterThan(0);
  expect(lefts.every((left) => left >= 0), 'Entrées de menu rognées à gauche').toBe(true);

  const wrapper = page.locator('[data-display-width]');
  const maxWidth = await wrapper.evaluate((element) => element.getBoundingClientRect().width);
  expect(maxWidth).toBeGreaterThan(1100);
  await page.locator('#report-studio-width').selectOption('print');
  await expect(wrapper).toHaveAttribute('data-display-width', 'print');
  const printWidth = await wrapper.evaluate((element) => element.getBoundingClientRect().width);
  expect(printWidth).toBeLessThanOrEqual(800);
  await page.emulateMedia({ media: 'print' });
  const paperWidth = await page.locator('[data-print-document]').evaluate((element) => element.getBoundingClientRect().width);
  expect(paperWidth).toBeLessThanOrEqual(800);
  await expect(page.locator('[data-print-document]')).toHaveClass(/print-portrait/);
  await page.emulateMedia({ media: 'screen' });

  await expectAccessible(page);
  expect(errors.snapshot().pageError).toEqual([]);
  expect(errors.snapshot().consoleError).toEqual([]);
});

test('115 — Studio : les actions compactes de chaque widget sont présentes et fonctionnelles', async ({ page, baseURL }) => {
  await authenticate(page, baseURL, 'operateur');
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#/rapport?semaine=2026-11-15');
  const cards = page.locator('[data-widget-card]');
  await expect(cards.first()).toBeVisible({ timeout: 20_000 });
  expect(await cards.count()).toBeGreaterThanOrEqual(3);

  for (let index = 0; index < 3; index += 1) {
    const card = cards.nth(index);
    await expect(card.getByRole('button', { name: 'Plus d’actions' }), `Menu absent du widget ${index}`).toHaveCount(1);
    await card.getByRole('button', { name: 'Plus d’actions' }).click();
    for (const label of ['Voir la définition', 'Voir les données', 'Voir les fiches', 'Exporter en PNG', 'Exporter en JSON']) {
      await expect(card.getByRole('menu').getByRole('button', { name: label }), `${label} absent du menu du widget ${index}`).toHaveCount(1);
    }
    await card.getByRole('button', { name: 'Plus d’actions' }).click();
  }
  const first = cards.first();
  await first.getByRole('button', { name: 'Plus d’actions' }).click();
  await first.getByRole('menu').getByRole('button', { name: 'Voir la définition' }).click();
  await expect(page.getByRole('dialog', { name: /Voir la définition/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await first.getByRole('button', { name: 'Plus d’actions' }).click();
  await first.getByRole('menu').getByRole('button', { name: 'Voir les données' }).click();
  await expect(page.getByRole('dialog', { name: /Voir les données/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await first.getByRole('button', { name: 'Afficher en plein écran' }).click();
  await expect(page.locator('[data-widget-fullscreen]')).toBeVisible();
  await page.locator('[data-widget-fullscreen]').getByRole('button', { name: 'Fermer' }).click();
  await expect(page.locator('[data-widget-fullscreen]')).toHaveCount(0);

  const csv = page.waitForEvent('download');
  await first.getByRole('button', { name: 'Exporter ce widget en CSV' }).click();
  expect((await csv).suggestedFilename()).toMatch(/\.csv$/);
  await first.getByRole('button', { name: 'Plus d’actions' }).click();
  const png = page.waitForEvent('download');
  await first.getByRole('menu').getByRole('button', { name: 'Exporter en PNG' }).click();
  expect((await png).suggestedFilename()).toMatch(/\.png$/);

  await first.getByRole('button', { name: 'Plus d’actions' }).click();
  await first.getByRole('menu').getByRole('button', { name: 'Voir les fiches' }).click();
  await expect(page).toHaveURL(/#\/anomalies/);
  expect(errors.snapshot().pageError).toEqual([]);
  expect(errors.snapshot().consoleError).toEqual([]);
});

test('Studio — affichage maximal, barre compacte et retour à la semaine courante', async ({ page, baseURL }) => {
  await authenticate(page, baseURL, 'operateur');
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#/rapport?semaine=2026-11-15');
  const wrapper = page.locator('[data-display-width]');
  await expect(wrapper).toHaveAttribute('data-display-width', 'max', { timeout: 20_000 });
  const maxWidth = await wrapper.evaluate((element) => element.getBoundingClientRect().width);

  await page.locator('#report-studio-width').selectOption('large');
  await expect(wrapper).toHaveAttribute('data-display-width', 'large');
  const largeWidth = await wrapper.evaluate((element) => element.getBoundingClientRect().width);
  expect(largeWidth, 'Le mode plein écran doit être plus large que le mode large').toBeLessThan(maxWidth);
  await page.locator('#report-studio-width').selectOption('max');
  await expect(wrapper).toHaveAttribute('data-display-width', 'max');

  await page.getByRole('button', { name: 'Agrandir l’espace de travail' }).click();
  await expect(page.locator('[data-report-studio]')).toHaveCount(0);
  await expect(page.locator('[data-report-studio-compact]')).toBeVisible();
  await expect(page.locator('aside')).toBeHidden();
  await expect(page.locator('header[role="banner"]')).toBeHidden();
  const focusWidth = await wrapper.evaluate((element) => element.getBoundingClientRect().width);
  expect(focusWidth, 'Le mode compact doit libérer toute la largeur').toBeGreaterThanOrEqual(maxWidth);
  await expect(page.locator('#report-studio-compact-week')).toHaveValue('2026-11-15');
  await expectNoOverflow(page);
  await expectAccessible(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await expectNoOverflow(page);
  await expectAccessible(page);
  await page.setViewportSize({ width: 1440, height: 1000 });

  await page.getByRole('button', { name: 'Réafficher la barre d’outils' }).click();
  await expect(page.locator('[data-report-studio]')).toBeVisible();
  await expect(page.locator('[data-report-studio-compact]')).toHaveCount(0);
  await expect(page.locator('aside')).toBeVisible();
  await expect(page.locator('#report-studio-week')).toHaveValue('2026-11-15');

  await page.locator('#report-studio-week').fill('2026-11-01');
  await expect(page).toHaveURL(/semaine=2026-11-01/);
  await page.getByRole('button', { name: 'Revenir à cette semaine' }).click();
  // La semaine courante dépend de la date d'exécution (todayAlgiers), pas d'une constante.
  const semaineCourante = weekStart(todayAlgiers(), 0);
  await expect(page).toHaveURL(new RegExp(`semaine=${semaineCourante}`));
  await expect(page.locator('#report-studio-week')).toHaveValue(semaineCourante);

  await expectAccessible(page);
  expect(errors.snapshot().pageError).toEqual([]);
  expect(errors.snapshot().consoleError).toEqual([]);
});

test('Studio — préparation d’impression A4 lisible et réglages réinitialisables', async ({ page, baseURL }) => {
  await authenticate(page, baseURL, 'operateur');
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#/rapport?semaine=2026-11-15');
  await expect(page.locator('[data-synthese-state]')).toHaveAttribute('data-synthese-state', 'lecture', { timeout: 20_000 });

  await page.getByRole('button', { name: 'Ouvrir l’impression A4' }).click();
  const printDialog = page.getByRole('dialog', { name: 'Préparer le rapport officiel' });
  await expect(printDialog).toBeVisible();
  await expect(printDialog.locator('legend', { hasText: 'Mise en page A4' })).toBeVisible();
  const preview = printDialog.locator('[data-print-preview]');
  await expect(preview).toHaveAttribute('data-orientation', 'portrait');

  await printDialog.getByLabel('Référence').fill('UX-2026-11');
  await printDialog.getByLabel('Orientation A4').selectOption('landscape');
  await expect(preview).toHaveAttribute('data-orientation', 'landscape');
  await printDialog.getByRole('button', { name: 'Rétablir les valeurs initiales' }).click();
  await expect(printDialog.getByLabel('Référence')).toHaveValue('');
  await expect(printDialog.getByLabel('Orientation A4')).toHaveValue('portrait');
  await expect(preview).toHaveAttribute('data-orientation', 'portrait');

  await printDialog.getByLabel('Référence').fill('UX-2026-11');
  await printDialog.getByLabel('Orientation A4').selectOption('landscape');
  await printDialog.getByRole('button', { name: 'Annuler' }).click();
  await expect(printDialog).toHaveCount(0);

  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('[data-print-header]')).toBeVisible();
  await expect(page.locator('[data-print-footer]')).toBeVisible();
  await expect(page.locator('[data-print-document]')).toHaveClass(/print-landscape/);
  const spans = await page.locator('[data-print-document] [data-largeur]').evaluateAll((items) => items.map((item) => getComputedStyle(item).gridColumnEnd));
  expect(spans.length).toBeGreaterThan(0);
  expect(spans.every((value) => value !== 'span 1'), 'Les blocs ne doivent pas être écrasés sur une colonne').toBe(true);
  const [fullWidth, gridWidth] = await Promise.all([
    page.locator('[data-print-document] [data-largeur="pleine"]').first().evaluate((element) => element.getBoundingClientRect().width),
    page.locator('[data-print-document] [data-synthese-grid]').evaluate((element) => element.getBoundingClientRect().width),
  ]);
  expect(fullWidth).toBeGreaterThan(gridWidth * 0.9);
  await page.emulateMedia({ media: 'screen' });

  await expectNoOverflow(page);
  await expectAccessible(page);
  expect(errors.snapshot().pageError).toEqual([]);
  expect(errors.snapshot().consoleError).toEqual([]);
});

test('Studio — légendes des graphiques et aperçu A4 pendant la création', async ({ page, baseURL }) => {
  await authenticate(page, baseURL, 'operateur');
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#/rapport?semaine=2026-11-15');
  await expect(page.locator('[data-chart]').first()).toBeVisible({ timeout: 20_000 });

  const charts = await page.locator('[data-chart]').count();
  const legends = await page.locator('[data-chart-legend]').count();
  expect(charts).toBeGreaterThanOrEqual(2);
  expect(legends, 'Chaque graphique doit porter une clé lisible').toBeGreaterThanOrEqual(charts);
  const firstItem = page.locator('[data-chart-legend] li').first();
  await expect(firstItem.locator('span[aria-hidden="true"]')).toBeVisible();
  expect((await firstItem.innerText()).trim().length).toBeGreaterThan(0);

  const clipped = await page.locator('[data-chart]').evaluateAll((items) => items.filter((element) => element.scrollHeight > element.clientHeight + 1 || element.scrollWidth > element.clientWidth + 1).length);
  expect(clipped, 'Graphique comprimé ou rogné').toBe(0);

  await page.getByRole('button', { name: 'Personnaliser', exact: true }).click();
  await expect(page.locator('[data-synthese-state]')).toHaveAttribute('data-synthese-state', 'personnalisation');
  await page.getByRole('button', { name: 'Aperçu A4' }).click();
  await expect(page.locator('[data-display-width]')).toHaveAttribute('data-display-width', 'print');
  await expect(page.locator('[data-print-header]')).toBeVisible();
  await expect(page.locator('[data-print-footer]')).toBeVisible();

  await expectNoOverflow(page);
  await expectAccessible(page);
  expect(errors.snapshot().pageError).toEqual([]);
  expect(errors.snapshot().consoleError).toEqual([]);
});
