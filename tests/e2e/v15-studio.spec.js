import { addDays, todayAlgiers, weekStart } from '@anm/shared';
import { test, expect } from './fixture.js';
import { authenticate } from './helpers.js';
import { expectNoOverflow } from './geometry.js';
import { createDiagnostic, mesurerBarreOutils, mesurerDonut, mesurerStudio, mesurerTableau } from './v15-instrumentation.js';

for (const largeur of [1280, 1440]) {
  test(`192 — Studio ${largeur} px : lignes 4+8, KPI équilibrés, largeur minimale`, async ({ page, baseURL }, testInfo) => {
    const diagnostic = createDiagnostic(page, testInfo, `S192-${largeur}`);
    try {
      await authenticate(page, baseURL, 'operateur');
      await page.setViewportSize({ width: largeur, height: 1000 });
      await page.goto('/#/rapport?semaine=2026-11-15');
      await expect(page.locator('[data-kpi-value]').first()).toBeVisible({ timeout: 20_000 });

      const rapport = await mesurerStudio(page);
      const kpiLignes = await page.locator('[data-kpi-item]').evaluateAll((items) => {
        const groupes = new Map();
        for (const item of items) {
          const r = item.getBoundingClientRect();
          groupes.set(Math.round(r.y / 20), (groupes.get(Math.round(r.y / 20)) || 0) + 1);
        }
        return [...groupes.values()];
      });
      const barre = await mesurerBarreOutils(page);
      diagnostic.set({ ...rapport, kpiLignes, barre });

      const statuts = rapport.widgets.find((widget) => /Répartition des statuts/i.test(widget.titre));
      const dairas = rapport.widgets.find((widget) => /Par daïra/i.test(widget.titre));
      expect(statuts && dairas, 'Widgets 4 et 8 colonnes absents').toBeTruthy();
      expect(Math.abs(statuts.y - dairas.y), 'Les deux widgets ne sont pas sur la même ligne').toBeLessThanOrEqual(40);
      expect(dairas.largeur / statuts.largeur, 'Ratio 4:8 attendu').toBeGreaterThan(1.7);
      expect(dairas.largeur / statuts.largeur, 'Ratio 4:8 attendu').toBeLessThan(2.3);
      expect(rapport.plusEtroit, 'Widget plus étroit que 240 px').toBeGreaterThanOrEqual(240);
      expect(Math.max(...rapport.trous, 0), 'Trou vertical supérieur à 120 px').toBeLessThanOrEqual(120);
      expect(kpiLignes.length > 0 && kpiLignes.every((count) => count >= 2), `Répartition KPI ${JSON.stringify(kpiLignes)}`).toBe(true);
      const intersections = rapport.widgets.flatMap((a, index) => rapport.widgets.slice(index + 1)
        .filter((b) => a.x < b.x + b.largeur && b.x < a.x + a.largeur && a.y < b.y + b.hauteur && b.y < a.y + a.hauteur)
        .map((b) => [a.id, b.id]));
      expect(intersections, 'Widgets superposés').toEqual([]);
      expect(barre.hauteur, 'Barre d’outils trop haute').toBeLessThanOrEqual(120);
      expect(barre.doublons, 'Boutons dupliqués').toEqual([]);
      expect(barre.sansLibelle, 'Contrôles sans libellé').toBe(0);
      expect(barre.boutons.some((texte) => texte.includes('Affichage')), 'Menu Affichage absent').toBe(true);
    } finally { await diagnostic.save(); }
  });
}

test('193 — Personnaliser : 240 px, poignées sur les bords, clavier et annuler/rétablir', async ({ page, baseURL }, testInfo) => {
  const diagnostic = createDiagnostic(page, testInfo, 'S193');
  try {
    await authenticate(page, baseURL, 'operateur');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/#/rapport?semaine=2026-11-15&personnaliser=1');
    await expect(page.locator('[data-synthese-state="personnalisation"]')).toBeVisible({ timeout: 25_000 });
    const widget = page.locator('[data-widget-id="anneau-statuts"]');
    await expect(widget).toBeVisible();

    const rapport = await mesurerStudio(page);
    const poignees = await page.locator('[data-widget-handle]').evaluateAll((items) => items.map((item) => item.dataset.widgetHandle));
    diagnostic.set({ ...rapport, poignees });
    expect(rapport.plusEtroit, 'Widget plus étroit que 240 px').toBeGreaterThanOrEqual(240);
    expect(poignees, 'Poignées de bord manquantes').toContain('deplacement');
    expect(poignees, 'Poignée de largeur manquante').toContain('largeur');
    await expect(page.getByText('Contenu masqué', { exact: true })).toHaveCount(0);

    const avant = await widget.evaluate((element) => ({ x: Number(element.dataset.x), w: Number(element.dataset.w) }));
    await widget.focus();
    await page.keyboard.press('ArrowRight');
    await expect(widget).toHaveAttribute('data-x', String(avant.x + 1));
    await page.keyboard.press('Shift+ArrowRight');
    const apresResize = Number(await widget.getAttribute('data-w'));
    expect(apresResize).toBeGreaterThanOrEqual(avant.w);
    await page.keyboard.press('Control+z');
    await expect(widget).toHaveAttribute('data-w', String(avant.w));
    await page.keyboard.press('Control+y');
    await expect(widget).toHaveAttribute('data-w', String(apresResize));

    for (const largeur of [768, 390]) {
      await page.setViewportSize({ width: largeur, height: 1000 });
      await expectNoOverflow(page);
      const mesure = await mesurerStudio(page);
      expect(mesure.widgets.length).toBeGreaterThan(0);
      if (largeur === 768) expect(mesure.plusEtroit).toBeGreaterThanOrEqual(240);
    }
  } finally { await diagnostic.save(); }
});

for (const lang of ['fr', 'ar']) {
  test(`194 — Anneau ${lang} : total centré dans le SVG et légende complète`, async ({ page, baseURL }, testInfo) => {
    const diagnostic = createDiagnostic(page, testInfo, `S194-${lang}`);
    try {
      const semaine = weekStart(todayAlgiers());
      await authenticate(page, baseURL, 'operateur');
      await page.addInitScript((language) => localStorage.setItem('anm-language', language), lang);
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto(`/#/rapport?semaine=${semaine}`);
      await expect(page.locator('[data-widget-id="anneau-statuts"]')).toBeVisible({ timeout: 20_000 });

      const donut = await mesurerDonut(page);
      diagnostic.set({ ...donut, semaine });
      expect(donut.present, 'Anneau absent').toBe(true);
      expect(donut.total.length, 'Total vide').toBeGreaterThan(0);
      expect(donut.dansAnneau, 'Total hors du graphique').toBe(true);
      expect(donut.entrees.length, 'Légende vide').toBeGreaterThanOrEqual(2);
      expect(donut.entrees.some((entree) => entree.tronque), 'Libellé tronqué').toBe(false);
      expect(donut.entrees.every((entree) => entree.texte.length > 1), 'Libellé vide').toBe(true);
    } finally { await diagnostic.save(); }
  });
}

async function evaluerTableauDaira(page, baseURL, semaine) {
  const modeles = await (await page.request.get(`${baseURL}/api/syntheses/modeles`)).json();
  const weekly = modeles.items.find((item) => item.cle_systeme === 'hebdomadaire');
  expect(weekly, 'Modèle hebdomadaire absent').toBeTruthy();
  const detail = await (await page.request.get(`${baseURL}/api/syntheses/modeles/${weekly.id}`)).json();
  const blocs = detail.item.definition.sections.flatMap((section) => section.colonnes.flat());
  const tab = blocs.find((bloc) => bloc.id === 'tab-daira');
  expect(tab, 'Bloc Par daïra absent').toBeTruthy();
  const csrf = await page.evaluate(() => window.__ANM_CSRF__);
  const reponse = await page.request.post(`${baseURL}/api/syntheses/evaluer`, {
    headers: { 'X-CSRF-Token': csrf },
    data: { requetes: [{ ...tab.requete, periode: { mode: 'plage', debut: semaine, fin: addDays(semaine, 6) } }] },
  });
  expect(reponse.ok(), `Évaluation API : ${reponse.status()}`).toBe(true);
  const corps = await reponse.json();
  return corps.items[0];
}

test('195 — Tableau « Par daïra » : dimension libellée, barres horizontales et toutes les lignes', async ({ page, baseURL }, testInfo) => {
  const diagnostic = createDiagnostic(page, testInfo, 'S195');
  try {
    const semaine = weekStart(todayAlgiers());
    await authenticate(page, baseURL, 'operateur');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/#/rapport?semaine=${semaine}`);
    await expect(page.locator('[data-widget-id="tab-daira"]')).toBeVisible({ timeout: 20_000 });

    const tableau = await mesurerTableau(page);
    const resultat = await evaluerTableauDaira(page, baseURL, semaine);
    diagnostic.set({ ...tableau, semaine, lignesApi: resultat.lignes?.length || 0 });
    expect(tableau.present, 'Tableau absent').toBe(true);
    expect(tableau.entetes[0], `Première colonne : ${JSON.stringify(tableau.entetes)}`).toMatch(/da[iï]ra/i);
    expect(tableau.premiereColonne, 'Cellules de dimension vides').toBe(tableau.lignes);
    expect(tableau.lignes, 'Lignes manquantes par rapport à l’API').toBe(resultat.lignes.length);
    expect(resultat.lignes.length, 'Jeu de test sans ligne').toBeGreaterThan(0);
    expect(tableau.rogne, 'Tableau rogné').toBe(false);
    expect(tableau.grapheHorizontal, 'Graphique horizontal absent').toBe(true);
    expect(tableau.etiquettes.length, 'Barres sans étiquettes').toBeGreaterThan(0);
  } finally { await diagnostic.save(); }
});
