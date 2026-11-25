/**
 * Registre V17 des propriétés éditables des widgets.
 * Source unique : inspecteur généré, rendu, impression, export.
 * Les couleurs choisies sont des données (pas de hex en dur dans le code).
 */

export const PALETTES = {
  institutionnel: ['#1d4ed8', '#2563eb', '#60a5fa', '#93c5fd', '#1e3a8a', '#0f766e', '#475569', '#334155'],
  ocean: ['#0ea5e9', '#0284c7', '#0369a1', '#14b8a6', '#0f766e', '#164e63', '#22d3ee', '#67e8f9'],
  chaud: ['#dc2626', '#ea580c', '#d97706', '#ca8a04', '#b91c1c', '#9a3412', '#f59e0b', '#f97316'],
  pastel: ['#93c5fd', '#86efac', '#fcd34d', '#fca5a5', '#c4b5fd', '#f9a8d4', '#99f6e4', '#fdba74'],
  contraste: ['#000000', '#ffffff', '#1d4ed8', '#b91c1c', '#15803d', '#a16207', '#7e22ce', '#0f766e'],
  daltonisme: ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#56B4E9', '#D55E00', '#F0E442', '#000000'],
};

/** V19 — charte du Cabinet du Wali : 5 couleurs maximum par graphique. */
export const CHARTE_V19 = Object.freeze({
  palette: Object.freeze(PALETTES.institutionnel.slice(0, 5)),
  polices: Object.freeze(['Inter', 'Cairo']),
  motifReference: 'N° {SEQ}/CW/{AAAA}',
  diffusion: Object.freeze(['Confidentiel', 'Diffusion restreinte', 'Interne']),
});

export const TAILWIND_COULEURS = {
  'blue-600': '#2563eb', 'blue-700': '#1d4ed8', 'emerald-600': '#059669', 'red-600': '#dc2626',
  'amber-500': '#f59e0b', 'slate-700': '#334155', 'slate-900': '#0f172a', 'white': '#ffffff', 'black': '#000000',
};

const TEXT_PROPS = [
  { id: 'titre', label: 'Titre', type: 'text', scope: 'bloc', path: 'titre', defaut: '' },
  { id: 'sousTitre', label: 'Sous-titre', type: 'text', scope: 'bloc', path: 'options.sousTitre', defaut: '' },
  { id: 'note', label: 'Note', type: 'text', scope: 'bloc', path: 'options.note', defaut: '' },
];

const COLOR_PROPS = [
  { id: 'fond', label: 'Fond', type: 'color', scope: 'style', path: 'options.style.fond', defaut: '' },
  { id: 'bordure', label: 'Bordure', type: 'color', scope: 'style', path: 'options.style.bordure', defaut: '' },
  { id: 'titreCouleur', label: 'Couleur du titre', type: 'color', scope: 'style', path: 'options.style.titreCouleur', defaut: '' },
  { id: 'texteCouleur', label: 'Couleur du texte', type: 'color', scope: 'style', path: 'options.style.texteCouleur', defaut: '' },
  { id: 'accentCouleur', label: 'Couleur d’accent', type: 'color', scope: 'style', path: 'options.style.accentCouleur', defaut: '' },
  { id: 'seriesCouleurs', label: 'Couleurs des séries', type: 'color[]', scope: 'style', path: 'options.style.seriesCouleurs', defaut: [] },
];

const TYPE_PROPS = {
  kpi: [
    { id: 'etiquetteCouleur', label: 'Couleur étiquette', type: 'color', scope: 'style', path: 'options.style.etiquetteCouleur', defaut: '' },
    { id: 'valeurCouleur', label: 'Couleur valeur', type: 'color', scope: 'style', path: 'options.style.valeurCouleur', defaut: '' },
  ],
  tableau: [
    { id: 'enteteFond', label: 'Fond en-tête', type: 'color', scope: 'style', path: 'options.style.enteteFond', defaut: '' },
    { id: 'zebreCouleur', label: 'Lignes zébrées', type: 'color', scope: 'style', path: 'options.style.zebreCouleur', defaut: '' },
  ],
  texte: [
    { id: 'texte', label: 'Texte', type: 'text', scope: 'bloc', path: 'options.texte_fr', defaut: '' },
  ],
};

export function proprietesPourBloc(bloc) {
  const type = bloc?.type || 'kpi';
  const extra = TYPE_PROPS[type] || [];
  const base = [...TEXT_PROPS, ...COLOR_PROPS, ...extra];
  // Deduplicate by id
  const seen = new Set();
  return base.filter((p) => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });
}

export function getByPath(obj, path) {
  return String(path || '').split('.').reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : undefined), obj);
}

export function setByPath(obj, path, value) {
  const keys = String(path || '').split('.').filter(Boolean);
  if (!keys.length) return obj;
  const root = { ...(obj || {}) };
  let cur = root;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    cur[k] = (cur[k] && typeof cur[k] === 'object' && !Array.isArray(cur[k])) ? { ...cur[k] } : {};
    cur = cur[k];
  }
  cur[keys[keys.length - 1]] = value;
  return root;
}

export function normaliserCouleur(valeur) {
  if (valeur == null) return '';
  const v = String(valeur).trim();
  if (!v) return '';
  if (TAILWIND_COULEURS[v]) return TAILWIND_COULEURS[v];
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v)) return v;
  if (/^rgba?\(/i.test(v) || /^hsla?\(/i.test(v) || /^var\(--/.test(v)) return v;
  return '';
}

export function contrasteRatio(hex1, hex2) {
  const parse = (h) => {
    const m = String(h || '').replace('#', '');
    if (!/^[0-9a-f]{3,8}$/i.test(m)) return null;
    const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m.slice(0, 6);
    const n = parseInt(full, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  };
  const l = (rgb) => 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  const a = parse(hex1), b = parse(hex2);
  if (!a || !b) return null;
  const l1 = l(a), l2 = l(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

export function texteEditableProps(bloc) {
  const props = proprietesPourBloc(bloc).filter((p) => p.type === 'text');
  return props.map((p) => ({ ...p, valeur: getByPath(bloc, p.path) ?? p.defaut }));
}

export function couleurProps(bloc) {
  const props = proprietesPourBloc(bloc).filter((p) => p.type === 'color' || p.type === 'color[]');
  return props.map((p) => ({ ...p, valeur: getByPath(bloc, p.path) ?? p.defaut }));
}
