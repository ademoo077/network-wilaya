import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formReducer, formatGps, initialFormState, validateForm } from '@anm/shared';
import { api, queryString } from '../../api/client.js';
import { useRefs } from '../../context/RefsContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../components/ui/index.js';
import { useI18n } from '../../i18n/index.jsx';
import { clearDraft, readDraft } from '../../utils/drafts.js';
import { readRecentTypes } from '../../utils/recentTypes.js';
import { formFromItem } from './helpers.js';
import { useFormTasks } from './useFormTasks.js';
import { useFormPaste } from './useFormPaste.js';
import { useFormSubmit } from './useFormSubmit.js';
import { useFormDraft } from './useFormDraft.js';
import { useFormFiles } from './useFormFiles.js';

const VEILLE_ID_FIELDS = ['domaine_id', 'type_id', 'daira_id', 'commune_id'];
function valuesFromVeille(item) {
  const values = {
    plateforme: item.plateforme || 'autre', lien_url: item.lien_url || '', contenu_type: item.contenu_type || null,
    date_publication: String(item.date_publication || '').slice(0, 10), adresse_texte: item.adresse_texte || '',
    lieu_dit: item.lieu_dit || '', gps: item.gps || null, priorite: item.priorite || 'normale',
    legende: item.legende || '', observations: item.observations || '', veille_element_id: item.veille_element_id || null,
    gps_text: item.gps?.lat !== undefined ? formatGps(item.gps.lat, item.gps.lng) : '',
  };
  for (const key of VEILLE_ID_FIELDS) values[key] = item[key] ? String(item[key]) : '';
  return values;
}

export function useAnomalieForm(id) {
  const { refs, setup } = useRefs(); const { user } = useAuth(); const { t, lang } = useI18n(); const { push } = useToast();
  const location = useLocation();
  const requestedVeille = !id ? new URLSearchParams(location.search).get('veille') : null;
  const veilleId = /^[1-9]\d*$/.test(requestedVeille || '') ? requestedVeille : null;
  const draftKey = `anm-draft:${user.id}:${id || (veilleId ? `veille-${veilleId}` : 'new')}`;
  const [state, dispatch] = useReducer(formReducer, null, () => ({ ...initialFormState(), draft: readDraft(draftKey), recentTypes: readRecentTypes(user.id) }));
  const current = useRef(state); current.current = state;
  const tasks = useFormTasks(dispatch); const lastToast = useRef(null); const initialized = useRef(null); const scope = useRef(draftKey);
  const query = useQuery({ queryKey: ['anomaly', id], enabled: Boolean(id), queryFn: ({ signal }) => api(`/anomalies/${id}`, { signal }) });
  const prefillQuery = useQuery({ queryKey: ['veille-prefill', veilleId], enabled: Boolean(veilleId), queryFn: ({ signal }) => api(`/veille/prefill/${veilleId}`, { signal }) });
  useEffect(() => {
    if (scope.current !== draftKey) {
      scope.current = draftKey; initialized.current = null; tasks.cancelAll();
      dispatch({ type: 'INIT', context: { draft: readDraft(draftKey), recentTypes: readRecentTypes(user.id) } });
    }
    if (id && query.data?.item && initialized.current !== id) {
      initialized.current = id;
      dispatch({ type: 'INIT', values: formFromItem(query.data.item), editing: true, version: query.data.item.version,
        context: { draft: readDraft(draftKey), piecesCount: query.data.item.pieces_count || 0 } });
    }
    if (veilleId && prefillQuery.data?.item && initialized.current !== `veille-${veilleId}`) {
      initialized.current = `veille-${veilleId}`;
      dispatch({ type: 'INIT', values: valuesFromVeille(prefillQuery.data.item), editing: false,
        context: { draft: readDraft(draftKey) } });
    }
  }, [draftKey, id, query.data, prefillQuery.data, tasks, user.id, veilleId]);
  const undo = useCallback((id) => { tasks.cancelAll(); dispatch({ type: 'UNDO', id }); }, [tasks]);
  useEffect(() => {
    const entry = state.undo.at(-1);
    if (entry && entry.id !== lastToast.current) { lastToast.current = entry.id; push(t('smart.applied'), 'success', { label: t('smart.undo'), onClick: () => undo(entry.id) }); }
  }, [state.undo, push, t, undo]);
  const autofill = useCallback((items, id = `auto-${Date.now()}`, normalize = []) => dispatch({ type: 'AUTOFILL', items, id, normalize }), []);
  const paste = useFormPaste({ dispatch, current, tasks, autofill, bbox: refs.parametres.gps_bbox, mode: refs.parametres.resolution_liens, domains: refs.domaines });
  const analyzePaste = paste.analyze;
  const set = useCallback((field, value, source) => dispatch({ type: 'EDIT', field, value, source }), []);
  const ui = useCallback((patch) => dispatch({ type: 'UI', patch }), []);
  const blur = useCallback((field) => {
    const value = current.current;
    const touched = { ...value.touched, [field]: true };
    const all = validateForm(value.values, value.original);
    dispatch({ type: 'VALIDATE', errors: Object.fromEntries(Object.entries(all).filter(([key]) => touched[key])), touched });
  }, []);
  useEffect(() => {
    if (!Object.keys(current.current.touched).length) return;
    const value = current.current; const all = validateForm(value.values, value.original);
    dispatch({ type: 'VALIDATE', errors: Object.fromEntries(Object.entries(all).filter(([key]) => value.touched[key])) });
  }, [state.values]);
  useFormDraft({ state, current, dispatch, draftKey });
  const resume = () => {
    const draft = state.draft;
    ui({ values: { ...state.values, ...draft.values }, meta: { ...state.meta, ...draft.meta }, paste: draft.paste || '',
      original: draft.original || state.original, version: draft.version || state.version, persisted: draft.persisted,
      duplicateFrom: draft.duplicateFrom, forceDuplicate: Boolean(draft.forceDuplicate), draft: null, dirty: true,
      fileFeedback: (draft.fileNames || []).map((name) => ({ name, code: 'attachments.reattach' })) });
  };
  const restart = () => { clearDraft(draftKey); ui({ draft: null }); };
  const gps = state.values.gps; const link = state.values.lien_url;
  useEffect(() => {
    if (!gps) { dispatch({ type: 'TASK_RESET', task: 'locate' }); return undefined; }
    const timer = window.setTimeout(() => tasks.run('locate', (request) => request('/geo/locate', { method: 'POST', body: gps }), ({ item }) => {
      if (item?.commune_id) autofill([
        { champ: 'daira_id', valeur: String(item.daira_id), source: item.methode, confiance: item.confiance, suggestion: item.confiance !== 'haute' },
        { champ: 'commune_id', valeur: String(item.commune_id), source: item.methode, confiance: item.confiance, suggestion: item.confiance !== 'haute' },
      ], current.current.group || `locate-${Date.now()}`);
    }), 300);
    return () => { window.clearTimeout(timer); tasks.cancel('locate'); };
  }, [gps, autofill, tasks]);
  useEffect(() => {
    if (!link) { dispatch({ type: 'TASK_RESET', task: 'duplicates' }); return undefined; }
    const timer = window.setTimeout(() => tasks.run('duplicates', (request) => request(`/anomalies/check-link${queryString({ url: link })}`)), 350);
    return () => { window.clearTimeout(timer); tasks.cancel('duplicates'); };
  }, [link, tasks]);
  const { domaine_id: domain, type_id: type, commune_id: commune } = state.values;
  useEffect(() => {
    if (!gps || (!domain && !type)) { dispatch({ type: 'TASK_RESET', task: 'nearby' }); return undefined; }
    const timer = window.setTimeout(() => tasks.run('nearby', (request) => request(`/anomalies/nearby${queryString({ ...gps, radius: 150, type: type || undefined, domaine: type ? undefined : domain, exclude: id })}`)), 350);
    return () => { window.clearTimeout(timer); tasks.cancel('nearby'); };
  }, [gps, domain, type, tasks, id]);
  const geometry = useQuery({ queryKey: ['limit', commune], enabled: Boolean(commune), queryFn: ({ signal }) => api(`/geo/limit/${commune}`, { signal }) });
  const handleFiles = useFormFiles({ current, dispatch, tasks, autofill });
  const chooseType = useCallback((typeId, source = 'manuel') => {
    const domain = refs.domaines.find((row) => row.types.some((type) => String(type.id) === String(typeId)));
    if (domain) dispatch({ type: 'CHOOSE_TYPE', type_id: typeId, domaine_id: domain.id, source, id: `type-${Date.now()}` });
    else set('type_id', '');
  }, [refs.domaines, set]);
  useEffect(() => {
    const handler = (event) => {
      if (event.defaultPrevented) return;
      const target = event.target; const editable = target?.closest?.('input,textarea,select,[contenteditable="true"]');
      if (editable && !['smart-paste', 'lien_url', 'gps_text'].includes(editable.id)) return;
      const files = [...(event.clipboardData?.files || [])];
      if (files.length) { event.preventDefault(); handleFiles(files); return; }
      const text = event.clipboardData?.getData('text/plain');
      if (text) { event.preventDefault(); analyzePaste(text, editable?.id || 'page'); }
    };
    document.addEventListener('paste', handler); return () => document.removeEventListener('paste', handler);
  }, [handleFiles, analyzePaste]);
  const locateDevice = () => tasks.run('device', () => new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(({ coords }) => resolve({ lat: Number(coords.latitude.toFixed(6)), lng: Number(coords.longitude.toFixed(6)), precision_m: Math.round(coords.accuracy) }), reject, { timeout: 5000, enableHighAccuracy: true });
  }), (point) => set('gps', point, 'appareil'));
  const save = useFormSubmit({ current, dispatch, draftKey, id, userId: user.id });
  const saveRef = useRef(save); saveRef.current = save;
  useEffect(() => {
    const handler = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !event.repeat && !current.current.duplicateDialog) {
        event.preventDefault(); saveRef.current(event.shiftKey ? 'new' : 'save');
      }
    };
    document.addEventListener('keydown', handler); return () => document.removeEventListener('keydown', handler);
  }, []);
  const reload = async () => {
    const result = await query.refetch();
    if (result.data?.item) { clearDraft(draftKey); dispatch({ type: 'INIT', values: formFromItem(result.data.item), editing: true, version: result.data.item.version, context: { piecesCount: result.data.item.pieces_count } }); }
  };
  const errors = useMemo(() => Object.fromEntries(Object.entries(state.errors).map(([key, value]) => [key, t(value)])), [state.errors, t]);
  const matches = (state.tasks.duplicates.data?.item?.matches || []).filter((m) => String(m.id) !== String(id));
  return { state, set, ui, blur, autofill, paste, save, undo, resume, restart, handleFiles, chooseType, locateDevice, errors, refs, setup, user, lang,
    matches, nearby: state.tasks.nearby.data?.items || [], geometry: geometry.data?.item,
    loading: Boolean((id && query.isPending) || (veilleId && !id && prefillQuery.isPending)),
    loadError: query.error || prefillQuery.error, missing: Boolean((id && query.isSuccess && !query.data?.item) || (veilleId && prefillQuery.isSuccess && !prefillQuery.data?.item)), reload };
}
