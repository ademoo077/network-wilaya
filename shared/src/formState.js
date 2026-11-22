import { todayAlgiers } from './dates.js';
import { formatGps } from './gps.js';
import { gpsStorageSource } from './smartPasteCoords.js';
import { selectFormFiles } from './formFiles.js';

export function emptyFormValues() {
  return { lien_url: '', plateforme: 'autre', contenu_type: null, date_publication: '', date_signalement: todayAlgiers(),
    domaine_id: '', type_id: '', daira_id: '', commune_id: '', adresse_texte: '', lieu_dit: '', gps: null, gps_text: '',
    gps_source: null, gps_precision_m: null, gps_verifiee: 0, priorite: 'normale', observations: '', verification: 'a_verifier',
    agent_id: '', agent_source: '', agent_motif: '', date_verification: '', statut: 'non_traite', epic_id: '', intervenant_autre: '', date_intervention: '',
    date_traitement: '', motif: '', sans_photo_motif: '', lie_a_id: null, source_reseau_id: '', date_publication_estimee: 0, legende: '', auteur_publication: '' };
}
export function initialFormState(values = {}, editing = false) {
  const merged = { ...emptyFormValues(), ...values };
  return { values: merged, original: editing ? merged : null, version: null,
    meta: Object.fromEntries(Object.keys(merged).map((key) => [key, { origin: editing ? 'manuel' : 'defaut' }])),
    tasks: Object.fromEntries(['parse', 'resolve', 'locate', 'duplicates', 'nearby', 'exif', 'submit'].map((key) => [key, { status: 'idle', id: 0 }])),
    suggestions: [], undo: [], errors: {}, touched: {}, dirty: false, files: [],
    paste: '', includeText: true, result: null, feedback: {}, group: null, draft: null, duplicateDialog: false,
    forceDuplicate: false, dismissedGeo: null, geometry: null, typeSuggestions: [], typeChoice: null,
    recentTypes: [], fileFeedback: [], draftStatus: 'idle' };
}
const same = (a, b) => JSON.stringify(a ?? '') === JSON.stringify(b ?? '');
function assignments(field, value, source, extra = {}) {
  if (field === 'gps') return { gps: value ? { lat: value.lat, lng: value.lng } : null,
    gps_text: value ? formatGps(value.lat, value.lng) : '', gps_source: value ? gpsStorageSource(source || value.source || 'manuel') : null,
    gps_precision_m: value?.precision_m ?? null, gps_verifiee: 0 };
  if (field === 'date_publication') return { date_publication: value, date_publication_estimee: extra.estimee ? 1 : 0 };
  return { [field]: value };
}
export function formReducer(state, action) {
  switch (action.type) {
    case 'INIT': return { ...initialFormState(action.values, action.editing), recentTypes: state.recentTypes,
      version: action.version ?? null, ...action.context };
    case 'UI': return { ...state, ...action.patch };
    case 'FILES_ADD': {
      const { files, fileFeedback } = selectFormFiles(state.files, action.files, state.piecesCount || 0);
      return { ...state, files, fileFeedback, dirty: true };
    }
    case 'EDIT': {
      const changes = assignments(action.field, action.value, action.source || 'manuel');
      const meta = { ...state.meta };
      for (const key of Object.keys(changes)) meta[key] = { origin: 'manuel', source: action.source || 'manuel' };
      return { ...state, values: { ...state.values, ...changes }, meta, dirty: true,
        suggestions: state.suggestions.filter((s) => s.champ !== action.field) };
    }
    case 'CHOOSE_TYPE': {
      const changes = { domaine_id: String(action.domaine_id), type_id: String(action.type_id) };
      const keys = Object.keys(changes);
      const entry = { id: action.id, champsModifies: Object.fromEntries(keys.map((key) => [key, state.values[key]])),
        meta: Object.fromEntries(keys.map((key) => [key, state.meta[key]])), etiquette: 'type' };
      return { ...state, values: { ...state.values, ...changes }, dirty: true, typeChoice: action.id,
        suggestions: state.suggestions.filter((item) => !keys.includes(item.champ)),
        meta: { ...state.meta, type_id: { origin: 'manuel', source: action.source }, domaine_id: { origin: 'auto', source: 'type' } },
        undo: action.source === 'suggestion' ? [...state.undo, entry].slice(-20) : state.undo };
    }
    case 'AUTOFILL': {
      const values = { ...state.values }; const meta = { ...state.meta }; const before = {}; const metas = {};
      const suggestions = [...state.suggestions];
      for (const item of action.items) {
        const { champ, valeur, source = 'collage', confiance = 'haute', estimee } = item;
        const comparable = champ === 'gps' && valeur ? { lat: valeur.lat, lng: valeur.lng } : valeur;
        if (valeur === undefined || same(values[champ], comparable)) continue;
        if (item.suggestion || meta[champ]?.origin === 'manuel' && !action.normalize?.includes(champ)
          || item.onlyEmpty && values[champ]) {
          const index = suggestions.findIndex((s) => s.champ === champ);
          if (index >= 0) suggestions.splice(index, 1);
          suggestions.push({ ...item, source, confiance }); continue;
        }
        const changes = assignments(champ, valeur, source, { estimee });
        for (const [key, value] of Object.entries(changes)) {
          before[key] = state.values[key]; metas[key] = state.meta[key]; values[key] = value;
          meta[key] = { origin: action.normalize?.includes(champ) ? 'manuel' : 'auto', source, confiance, estimee: Boolean(estimee) };
        }
      }
      const undo = [...state.undo]; const changed = Object.keys(before).length > 0;
      if (changed) {
        const existing = undo.findIndex((entry) => entry.id === action.id);
        const entry = { id: action.id, champsModifies: before, meta: metas, etiquette: action.label || 'collage' };
        if (existing >= 0) undo[existing] = { ...entry, champsModifies: { ...before, ...undo[existing].champsModifies }, meta: { ...metas, ...undo[existing].meta } };
        else undo.push(entry);
      }
      return { ...state, values, meta, suggestions, undo: undo.slice(-20), dirty: state.dirty || changed, group: action.id };
    }
    case 'UNDO': {
      const entry = state.undo.find((item) => item.id === action.id);
      if (!entry) return state;
      return { ...state, values: { ...state.values, ...entry.champsModifies }, meta: { ...state.meta, ...entry.meta },
        undo: state.undo.filter((item) => item.id !== entry.id), suggestions: [], result: null, feedback: {}, dirty: true, group: null };
    }
    case 'IGNORE': return { ...state, suggestions: state.suggestions.filter((item) => item.champ !== action.field) };
    case 'VALIDATE': return { ...state, errors: action.errors, touched: { ...state.touched, ...action.touched } };
    case 'TASK_START': return { ...state, tasks: { ...state.tasks, [action.task]: { status: 'loading', id: action.id } } };
    case 'TASK_RESET': return { ...state, tasks: { ...state.tasks, [action.task]: { status: 'idle', id: (state.tasks[action.task]?.id || 0) + 1 } } };
    case 'TASK_END':
      if (state.tasks[action.task]?.id !== action.id) return state;
      return { ...state, tasks: { ...state.tasks, [action.task]: { ...state.tasks[action.task], ...action.result } } };
    default: return state;
  }
}
