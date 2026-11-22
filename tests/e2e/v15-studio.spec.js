import { test, expect } from './fixture.js';
import { authenticate } from './helpers.js';
import { createDiagnostic, mesurerStudio } from './v15-instrumentation.js';

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
      diagnostic.set({ ...rapport, kpiLignes });

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
    } finally { await diagnostic.save(); }
  });
}
