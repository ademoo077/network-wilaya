/**
 * Grille de Studio V10 : positions en cellules 12 × 40 px et pagination A4.
 *
 * Les fonctions sont pures et déterministes. Les anciens modèles V8.2
 * (`sections[].colonnes[]`) sont convertis à la lecture ; aucune édition figée
 * n'est réécrite.
 */
import { resoudrePlacement } from './layoutPlacement.js';

export { layoutSansChevauchement, widgetsSeChevauchent } from './layoutPlacement.js';

export const GRILLE_COLONNES = 12;
export const GRILLE_HAUTEUR = 40;
export const GRILLE_ECART = 4;
export const PAGES_PAR_DEFAUT = 26;

const LARGEURS = { simple: 4, double: 8, pleine: 12 };
const HAUTEURS = {
  kpi: 3, tableau: 8, liste_fiches: 8, classement: 6, chronologie: 6,
  barres: 6, lignes: 6, anneau: 6, courbe: 6, aire: 6, pareto: 6,
  histogramme: 6, cascade: 6, carte_thermique: 6, radar: 6, nuage: 6,
  treemap: 6, entonnoir: 6, texte: 3, signature: 3, legende: 3,
  annexe: 3, separateur: 1,
};

function entier(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) ? number : fallback;
}

function borne(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function blocsDeDefinition(definition) {
  const blocs = [];
  for (const section of definition?.sections || []) {
    for (const colonne of section.colonnes || []) {
      for (const bloc of colonne || []) blocs.push({ ...bloc, section: section.id });
    }
  }
  return blocs;
}

export function largeurWidget(bloc, fallback = 6) {
  const explicite = entier(bloc?.options?.largeur_cellules, null);
  if (explicite) return borne(explicite, 1, GRILLE_COLONNES);
  return LARGEURS[bloc?.options?.largeur] || borne(fallback, 1, GRILLE_COLONNES);
}

export function hauteurWidget(bloc) {
  return borne(entier(bloc?.options?.hauteur_cellules, HAUTEURS[bloc?.type] || 4), 1, 40);
}

function repartirLargeurs(nombre) {
  const n = borne(entier(nombre, 1), 1, GRILLE_COLONNES);
  const base = Math.floor(GRILLE_COLONNES / n);
  const reste = GRILLE_COLONNES - base * n;
  return Array.from({ length: n }, (_, index) => base + (index < reste ? 1 : 0));
}

function normaliserWidget(widget, index) {
  const w = borne(entier(widget?.w, 6), 1, GRILLE_COLONNES);
  return {
    id: String(widget?.id || `widget-${index}`),
    x: borne(entier(widget?.x, 0), 0, GRILLE_COLONNES - w),
    y: Math.max(0, entier(widget?.y, 0)),
    w,
    h: borne(entier(widget?.h, 4), 1, 40),
    ...(widget?.saut_page ? { saut_page: true } : {}),
  };
}

function normaliserWidgets(widgets, { compactage = true, prioritaire = null } = {}) {
  const seen = new Set();
  const uniques = (widgets || []).map(normaliserWidget).filter((widget) => {
    if (seen.has(widget.id)) return false;
    seen.add(widget.id);
    return true;
  });
  return resoudrePlacement(uniques, { compactage, prioritaire });
}

export function normaliserLayout(definition, candidate) {
  const blocs = blocsDeDefinition(definition);
  const ids = new Set(blocs.map((bloc) => bloc.id));
  const seen = new Set();
  const widgets = [];
  for (const [index, raw] of (candidate?.widgets || []).entries()) {
    const widget = normaliserWidget(raw, index);
    if (!ids.has(widget.id) || seen.has(widget.id)) continue;
    seen.add(widget.id);
    widgets.push(widget);
  }
  let y = widgets.reduce((max, widget) => Math.max(max, widget.y + widget.h), 0);
  for (const bloc of blocs) {
    if (seen.has(bloc.id)) continue;
    const h = hauteurWidget(bloc);
    widgets.push({ id: bloc.id, x: 0, y, w: largeurWidget(bloc, GRILLE_COLONNES), h });
    y += h + 1;
  }
  const compactage = candidate?.compactage !== false;
  return {
    schema_version: 1,
    colonnes: GRILLE_COLONNES,
    hauteur_ligne: GRILLE_HAUTEUR,
    ...(compactage ? {} : { compactage: false }),
    widgets: normaliserWidgets(widgets, { compactage }),
  };
}

/** Convertit sections/colonnes en grille, ou normalise une grille existante. */
export function convertirEnGrille(definition) {
  if (definition?.layout?.widgets) return normaliserLayout(definition, definition.layout);
  const widgets = [];
  let sectionY = 0;
  for (const section of definition?.sections || []) {
    const colonnes = section.colonnes?.length ? section.colonnes : [[]];
    const largeurs = repartirLargeurs(colonnes.length);
    const offsets = [];
    let offset = 0;
    for (const largeur of largeurs) {
      offsets.push(offset);
      offset += largeur;
    }
    const hauteurs = colonnes.map(() => 0);
    for (const [colonneIndex, colonne] of colonnes.entries()) {
      for (const bloc of colonne || []) {
        const h = hauteurWidget(bloc);
        widgets.push({
          id: bloc.id,
          x: offsets[colonneIndex],
          y: sectionY + hauteurs[colonneIndex],
          w: Math.min(largeurWidget(bloc, largeurs[colonneIndex]), GRILLE_COLONNES - offsets[colonneIndex]),
          h,
          ...(bloc.options?.saut_page ? { saut_page: true } : {}),
        });
        hauteurs[colonneIndex] += h + 1;
      }
    }
    sectionY += Math.max(1, ...hauteurs);
  }
  return normaliserLayout(definition, { widgets });
}

export function deplacerWidget(layout, id, dx, dy) {
  const next = JSON.parse(JSON.stringify(layout));
  const widget = next.widgets.find((item) => item.id === id);
  if (!widget) return next;
  widget.x = borne(widget.x + entier(dx, 0), 0, GRILLE_COLONNES - widget.w);
  widget.y = Math.max(0, widget.y + entier(dy, 0));
  const compactage = next.compactage !== false;
  if (compactage) delete next.compactage;
  next.widgets = normaliserWidgets(next.widgets, { compactage, prioritaire: id });
  return next;
}

export function redimensionnerWidget(layout, id, dw, dh) {
  const next = JSON.parse(JSON.stringify(layout));
  const widget = next.widgets.find((item) => item.id === id);
  if (!widget) return next;
  widget.w = borne(widget.w + entier(dw, 0), 1, GRILLE_COLONNES - widget.x);
  widget.h = borne(widget.h + entier(dh, 0), 1, 40);
  const compactage = next.compactage !== false;
  if (compactage) delete next.compactage;
  next.widgets = normaliserWidgets(next.widgets, { compactage, prioritaire: id });
  return next;
}

/** Applique en une fois les hauteurs mesurées par le navigateur. */
export function ajusterHauteursWidgets(layout, changements) {
  const next = JSON.parse(JSON.stringify(layout));
  let changed = false;
  for (const changement of changements || []) {
    const widget = next.widgets.find((item) => item.id === changement.id);
    if (!widget) continue;
    const min = borne(entier(changement.min, 1), 1, 40);
    const max = borne(entier(changement.max, 40), min, 40);
    const h = borne(entier(changement.h, widget.h), min, max);
    if (h === widget.h) continue;
    widget.h = h;
    changed = true;
  }
  if (!changed) return next;
  const compactage = next.compactage !== false;
  if (compactage) delete next.compactage;
  next.widgets = normaliserWidgets(next.widgets, { compactage });
  return next;
}

/**
 * Pagination d'impression : un widget qui franchit la limite est poussé en
 * haut de la page suivante avec ceux situés dessous. Aucun redimensionnement.
 */
export function decouperEnPages(layout, { hauteurPage = PAGES_PAR_DEFAUT } = {}) {
  const limite = Math.max(1, entier(hauteurPage, PAGES_PAR_DEFAUT));
  const widgets = [...(layout?.widgets || [])]
    .map((widget, index) => normaliserWidget(widget, index))
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const pages = [];
  let page = null;
  let depart = 0;
  const ouvrir = (y) => {
    page = { index: pages.length + 1, widgets: [], hauteur: 0, depart: y };
    pages.push(page);
    depart = y;
  };
  for (const widget of widgets) {
    if (!page) ouvrir(widget.y);
    const deborde = widget.y + widget.h - depart > limite;
    const force = widget.saut_page && page.widgets.length > 0;
    if ((deborde || force) && page.widgets.length > 0) ouvrir(widget.y);
    const y = Math.max(0, widget.y - depart);
    page.widgets.push({ ...widget, page_x: widget.x, page_y: y });
    page.hauteur = Math.max(page.hauteur, y + widget.h);
  }
  return {
    pages,
    hauteur_page: limite,
    avertissements: pages.some((item) => item.hauteur > limite) ? ['widget_trop_haut'] : [],
  };
}
