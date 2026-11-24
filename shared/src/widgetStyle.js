/**
 * Style d'un bloc de synthèse (V11).
 *
 * Règles partagées serveur/client : `options.style` reste libre dans le schéma
 * Zod (`z.record(z.any())`), mais la validation refuse une valeur inconnue et
 * le rendu ne connaît que les classes issues des tokens (clair/sombre, RTL).
 */

export const STYLE_ALIGNEMENTS = ['auto', 'start', 'center', 'end'];
export const STYLE_DENSITES = ['normal', 'compact'];
export const STYLE_ACCENTS = ['none', 'brand', 'warning', 'danger', 'info'];

export const STYLE_DEFAUT = Object.freeze({
  alignement: 'auto',
  densite: 'normal',
  accent: 'none',
});

function choix(valeur, autorisees, repli) {
  return autorisees.includes(valeur) ? valeur : repli;
}

/** Normalise `options.style` ; préserve les propriétés de couleur/texte V17. */
export function normaliserStyle(options) {
  const style = options && typeof options === 'object' && options.style && typeof options.style === 'object'
    ? options.style
    : {};
  const base = {
    alignement: choix(style.alignement, STYLE_ALIGNEMENTS, STYLE_DEFAUT.alignement),
    densite: choix(style.densite, STYLE_DENSITES, STYLE_DEFAUT.densite),
    accent: choix(style.accent, STYLE_ACCENTS, STYLE_DEFAUT.accent),
  };
  for (const [k, v] of Object.entries(style)) {
    if (!(k in base) && v !== undefined) base[k] = v;
  }
  return base;
}

const STYLE_CONTRAINTES = [
  ['alignement', STYLE_ALIGNEMENTS, 'Alignement de bloc inconnu'],
  ['densite', STYLE_DENSITES, 'Densité de bloc inconnue'],
  ['accent', STYLE_ACCENTS, 'Accent de bloc inconnu'],
];

/** Refuse un style inconnu : une faute de frappe ne doit pas passer en base. */
export function validerStyleBloc(bloc) {
  const style = bloc?.options?.style;
  if (style === undefined || style === null) return;
  if (typeof style !== 'object' || Array.isArray(style)) throw new Error('Style de bloc invalide');
  for (const [cle, autorisees, message] of STYLE_CONTRAINTES) {
    const valeur = style[cle];
    if (valeur !== undefined && !autorisees.includes(valeur)) throw new Error(`${message} : ${valeur}`);
  }
}

/** `text-align` logique : `start`/`end` suivent le sens de lecture (RTL inclus). */
export function classeAlignementStyle(alignement) {
  if (alignement === 'start') return 'text-start';
  if (alignement === 'center') return 'text-center';
  if (alignement === 'end') return 'text-end';
  return '';
}

/** Bordure d'accent en `inline-start`, visible à l'écran comme à l'impression. */
export function classeAccentStyle(accent) {
  if (accent === 'brand') return 'border-brand-500 border-s-4';
  if (accent === 'warning') return 'border-warning border-s-4';
  if (accent === 'danger') return 'border-danger border-s-4';
  if (accent === 'info') return 'border-info border-s-4';
  return '';
}

export function classeDensiteStyle(densite) {
  return densite === 'compact' ? 'p-2' : 'p-4';
}