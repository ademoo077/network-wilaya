import { useCallback, useEffect, useMemo, useState } from 'react';

export const STANDARD_COLUMNS = ['reference', 'date_signalement', 'statut', 'photos', 'categorie', 'commune', 'agent', 'epic', 'priorite', 'source', 'actions'];
export const COMPLET_COLUMNS = ['reference', 'date_signalement', 'plateforme', 'statut', 'photos', 'domaine', 'type', 'daira', 'commune', 'agent', 'epic', 'priorite', 'source', 'link', 'gps', 'actions'];
export const COLUMN_KEYS = [...new Set([...STANDARD_COLUMNS, ...COMPLET_COLUMNS])];
export const COLUMN_LABELS = {
  reference: 'field.reference', date_signalement: 'field.date', statut: 'field.status', photos: 'photo.colonne',
  categorie: 'list.categoryType', commune: 'list.location', agent: 'field.agent', epic: 'field.epic',
  priorite: 'field.priority', source: 'field.source', actions: 'common.actions', plateforme: 'field.platform',
  domaine: 'field.category', type: 'field.type', daira: 'field.daira', link: 'field.link', gps: 'field.gps',
};

const storageKey = (name, userId) => `anm-${name}-${userId || 'anonymous'}`;
const readJson = (name, userId, fallback) => {
  try {
    const raw = localStorage.getItem(storageKey(name, userId));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((key) => COLUMN_KEYS.includes(key));
    if (parsed && typeof parsed === 'object') return parsed;
    return fallback;
  } catch { return fallback; }
};
const writeJson = (name, userId, value) => {
  try { localStorage.setItem(storageKey(name, userId), JSON.stringify(value)); } catch { /* stockage indisponible */ }
};
const readText = (name, userId, fallback) => {
  try { return localStorage.getItem(storageKey(name, userId)) || fallback; } catch { return fallback; }
};
const writeText = (name, userId, value) => {
  try { localStorage.setItem(storageKey(name, userId), value); } catch { /* stockage indisponible */ }
};

const MODES = ['standard', 'complet', 'galerie'];
const LARGEURS_MIN = { reference: 104, date_signalement: 88, statut: 120, photos: 120, actions: 104 };
/* Largeurs initiales : sans elles, table-fixed répartit également l'espace
   (≈95 px/colonne) et le contenu déborde de chaque cellule. */
export const DEFAULT_WIDTHS = {
  reference: 132, date_signalement: 92, statut: 132, photos: 136, categorie: 132,
  commune: 112, agent: 88, epic: 88, priorite: 80, source: 80, actions: 104,
  plateforme: 96, domaine: 120, type: 120, daira: 112, link: 88, gps: 88,
};

export default function useListPreferences(userId) {
  const [mode, setMode] = useState(() => {
    const saved = readText('list-mode', userId, 'standard');
    return MODES.includes(saved) ? saved : 'standard';
  });
  const [density, setDensity] = useState(() => readText('list-density', userId, 'comfortable') === 'compact' ? 'compact' : 'comfortable');
  const [choices, setChoices] = useState(() => {
    const base = { standard: STANDARD_COLUMNS, complet: COMPLET_COLUMNS };
    const saved = readJson('list-columns', userId, base);
    return { standard: Array.isArray(saved.standard) ? saved.standard : STANDARD_COLUMNS,
      complet: Array.isArray(saved.complet) ? saved.complet : COMPLET_COLUMNS };
  });
  useEffect(() => { writeText('list-mode', userId, mode); }, [mode, userId]);
  useEffect(() => { writeText('list-density', userId, density); }, [density, userId]);
  useEffect(() => { writeJson('list-columns', userId, choices); }, [choices, userId]);
  const defaults = mode === 'complet' ? COMPLET_COLUMNS : STANDARD_COLUMNS;
  const columns = useMemo(() => defaults.filter((key) => (choices[mode] || defaults).includes(key)), [choices, defaults, mode]);
  const toggleColumn = useCallback((key) => setChoices((current) => {
    const list = current[mode] || defaults;
    return { ...current, [mode]: list.includes(key) ? list.filter((item) => item !== key) : [...list, key] };
  }), [defaults, mode]);
  const resetColumns = useCallback(() => setChoices((current) => ({ ...current, [mode]: defaults })), [defaults, mode]);
  const [widths, setWidths] = useState(() => {
    const saved = readJson('list-widths', userId, DEFAULT_WIDTHS);
    const values = Object.fromEntries(COLUMN_KEYS.filter((key) => Number(saved[key]) > 40)
      .map((key) => [key, Math.min(480, Number(saved[key]))]));
    // Une préférence vide enregistrée avant l'ajout des largeurs par défaut
    // doit retomber sur les largeurs saines (sinon table-fixed répartit également).
    return Object.keys(values).length ? values : { ...DEFAULT_WIDTHS };
  });
  useEffect(() => { writeJson('list-widths', userId, widths); }, [widths, userId]);
  const setWidth = useCallback((key, value) => setWidths((current) => ({
    ...current, [key]: Math.max(LARGEURS_MIN[key] || 64, Math.min(480, Math.round(value))),
  })), []);
  const resetWidths = useCallback(() => setWidths(DEFAULT_WIDTHS), []);
  return { mode, setMode, density, setDensity, columns, toggleColumn, resetColumns,
    widths, setWidth, resetWidths, available: COLUMN_KEYS };
}
