import { useCallback, useEffect, useRef } from 'react';
import { formatGps, parseSmartPaste, pasteAutofill, suggestAnomalyTypes } from '@anm/shared';

export function useFormPaste({ dispatch, current, autofill, tasks, bbox, mode, domains }) {
  const serial = useRef(0); const timer = useRef(null);
  const resolve = useCallback((url, group, parsed) => tasks.run('resolve', (request) => request('/tools/resolve-link', { method: 'POST', body: { url } }), (response) => {
    if (!response.ok) {
      if (response.lieu) autofill([{ champ: 'adresse_texte', valeur: response.lieu, suggestion: true, source: 'lien_court' }], group);
      return;
    }
    const remote = parseSmartPaste(response.urlFinale || url, { bbox });
    const result = { ...parsed, urls: [...parsed.urls.filter((item) => item.normalise !== url), ...remote.urls],
      dates: [...parsed.dates, ...remote.dates], coords: response.coords ? [response.coords] : [] };
    dispatch({ type: 'UI', patch: { result } });
    autofill([...pasteAutofill(result, false), ...(response.lieu ? [{ champ: 'adresse_texte', valeur: response.lieu, suggestion: true, source: 'lien_court' }] : [])], group);
  }), [autofill, bbox, dispatch, tasks]);
  const analyze = useCallback((text, entry = 'smart-paste', typed = false) => {
    window.clearTimeout(timer.current); tasks.cancel('resolve');
    dispatch({ type: 'TASK_RESET', task: 'resolve' });
    const group = `paste-${++serial.current}`; const result = parseSmartPaste(text, { bbox });
    const link = result.urls.find((url) => url.type === 'social' || url.type === 'autre');
    const short = result.urls.find((url) => url.a_resoudre && (url.type === 'carte' || mode === 'tous'));
    const feedback = { ...current.current.feedback, pending: false,
      general: text.trim() && !link && !result.coords.length && !short ? result.urls.some((url) => url.type === 'carte') ? 'paste.mapNoPosition' : 'paste.noElements' : null,
      lien: link ? (link.plateforme && link.plateforme !== 'autre' ? 'lien.ok' : 'lien.plateformeInconnue') : entry === 'lien_url' && text && !result.coords.length && !short ? 'lien.invalide' : null,
      gps: result.coords.length ? result.coords.length > 1 ? 'smart.choosePosition' : 'gps.ok' : link?.type === 'social' ? 'smart.noPosition' : text && entry === 'gps_text' ? 'gps.invalide' : null,
      corrected: link && !/^https?:\/\//i.test(link.brut), redirected: entry === 'gps_text' && link ? 'paste.toLink' : entry === 'lien_url' && result.urls.some((u) => u.type === 'carte') ? 'paste.toGps' : null };
    const typeSuggestions = suggestAnomalyTypes(result.texteRestant, domains, { domaineId: current.current.values.domaine_id });
    dispatch({ type: 'UI', patch: { paste: text, result, feedback, group, typeSuggestions, typeChoice: null } });
    dispatch({ type: 'TASK_START', task: 'parse', id: serial.current });
    dispatch({ type: 'TASK_END', task: 'parse', id: serial.current, result: { status: 'ok', data: result } });
    autofill(pasteAutofill(result, current.current.includeText), group, typed ? [entry === 'gps_text' ? 'gps' : 'lien_url'] : []);
    if (!result.coords.length && short) resolve(short.normalise, group, result);
    return result;
  }, [autofill, bbox, current, dispatch, mode, resolve, tasks, domains]);
  const input = useCallback((text, entry) => {
    tasks.cancel('resolve'); window.clearTimeout(timer.current);
    dispatch({ type: 'UI', patch: { feedback: { ...current.current.feedback, pending: true } } });
    if (entry === 'smart-paste') dispatch({ type: 'UI', patch: { paste: text } });
    else dispatch({ type: 'EDIT', field: entry, value: text });
    if (entry === 'gps_text' && !text) { dispatch({ type: 'EDIT', field: 'gps', value: null }); dispatch({ type: 'UI', patch: { feedback: {} } }); return; }
    timer.current = window.setTimeout(() => analyze(text, entry, entry !== 'smart-paste'), entry === 'gps_text' ? 400 : 300);
  }, [analyze, current, dispatch, tasks]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const clear = () => { window.clearTimeout(timer.current); tasks.cancel('resolve'); dispatch({ type: 'UI', patch: { paste: '', result: null, feedback: {}, typeSuggestions: [], typeChoice: null } }); };
  const selectPoint = (point) => { dispatch({ type: 'EDIT', field: 'gps', value: point, source: point.source }); dispatch({ type: 'UI', patch: { feedback: { ...current.current.feedback, gps: 'gps.ok' } } }); };
  const removePoint = () => { dispatch({ type: 'EDIT', field: 'gps', value: null }); dispatch({ type: 'UI', patch: { result: { ...current.current.result, coords: [] }, feedback: {} } }); };
  const retry = () => { const value = current.current; const url = value.result?.urls?.find((u) => u.a_resoudre)?.normalise; if (url) resolve(url, value.group, value.result); };
  return { analyze, input, clear, selectPoint, removePoint, retry, formatGps };
}
