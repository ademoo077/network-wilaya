import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ajusterHauteursWidgets, convertirEnGrille, deplacerWidget, normaliserLayout,
  redimensionnerWidget,
} from '@anm/shared';
import { api } from '../../api/client.js';
import { useToast } from '../../components/ui/index.js';
import { useI18n } from '../../i18n/index.jsx';
import { blocPositions, cloneDefinition, evaluerSpecs, specsOf } from './editorData.js';
import { personalizeModel, rememberModel, updateModel } from './syntheseActions.js';
export { evaluerSpecs, flattenBlocs, specsOf } from './editorData.js';

const AUTO_SAVE_MS = 800;
const MAX_HISTORY = 60;
export function useSyntheseEditor(modele, onModeleChange, { periode = null } = {}) {
  const { push } = useToast();
  const { t } = useI18n();
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [autosaveBlocked, setAutosaveBlocked] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [results, setResults] = useState({});
  const [evaluating, setEvaluating] = useState(false);
  const [evaluationError, setEvaluationError] = useState(null);
  const [editions, setEditions] = useState([]);
  const [editionsLoading, setEditionsLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [hIndex, setHIndex] = useState(-1);
  const saveTimer = useRef(null);
  const savingRef = useRef(false);
  const evaluationRevision = useRef(0);
  const editRevision = useRef(0);
  const documentRevision = useRef(0);
  const initializedId = useRef(null);
  const modeleRef = useRef(null);
  const periodeRef = useRef(periode);
  periodeRef.current = periode;
  const periodeKey = JSON.stringify(periode);

  const definition = useMemo(() => modele?.definition || { schema_version: 1, sections: [] }, [modele]);
  const currentDefinition = useMemo(() => history[hIndex] || definition, [history, hIndex, definition]);
  const canUndo = hIndex > 0;
  const canRedo = hIndex >= 0 && hIndex < history.length - 1;
  const markDirty = useCallback(() => {
    editRevision.current += 1;
    setDirty(true);
    setSaveError(null);
    setAutosaveBlocked(false);
  }, []);

  const evaluate = useCallback(async (def, { silent = false } = {}) => {
    const revision = ++evaluationRevision.current;
    const specs = specsOf(def);
    setEvaluationError(null);
    if (!specs.length) {
      setResults({});
      setEvaluating(false);
      return {};
    }
    setEvaluating(true);
    try {
      const next = await evaluerSpecs(specs, { periode: periodeRef.current });
      if (revision === evaluationRevision.current) setResults(next);
      return next;
    } catch (error) {
      if (revision === evaluationRevision.current && !silent) setEvaluationError(error);
      return null;
    } finally {
      if (revision === evaluationRevision.current) setEvaluating(false);
    }
  }, []);

  const replaceDefinition = useCallback((nextDefinition) => {
    documentRevision.current += 1;
    const next = cloneDefinition(nextDefinition || { schema_version: 1, sections: [] });
    const layoutFlux = next.layout?.schema_version === 2;
    const before = layoutFlux ? null : JSON.stringify(next.layout || null);
    next.layout = convertirEnGrille(next);
    const normalized = !layoutFlux && before !== JSON.stringify(next.layout);
    setHistory([next]);
    setHIndex(0);
    setDirty(normalized);
    setSaveError(null);
    setAutosaveBlocked(false);
    setLastSavedAt(null);
    setResults({});
    void evaluate(next);
  }, [evaluate]);

  useEffect(() => {
    if (!modele) {
      modeleRef.current = null;
      initializedId.current = null;
      return;
    }
    const current = modeleRef.current;
    if (!current || current.id !== modele.id || Number(modele.version) >= Number(current.version)) {
      modeleRef.current = modele;
    }
    if (initializedId.current === modele.id) return;
    initializedId.current = modele.id;
    setEditions([]);
    replaceDefinition(modele.definition);
  }, [modele, replaceDefinition]);

  useEffect(() => {
    if (initializedId.current && history.length) void evaluate(currentDefinition);
    // La période seule déclenche ce recalcul ; la définition est évaluée par ses actions dédiées.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodeKey, evaluate]);

  useEffect(() => () => {
    evaluationRevision.current += 1;
    documentRevision.current += 1;
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  const pushHistory = useCallback((next) => {
    const updated = history.slice(0, hIndex + 1);
    updated.push(next);
    if (updated.length > MAX_HISTORY) updated.shift();
    setHistory(updated);
    setHIndex(updated.length - 1);
  }, [history, hIndex]);

  const goToHistory = useCallback((nextIndex) => {
    const next = history[nextIndex];
    if (!next) return;
    setHIndex(nextIndex);
    markDirty();
    void evaluate(next, { silent: true });
  }, [history, evaluate, markDirty]);

  const undo = useCallback(() => { if (canUndo) goToHistory(hIndex - 1); }, [canUndo, goToHistory, hIndex]);
  const redo = useCallback(() => { if (canRedo) goToHistory(hIndex + 1); }, [canRedo, goToHistory, hIndex]);

  const save = useCallback(async (def = currentDefinition) => {
    const currentModele = modeleRef.current || modele;
    if (!currentModele || savingRef.current) return null;
    const revision = editRevision.current;
    const scope = documentRevision.current;
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      // Un modèle système n'est jamais modifié : la première écriture crée (ou retrouve)
      // la copie personnelle, puis y enregistre la définition éditée (aucune perte).
      let cible = currentModele;
      if (cible.portee === 'systeme') cible = await personalizeModel(cible);
      const updated = await updateModel(cible, def);
      const next = updated.item || updated;
      if (scope !== documentRevision.current || modeleRef.current?.id !== cible.id) return next;
      modeleRef.current = next;
      // Les modifications faites pendant le PUT restent à enregistrer avec la nouvelle version.
      setDirty(revision !== editRevision.current);
      setAutosaveBlocked(false);
      setLastSavedAt(Date.now());
      onModeleChange?.(next);
      return next;
    } catch (error) {
      if (scope === documentRevision.current && modeleRef.current?.id === currentModele.id) {
        setSaveError(error);
        setAutosaveBlocked(true);
        push(t('synthese.erreurEnregistrement'), 'danger');
      }
      throw error;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [modele, currentDefinition, onModeleChange, push, t]);

  useEffect(() => {
    if (!dirty || autosaveBlocked || !modeleRef.current || saving || evaluating) return undefined;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void save(currentDefinition).catch(() => {}); }, AUTO_SAVE_MS);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [dirty, autosaveBlocked, saving, evaluating, currentDefinition, save]);

  const setBloc = useCallback((id, patch) => {
    const next = cloneDefinition(currentDefinition);
    let changed = false;
    for (const section of next.sections) {
      for (const colonne of section.colonnes) {
        const index = colonne.findIndex((bloc) => bloc.id === id);
        if (index < 0) continue;
        colonne[index] = { ...colonne[index], ...patch };
        changed = true;
        break;
      }
      if (changed) break;
    }
    if (!changed) return;
    pushHistory(next);
    markDirty();
    void evaluate(next);
  }, [currentDefinition, pushHistory, markDirty, evaluate]);

  const addBloc = useCallback((sectionId, bloc) => {
    const next = cloneDefinition(currentDefinition);
    const section = next.sections.find((entry) => entry.id === sectionId);
    if (!section) return;
    const colonne = section.colonnes[0] || (section.colonnes[0] = []);
    colonne.push(bloc);
    next.layout = convertirEnGrille(next);
    pushHistory(next);
    markDirty();
    void evaluate(next);
  }, [currentDefinition, pushHistory, evaluate, markDirty]);

  const removeBloc = useCallback((id) => {
    const next = cloneDefinition(currentDefinition);
    for (const section of next.sections) {
      section.colonnes = section.colonnes.map((colonne) => colonne.filter((bloc) => bloc.id !== id));
    }
    if (next.layout) next.layout = convertirEnGrille(next);
    pushHistory(next);
    markDirty();
    void evaluate(next);
  }, [currentDefinition, pushHistory, evaluate, markDirty]);

  const setLayout = useCallback((layout) => {
    const next = cloneDefinition(currentDefinition);
    next.layout = normaliserLayout(next, layout);
    pushHistory(next);
    markDirty();
  }, [currentDefinition, pushHistory, markDirty]);

  const moveWidget = useCallback((id, dx, dy) => {
    const next = cloneDefinition(currentDefinition);
    next.layout = deplacerWidget(next.layout || convertirEnGrille(next), id, dx, dy);
    pushHistory(next);
    markDirty();
  }, [currentDefinition, pushHistory, markDirty]);

  const resizeWidget = useCallback((id, dw, dh) => {
    const next = cloneDefinition(currentDefinition);
    next.layout = redimensionnerWidget(next.layout || convertirEnGrille(next), id, dw, dh);
    if (dh) {
      const bloc = next.sections.flatMap((section) => section.colonnes.flat()).find((item) => item.id === id);
      if (bloc) bloc.options = { ...bloc.options, hauteur_mode: 'fixe' };
    }
    pushHistory(next);
    markDirty();
  }, [currentDefinition, pushHistory, markDirty]);

  const resizeWidgetsToContent = useCallback((changements) => {
    const next = cloneDefinition(currentDefinition);
    const current = next.layout || convertirEnGrille(next);
    const autoIds = new Set(next.sections.flatMap((section) => section.colonnes.flat())
      .filter((bloc) => bloc.options?.hauteur_mode !== 'fixe').map((bloc) => bloc.id));
    const layout = ajusterHauteursWidgets(current, changements.filter((item) => autoIds.has(item.id)));
    if (JSON.stringify(layout) === JSON.stringify(current)) return;
    next.layout = layout;
    pushHistory(next);
    markDirty();
  }, [currentDefinition, pushHistory, markDirty]);

  const dupliquerBloc = useCallback((id) => {
    const next = cloneDefinition(currentDefinition);
    const layout = next.layout || convertirEnGrille(next);
    const original = next.sections.flatMap((section) => section.colonnes.flat())
      .find((bloc) => bloc.id === id);
    if (!original) return;
    let suffixe = 2;
    let nouvelId = `${id}-copie`;
    const ids = new Set(next.sections.flatMap((section) => section.colonnes.flat()).map((bloc) => bloc.id));
    while (ids.has(nouvelId)) { nouvelId = `${id}-copie-${suffixe}`; suffixe += 1; }
    const copie = { ...JSON.parse(JSON.stringify(original)), id: nouvelId };
    for (const section of next.sections) {
      for (const colonne of section.colonnes) {
        const index = colonne.findIndex((bloc) => bloc.id === id);
        if (index >= 0) { colonne.splice(index + 1, 0, copie); break; }
      }
    }
    const source = layout.widgets.find((widget) => widget.id === id);
    next.layout = convertirEnGrille(next);
    if (source) {
      const created = next.layout.widgets.find((widget) => widget.id === nouvelId);
      if (created) { created.x = source.x; created.y = source.y + source.h + 1; created.w = source.w; created.h = source.h; }
    }
    pushHistory(next);
    markDirty();
    void evaluate(next);
  }, [currentDefinition, pushHistory, evaluate, markDirty]);

  const moveBloc = useCallback((id, delta) => {
    const next = cloneDefinition(currentDefinition);
    const positions = blocPositions(next);
    const index = positions.findIndex((position) => position.colonne[position.index]?.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= positions.length) return;
    const from = positions[index];
    const to = positions[target];
    const fromId = from.colonne[from.index]?.id;
    const toId = to.colonne[to.index]?.id;
    [from.colonne[from.index], to.colonne[to.index]] = [to.colonne[to.index], from.colonne[from.index]];
    if (next.layout) {
      const a = next.layout.widgets.find((widget) => widget.id === fromId);
      const b = next.layout.widgets.find((widget) => widget.id === toId);
      if (a && b) {
        const position = { x: a.x, y: a.y, w: a.w, h: a.h };
        Object.assign(a, { x: b.x, y: b.y, w: b.w, h: b.h });
        Object.assign(b, position);
      }
    }
    pushHistory(next);
    markDirty();
  }, [currentDefinition, pushHistory, markDirty]);

  const personnaliser = useCallback((source) => personalizeModel(source), []);

  const reinitialiser = useCallback(async (modeleId, source) => {
    const reset = await api(`/syntheses/modeles/${modeleId}/reinitialiser`, {
      method: 'POST', body: { source_id: source },
    });
    const next = await rememberModel(reset.item || reset);
    modeleRef.current = next;
    onModeleChange?.(next);
    replaceDefinition(next.definition);
    return next;
  }, [onModeleChange, replaceDefinition]);

  const loadEditions = useCallback(async () => {
    const currentModele = modeleRef.current || modele;
    if (!currentModele) return [];
    setEditionsLoading(true);
    try {
      const { items } = await api(`/syntheses/editions?modele_id=${currentModele.id}`);
      setEditions(items || []);
      return items || [];
    } finally { setEditionsLoading(false); }
  }, [modele]);

  const createEdition = useCallback(async (periode, filtres) => {
    const currentModele = modeleRef.current || modele;
    if (!currentModele) return null;
    const created = await api('/syntheses/editions', {
      method: 'POST', body: { modele_id: currentModele.id, periode, filtres },
    });
    const item = created.item || created;
    await loadEditions();
    return item;
  }, [modele, loadEditions]);

  const figereEdition = useCallback(async (editionId) => {
    const figee = await api(`/syntheses/editions/${editionId}/figer`, { method: 'POST' });
    const item = figee.item || figee;
    await loadEditions();
    return item;
  }, [loadEditions]);

  const getEdition = useCallback(async (editionId) => {
    const response = await api(`/syntheses/editions/${editionId}`);
    return response.item || response;
  }, []);

  const cancelSave = useCallback(() => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
  }, []);

  return {
    modele, definition, currentDefinition, dirty, saving, saveError, lastSavedAt, evaluating, evaluationError,
    results, editions, editionsLoading,
    canUndo, canRedo, undo, redo, save, setBloc, addBloc, removeBloc, moveBloc,
    setLayout, moveWidget, resizeWidget, resizeWidgetsToContent, dupliquerBloc,
    personnaliser, reinitialiser, loadEditions, createEdition, figereEdition, getEdition,
    cancelSave, setDirty, evaluate,
  };
}
