import { describe, it, expect } from 'vitest';
import {
  GRILLE_COLONNES, ajusterHauteursWidgets, convertirEnGrille, decouperEnPages,
  deplacerWidget, normaliserLayout, redimensionnerWidget,
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

function intersections(widgets) {
  return widgets.flatMap((a, index) => widgets.slice(index + 1).filter((b) => (
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
  )).map((b) => [a.id, b.id]));
}

function aleatoire(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

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

  it('propage les collisions à tous les voisins après un déplacement', () => {
    const colonne = {
      schema_version: 1,
      widgets: [
        { id: 'a', x: 0, y: 0, w: 6, h: 4 },
        { id: 'b', x: 0, y: 4, w: 6, h: 4 },
        { id: 'c', x: 0, y: 8, w: 6, h: 4 },
      ],
    };
    const next = deplacerWidget(colonne, 'a', 0, 4);
    expect(next.widgets.find((widget) => widget.id === 'a').y).toBe(4);
    expect(intersections(next.widgets)).toEqual([]);
    expect(next.widgets.find((widget) => widget.id === 'b').y).not.toBe(4);
    expect(next.widgets.map((widget) => widget.y).sort((a, b) => a - b)).toEqual([0, 4, 8]);
  });

  it('adapte la hauteur mesurée, respecte les bornes et écarte la suite', () => {
    const next = ajusterHauteursWidgets(layout, [{ id: 'a', h: 9, min: 3, max: 8 }]);
    expect(next.widgets.find((widget) => widget.id === 'a').h).toBe(8);
    expect(intersections(next.widgets)).toEqual([]);
  });
});

describe('grille V11 — normalisation et compactage', () => {
  it('normalise 50 projets aléatoires sans aucune intersection', () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const random = aleatoire(seed);
      const blocs = Array.from({ length: 20 }, (_, index) => bloc(`w-${index}`, 'texte'));
      const projet = { schema_version: 1, sections: [{ id: 's', colonnes: [blocs] }] };
      const candidate = {
        schema_version: 1,
        widgets: blocs.map((item) => {
          const w = 1 + Math.floor(random() * 12);
          return {
            id: item.id,
            x: Math.floor(random() * (13 - w)),
            y: Math.floor(random() * 18),
            w,
            h: 1 + Math.floor(random() * 12),
          };
        }),
      };
      const result = normaliserLayout(projet, candidate);
      expect(intersections(result.widgets), `seed ${seed}`).toEqual([]);
    }
  });

  it('compacte les espaces verticaux par défaut', () => {
    const projet = {
      schema_version: 1,
      sections: [{ id: 's', colonnes: [[bloc('a', 'texte'), bloc('b', 'texte')]] }],
    };
    const result = normaliserLayout(projet, {
      schema_version: 1,
      widgets: [
        { id: 'a', x: 0, y: 12, w: 6, h: 3 },
        { id: 'b', x: 0, y: 30, w: 6, h: 3 },
      ],
    });
    expect(result.widgets.find((widget) => widget.id === 'a').y).toBe(0);
    expect(result.widgets.find((widget) => widget.id === 'b').y).toBe(3);
  });

  it('conserve les espaces en mode libre tout en supprimant les collisions', () => {
    const projet = {
      schema_version: 1,
      sections: [{ id: 's', colonnes: [[bloc('a', 'texte'), bloc('b', 'texte')]] }],
    };
    const result = normaliserLayout(projet, {
      schema_version: 1,
      compactage: false,
      widgets: [
        { id: 'a', x: 0, y: 12, w: 6, h: 3 },
        { id: 'b', x: 0, y: 12, w: 6, h: 3 },
      ],
    });
    expect(result.compactage).toBe(false);
    expect(result.widgets.find((widget) => widget.id === 'a').y).toBe(12);
    expect(intersections(result.widgets)).toEqual([]);
  });

  it('compacte après la suppression d’un widget', () => {
    const projet = {
      schema_version: 1,
      sections: [{ id: 's', colonnes: [[bloc('b', 'texte')]] }],
      layout: {
        schema_version: 1,
        widgets: [
          { id: 'a', x: 0, y: 0, w: 12, h: 4 },
          { id: 'b', x: 0, y: 10, w: 12, h: 4 },
        ],
      },
    };
    const result = convertirEnGrille(projet);
    expect(result.widgets).toHaveLength(1);
    expect(result.widgets[0]).toMatchObject({ id: 'b', y: 0 });
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
