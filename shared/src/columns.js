import { CATALOGUE } from './catalogue.js';

export const COLONNE_PRIORITES = ['P1', 'P2', 'P3'];
export const COLONNES_SENSIBLES = ['agent', 'saisi_par'];

export function colonneId(source, champ) {
  return `${source === 'dimension' ? 'd' : 'm'}:${champ}`;
}

export function colonneMeta(source, champ) {
  if (source === 'dimension') return CATALOGUE.dimensions[champ] || null;
  if (source === 'mesure') return CATALOGUE.mesures[champ] || null;
  return null;
}

function defaultFormat(source, meta) {
  if (source === 'mesure') return meta?.format || 'entier';
  return 'entier';
}

export function creerColonne(source, champ, overrides = {}) {
  const meta = colonneMeta(source, champ);
  if (!meta) throw new Error(`Colonne inconnue : ${source}.${champ}`);
  const isMeasure = source === 'mesure';
  const clean = Object.fromEntries(Object.entries(overrides).filter(([, value]) => value !== undefined));
  return {
    id: colonneId(source, champ),
    source,
    champ,
    label_fr: meta.label_fr || champ,
    label_ar: meta.label_ar || champ,
    format: defaultFormat(source, meta),
    align: isMeasure ? 'right' : 'left',
    priorite: 'P1',
    visible_ecran: true,
    visible_impression: true,
    tri: null,
    total: isMeasure && Boolean(meta.additive),
    ...clean,
  };
}

export function normaliserColonne(input) {
  if (!input || typeof input !== 'object') throw new Error('Colonne invalide');
  const source = input.source;
  const champ = input.champ;
  if (source !== 'dimension' && source !== 'mesure') throw new Error(`Source de colonne invalide : ${source}`);
  const meta = colonneMeta(source, champ);
  if (!meta) throw new Error(`Colonne inconnue : ${source}.${champ}`);
  return creerColonne(source, champ, {
    id: input.id,
    label_fr: input.label_fr,
    label_ar: input.label_ar,
    format: input.format,
    align: input.align,
    priorite: input.priorite,
    visible_ecran: input.visible_ecran !== false,
    visible_impression: input.visible_impression !== false,
    tri: input.tri,
    total: input.total,
  });
}

export function colonnesAutorisees(role) {
  if (role === 'lecteur') return (champ) => !COLONNES_SENSIBLES.includes(champ);
  return () => true;
}

function filtrerSensibles(colonnes, role) {
  const allowed = colonnesAutorisees(role);
  return colonnes.filter((column) => allowed(column.champ));
}

export function colonnesDisponibles(bloc, { role = 'operateur' } = {}) {
  const requete = bloc?.requete || {};
  const dimensions = (requete.dimensions || []).map((d) => creerColonne('dimension', d.champ, {
    id: colonneId('dimension', d.champ),
    format: 'entier',
    align: 'left',
  }));
  const mesures = (requete.mesures || []).map((m) => creerColonne('mesure', m.id, {
    id: colonneId('mesure', m.id),
    format: CATALOGUE.mesures[m.id]?.format || 'entier',
    align: 'right',
  }));
  return filtrerSensibles([...dimensions, ...mesures], role);
}

export function colonnesDuBloc(bloc, { role = 'operateur' } = {}) {
  const configured = bloc?.options?.colonnes;
  if (!Array.isArray(configured) || configured.length === 0) return colonnesDisponibles(bloc, { role });
  const normalized = configured.map((item) => normaliserColonne(item));
  return filtrerSensibles(normalized, role);
}

export function ajusterColonnesImpression(colonnes, { maxColonnes = 8 } = {}) {
  if (colonnes.length <= maxColonnes) return colonnes;
  const p1p2 = colonnes.filter((column) => column.priorite === 'P1' || column.priorite === 'P2');
  if (p1p2.length <= maxColonnes) return p1p2;
  return colonnes.filter((column) => column.priorite === 'P1');
}

export function colonnesAffichees(bloc, resultat, { role = 'operateur', impression = false } = {}) {
  let colonnes = colonnesDuBloc(bloc, { role });
  if (impression) {
    colonnes = colonnes.filter((column) => column.visible_impression !== false);
    colonnes = ajusterColonnesImpression(colonnes);
  } else {
    colonnes = colonnes.filter((column) => column.visible_ecran !== false);
  }
  if (resultat?.colonnes) {
    const available = new Set([
      ...(resultat.colonnes.dimensions || []).map((d) => colonneId('dimension', d.champ)),
      ...(resultat.colonnes.mesures || []).map((m) => colonneId('mesure', m.id)),
    ]);
    colonnes = colonnes.filter((column) => available.has(column.id));
  }
  return colonnes;
}

export const COLONNES_PRESETS = {
  standard: { priorities: ['P1'], impression: false },
  complet: { priorities: ['P1', 'P2', 'P3'], impression: false },
  compact: { priorities: ['P1', 'P2'], impression: false },
  impression: { priorities: ['P1'], impression: true },
};

export function appliquerPresetColonnes(colonnes, preset) {
  if (!preset) return colonnes;
  return colonnes.filter((column) => preset.priorities.includes(column.priorite));
}

export function validerColonnesBloc(bloc, { role = 'operateur' } = {}) {
  const configured = bloc?.options?.colonnes;
  if (!configured) return;
  if (!Array.isArray(configured)) throw new Error('Les colonnes doivent être une liste');
  const ids = new Set();
  for (const item of configured) {
    const column = normaliserColonne(item);
    if (ids.has(column.id)) throw new Error(`Colonne présente deux fois : ${column.id}`);
    ids.add(column.id);
    if (!COLONNE_PRIORITES.includes(column.priorite)) throw new Error(`Priorité inconnue : ${column.priorite}`);
    if (typeof column.visible_ecran !== 'boolean' || typeof column.visible_impression !== 'boolean') {
      throw new Error(`Visibilité invalide pour la colonne ${column.id}`);
    }
    if (role === 'lecteur' && COLONNES_SENSIBLES.includes(column.champ)) {
      throw new Error(`Colonne sensible interdite pour le rôle lecteur : ${column.champ}`);
    }
  }
}