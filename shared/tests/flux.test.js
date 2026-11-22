import { describe, it, expect } from 'vitest';
import {
  LARGEURS_FLUX, colonnesEquilibrees, convertirEnFlux, convertirXyEnFlux,
  grilleDepuisFlux, largeurFlux, largeurMinimaleRespectee, regrouperEnLignes,
} from '../src/flux.js';
import { validerDefinition } from '../src/syntheseSchemas.js';

const bloc = (id, type = 'texte', largeur = 6) => ({ id, type, options: { largeur } });
const definition = {
  schema_version: 1,
  sections: [{ id: 's', colonnes: [[bloc('kpi', 'texte', 'pleine'), bloc('anneau', 'texte', 'simple'), bloc('tab', 'texte', 'double')]] }],
};

function aleatoire(seed) {
  let valeur = seed >>> 0;
  return () => {
    valeur = (valeur * 1664525 + 1013904223) >>> 0;
    return valeur / 0x100000000;
  };
}

describe('V15 — regrouperEnLignes', () => {
  it('rassemble 4 + 8 sur la même ligne après un KPI pleine largeur', () => {
    const widgets = [
      { id: 'kpi', largeur: 12 }, { id: 'anneau', largeur: 4 }, { id: 'tab', largeur: 8 },
    ];
    const lignes = regrouperEnLignes(widgets);
    expect(lignes.map((ligne) => ligne.map((widget) => widget.id))).toEqual([
      ['kpi'], ['anneau', 'tab'],
    ]);
    expect(lignes.every((ligne) => ligne.reduce((somme, widget) => somme + widget.largeur, 0) <= 12)).toBe(true);
  });

  it('respecte l’ordre et la limite de 12 pour 50 projets aléatoires', () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const random = aleatoire(seed);
      const widgets = Array.from({ length: 20 }, (_, index) => ({
        id: `w-${index}`, ordre: index, largeur: LARGEURS_FLUX[Math.floor(random() * LARGEURS_FLUX.length)],
      }));
      const lignes = regrouperEnLignes(widgets);
      expect(lignes.flat().map((widget) => widget.id), `ordre seed ${seed}`).toEqual(widgets.map((widget) => widget.id));
      expect(lignes.every((ligne) => ligne.reduce((somme, widget) => somme + widget.largeur, 0) <= 12), `somme seed ${seed}`).toBe(true);
    }
  });
});

describe('V15 — conversion x/y vers flux', () => {
  it('trie par (y, x), arrondit la largeur et force hauteur auto', () => {
    const flux = convertirXyEnFlux([
      { id: 'b', x: 0, y: 10, w: 5, h: 8, saut_page: true },
      { id: 'a', x: 0, y: 0, w: 12, h: 3 },
      { id: 'c', x: 7, y: 10, w: 7, h: 4 },
    ]);
    expect(flux.map((widget) => widget.id)).toEqual(['a', 'b', 'c']);
    expect(flux.map((widget) => widget.largeur)).toEqual([12, 6, 8]);
    expect(flux.every((widget) => widget.hauteur === 'auto')).toBe(true);
    expect(flux[1].saut_page).toBe(true);
  });

  it('convertit 50 grilles aléatoires sans perte ni doublon', () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const random = aleatoire(seed);
      const blocs = Array.from({ length: 12 }, (_, index) => bloc(`w-${index}`));
      const def = { schema_version: 1, sections: [{ id: 's', colonnes: [blocs] }] };
      const widgets = blocs.map((item) => {
        const w = 1 + Math.floor(random() * 12);
        return { id: item.id, x: Math.floor(random() * (13 - w)), y: Math.floor(random() * 18), w, h: 4 };
      });
      const flux = convertirEnFlux(def, { schema_version: 1, widgets });
      expect(new Set(flux.widgets.map((widget) => widget.id)), `ids seed ${seed}`).toEqual(new Set(blocs.map((item) => item.id)));
      expect(flux.widgets.every((widget) => LARGEURS_FLUX.includes(widget.largeur)), `largeurs seed ${seed}`).toBe(true);
      expect(flux.widgets.map((widget) => widget.ordre)).toEqual(flux.widgets.map((_, index) => index));
    }
  });

  it('produit une grille de compatibilité sans intersection', () => {
    const flux = convertirEnFlux(definition);
    const grille = grilleDepuisFlux(definition, flux);
    expect(grille.widgets.map((widget) => widget.w)).toEqual([12, 4, 8]);
    expect(grille.widgets[1].y).toBe(grille.widgets[2].y);
    expect(grille.widgets[1].x + grille.widgets[1].w).toBe(grille.widgets[2].x);
    const paires = grille.widgets.flatMap((a, index) => grille.widgets.slice(index + 1)
      .filter((b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h)
      .map((b) => [a.id, b.id]));
    expect(paires).toEqual([]);
  });

  it('accepte un layout de flux dans validerDefinition', () => {
    expect(() => validerDefinition({ ...definition, layout: convertirEnFlux(definition) })).not.toThrow();
  });
});

describe('V15 — colonnes équilibrées et largeur minimale', () => {
  it('ne produit jamais 3 + 1 pour quatre KPI', () => {
    expect(colonnesEquilibrees(4, 1200)).toBe(4);
    expect(colonnesEquilibrees(4, 600)).toBe(2);
    expect(colonnesEquilibrees(5, 700)).toBe(3);
    expect(colonnesEquilibrees(7, 800)).toBe(4);
    for (let n = 1; n <= 24; n += 1) {
      for (const largeur of [280, 640, 900, 1440]) {
        const colonnes = colonnesEquilibrees(n, largeur);
        const lignes = Math.ceil(n / colonnes);
        expect(lignes * colonnes - n, `n=${n} largeur=${largeur}`).toBeLessThan(colonnes);
      }
    }
  });

  it('arrondit et borne les largeurs admises', () => {
    expect(largeurFlux(5)).toBe(6);
    expect(largeurFlux(7)).toBe(8);
    expect(largeurFlux(11)).toBe(12);
    expect(largeurFlux('invalide', 9)).toBe(9);
  });

  it('garantit 240 px pour une colonne de 3 sur écran large', () => {
    expect(largeurMinimaleRespectee(3, 1440)).toBe(true);
    expect(largeurMinimaleRespectee(3, 390)).toBe(false);
  });
});
