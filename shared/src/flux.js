/**
 * V15 — modèle de flux pour le Studio de synthèses.
 *
 * L'ordre du tableau est l'ordre de lecture. Les largeurs sont exprimées en
 * colonnes sur 12 et appartiennent à un jeu fermé. Les anciennes positions
 * `{x,y,w,h}` sont converties à la lecture ; les éditions figées ne sont jamais
 * réécrites. Ce module est pur et ne dépend d'aucun DOM.
 */
export const FLUX_COLONNES = 12;
export const LARGEURS_FLUX = [3, 4, 6, 8, 9, 12];
export const LARGEUR_MIN_WIDGET_PX = 240;

const LARGEURS_HISTORIQUES = { simple: 4, double: 8, pleine: 12 };
const HAUTEURS_DEFAUT = {
  kpi: 3, tableau: 8, liste_fiches: 8, classement: 6, chronologie: 6,
  barres: 6, lignes: 6, anneau: 6, courbe: 6, aire: 6, pareto: 6,
  histogramme: 6, cascade: 6, carte_thermique: 6, radar: 6, nuage: 6,
  treemap: 6, entonnoir: 6, texte: 3, signature: 3, legende: 3,
  annexe: 3, separateur: 1,
};

function entier(value, fallback) {
  const nombre = Number(value);
  return Number.isInteger(nombre) ? nombre : fallback;
}

function borne(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** Arrondit une ancienne largeur (ou un nombre arbitraire) au jeu fermé V15. */
export function largeurFlux(value, fallback = 6) {
  const nombre = entier(value, null);
  if (nombre === null) return fallback;
  if (LARGEURS_FLUX.includes(nombre)) return nombre;
  return LARGEURS_FLUX.reduce((meilleure, candidate) => (
    Math.abs(candidate - nombre) <= Math.abs(meilleure - nombre) ? candidate : meilleure
  ), LARGEURS_FLUX[0]);
}

function largeurHistorique(bloc, fallback = 6) {
  const explicite = entier(bloc?.options?.largeur_cellules, null);
  if (explicite) return borne(explicite, 1, FLUX_COLONNES);
  return LARGEURS_HISTORIQUES[bloc?.options?.largeur] || borne(fallback, 1, FLUX_COLONNES);
}

function hauteurHistorique(bloc) {
  return borne(entier(bloc?.options?.hauteur_cellules, HAUTEURS_DEFAUT[bloc?.type] || 4), 1, 40);
}

function blocsDe(definition) {
  return (definition?.sections || []).flatMap((section) => (section.colonnes || []).flatMap((colonne) => colonne || []));
}

/** Règle exacte du prompt : on ouvre une ligne dès que la somme dépasserait 12. */
export function regrouperEnLignes(widgets, colonnes = FLUX_COLONNES) {
  const lignes = [];
  let courante = [];
  let somme = 0;
  for (const widget of widgets || []) {
    const largeur = largeurFlux(widget?.largeur ?? widget?.w, 6);
    if (courante.length && somme + largeur > colonnes) {
      lignes.push(courante);
      courante = [];
      somme = 0;
    }
    const normalise = { ...widget, largeur };
    courante.push(normalise);
    somme += largeur;
  }
  if (courante.length) lignes.push(courante);
  return lignes;
}

/** Conversion pure `{x,y,w,h}` → flux, triée par `(y, x)` puis index. */
export function convertirXyEnFlux(widgets) {
  return [...(widgets || [])]
    .sort((a, b) => (entier(a?.y, 0) - entier(b?.y, 0)) || (entier(a?.x, 0) - entier(b?.x, 0)))
    .map((widget, index) => ({
      id: String(widget?.id || `widget-${index}`),
      ordre: index,
      largeur: largeurFlux(widget?.largeur ?? widget?.w, 6),
      hauteur: 'auto',
      ...(widget?.saut_page ? { saut_page: true } : {}),
    }));
}

function convertirSectionsEnFlux(definition) {
  return blocsDe(definition).map((bloc, index) => ({
    id: String(bloc.id),
    ordre: index,
    largeur: largeurHistorique(bloc, FLUX_COLONNES),
    hauteur: 'auto',
  }));
}

/** Normalise un flux : ids connus, ordre contigu, aucun doublon, blocs absents ajoutés. */
export function normaliserFlux(definition, candidat) {
  const blocs = blocsDe(definition);
  const connus = new Set(blocs.map((bloc) => String(bloc.id)));
  const vus = new Set();
  const widgets = [];
  const source = [...(candidat?.widgets || [])].sort((a, b) => entier(a?.ordre, 0) - entier(b?.ordre, 0));
  for (const brut of source) {
    const id = String(brut?.id || '');
    if (!connus.has(id) || vus.has(id)) continue;
    vus.add(id);
    const hauteur = brut?.hauteur && typeof brut.hauteur === 'object'
      ? {
        min: borne(entier(brut.hauteur.min, 1), 1, 40),
        max: borne(entier(brut.hauteur.max, 40), 1, 40),
      }
      : 'auto';
    if (typeof hauteur === 'object') hauteur.max = Math.max(hauteur.min, hauteur.max);
    widgets.push({
      id,
      ordre: widgets.length,
      largeur: largeurFlux(brut?.largeur ?? brut?.w, 6),
      hauteur,
      ...(brut?.saut_page ? { saut_page: true } : {}),
    });
  }
  for (const bloc of blocs) {
    const id = String(bloc.id);
    if (vus.has(id)) continue;
    vus.add(id);
    widgets.push({ id, ordre: widgets.length, largeur: largeurHistorique(bloc, FLUX_COLONNES), hauteur: 'auto' });
  }
  return { schema_version: 2, colonnes: FLUX_COLONNES, widgets };
}

/** Point d'entrée unique : v2, ancienne grille v1, ou sections V8. */
export function convertirEnFlux(definition, layout = definition?.layout) {
  if (layout?.schema_version === 2) return normaliserFlux(definition, layout);
  if (layout?.widgets) return normaliserFlux(definition, { widgets: convertirXyEnFlux(layout.widgets) });
  return normaliserFlux(definition, { widgets: convertirSectionsEnFlux(definition) });
}

/** Grille de compatibilité dérivée du flux : zero x/y libre, zéro collision. */
export function grilleDepuisFlux(definition, layout) {
  const flux = normaliserFlux(definition, layout);
  const parId = new Map(blocsDe(definition).map((bloc) => [String(bloc.id), bloc]));
  const widgets = [];
  let y = 0;
  for (const ligne of regrouperEnLignes(flux.widgets)) {
    let x = 0;
    let hauteurLigne = 1;
    for (const widget of ligne) {
      const h = hauteurHistorique(parId.get(widget.id));
      widgets.push({ id: widget.id, x, y, w: widget.largeur, h, ...(widget.saut_page ? { saut_page: true } : {}) });
      x += widget.largeur;
      hauteurLigne = Math.max(hauteurLigne, h);
    }
    y += hauteurLigne + 1;
  }
  return { schema_version: 1, colonnes: FLUX_COLONNES, hauteur_ligne: 40, widgets };
}

/**
 * 4 KPI sur une ligne large, 2+2 sur une ligne moyenne, jamais 3+1.
 * La fonction est pure : le composant lui fournit la largeur mesurée.
 */
export function colonnesEquilibrees(nombre, largeurPx, minCarte = 170) {
  const n = Math.max(1, entier(nombre, 1));
  const max = Math.max(1, Math.floor(largeurPx / Math.max(1, minCarte)));
  const lignes = Math.ceil(n / max);
  return Math.ceil(n / lignes);
}

/** Vrai si une colonne de widget respecte le plancher de 240 px à l'écran. */
export function largeurMinimaleRespectee(largeurColonnes, largeurUtile, colonnes = FLUX_COLONNES, ecart = 16) {
  const utile = largeurUtile - (colonnes - 1) * ecart;
  return (utile / colonnes) * largeurColonnes >= LARGEUR_MIN_WIDGET_PX;
}
