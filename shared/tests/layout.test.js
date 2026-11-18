import { describe, it, expect } from 'vitest';
import {
  GRILLE_COLONNES, convertirEnGrille, decouperEnPages, deplacerWidget,
  redimensionnerWidget,
} from '../src/layout.js';
import { validerDefinition } from '../src/syntheseSchemas.js';

const bloc = (id, type, options = {}) => ({ id, type, options });
const definition = {
  schema_version: 1,
  sections: [
    { id: 'executif', colonnes: [[bloc('kpi', 'kpi', { largeur: 'pleine' })]] },
    { id: 'statuts', colonnes: [[bloc('anneau', 'anneau', { largeur: 'simple' })]] },
    { id: 'territoire', colonnes: [[bloc('table', 'tableau', { largeur: 'double' })]] },
  ],
};

describe('grille V10 — conversion sections → grille', () => {
  it('convertit les largeurs historiques sans chevauchement', () => {
    const layout = convertirEnGrille(definition);
    expect(layout.colonnes).toBe(GRILLE_COLONNES);
    expect(layout.widgets).toHaveLength(3);
    expect(layout.widgets.map((widget) => widget.w)).toEqual([12, 4, 8]);
    expect(layout.widgets[1].y).toBeGreaterThanOrEqual(layout.widgets[0].y + layout.widgets[0].h);
    expect(layout.widgets[2].y).toBeGreaterThanOrEqual(layout.widgets[1].y + layout.widgets[1].h);
  });

  it('ajoute les blocs absents à la grille existante', () => {
    const layout = convertirEnGrille({
      ...definition,
      layout: { schema_version: 1, widgets: [{ id: 'kpi', x: 3, y: 0, w: 6, h: 3 }] },
    });
    expect(layout.widgets.find((widget) => widget.id === 'kpi')).toMatchObject({ x: 3, w: 6 });
    expect(layout.widgets.find((widget) => widget.id === 'anneau')).toBeTruthy();
    expect(layout.widgets.find((widget) => widget.id === 'table')).toBeTruthy();
  });

  it('refuse une grille qui dépasse 12 colonnes ou référence un bloc inconnu', () => {
    const base = {
      schema_version: 1,
      sections: [{ id: 's', colonnes: [[bloc('kpi', 'texte')]] }],
    };
    expect(() => validerDefinition({
      ...base,
      layout: { schema_version: 1, widgets: [{ id: 'kpi', x: 10, y: 0, w: 4, h: 2 }] },
    })).toThrow(/12 colonnes/);
    expect(() => validerDefinition({
      ...base,
      layout: { schema_version: 1, widgets: [{ id: 'absent', x: 0, y: 0, w: 4, h: 2 }] },
    })).toThrow(/absent des blocs/);
  });
});

describe('grille V10 — déplacement et redimensionnement', () => {
  const layout = {
    schema_version: 1,
    colonnes: 12,
    hauteur_ligne: 40,
    widgets: [
      { id: 'a', x: 0, y: 0, w: 4, h: 4 },
      { id: 'b', x: 4, y: 0, w: 4, h: 4 },
    ],
  };

  it('pousse le voisin vers le bas en cas de collision', () => {
    const next = deplacerWidget(layout, 'a', 4, 0);
    expect(next.widgets.find((widget) => widget.id === 'a')).toMatchObject({ x: 4, y: 0 });
    expect(next.widgets.find((widget) => widget.id === 'b').y).toBeGreaterThanOrEqual(4);
  });

  it('borne la largeur et la hauteur', () => {
    const next = redimensionnerWidget(layout, 'a', 20, -10);
    expect(next.widgets.find((widget) => widget.id === 'a')).toMatchObject({ w: 12, h: 1 });
  });
});

describe('grille V10 — pagination d’impression', () => {
  it('pousse le widget qui franchit la limite avec ceux du dessous', () => {
    const resultat = decouperEnPages({
      widgets: [
        { id: 'a', x: 0, y: 0, w: 12, h: 4 },
        { id: 'b', x: 0, y: 6, w: 12, h: 4 },
        { id: 'c', x: 0, y: 24, w: 12, h: 4 },
        { id: 'd', x: 0, y: 30, w: 12, h: 3 },
      ],
    }, { hauteurPage: 26 });
    expect(resultat.pages).toHaveLength(2);
    expect(resultat.pages[0].widgets.map((widget) => widget.id)).toEqual(['a', 'b']);
    expect(resultat.pages[1].widgets.map((widget) => widget.id)).toEqual(['c', 'd']);
    expect(resultat.pages[1].widgets[0].page_y).toBe(0);
    expect(resultat.pages.every((page) => page.hauteur <= 26)).toBe(true);
  });

  it('respecte un saut de page forcé', () => {
    const resultat = decouperEnPages({
      widgets: [
        { id: 'a', x: 0, y: 0, w: 12, h: 4 },
        { id: 'b', x: 0, y: 4, w: 12, h: 4, saut_page: true },
      ],
    });
    expect(resultat.pages).toHaveLength(2);
    expect(resultat.pages[1].widgets[0].id).toBe('b');
    expect(resultat.pages[1].widgets[0].page_y).toBe(0);
  });
});
