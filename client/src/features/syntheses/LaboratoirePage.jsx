import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Copy, FolderOpen, Play, RefreshCw, RotateCcw, Save } from 'lucide-react';
import { syntheseBatchSchema, syntheseModelSchema } from '@anm/shared';
import { api } from '../../api/client.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import {
  Alert, Button, Card, CardHeader, Dialog, EmptyState, Input, LoadingBlock, Select, Skeleton, Textarea, useToast,
} from '../../components/ui/index.js';
import { useApiQuery } from '../../hooks/useApiQuery.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useRefs } from '../../context/RefsContext.jsx';
import { useI18n } from '../../i18n/index.jsx';
import LabBuilder from './LabBuilder.jsx';
import LabResults from './LabResults.jsx';
import {
  buildRequete, createDefaultDraft, draftFromRequete, filterConfigsFromRefs, firstRequete, validateDraft,
} from './labHelpers.js';

const SCOPE_KEY = { prive: 'lab.scopePrivate', equipe: 'lab.scopeTeam', systeme: 'lab.scopeSystem' };

function LabModelsCard({
  models, loading, error, reload, selectedId, onSelect, onLoad, onDuplicate, canWrite, duplicating, t,
}) {
  return <Card data-testid="lab-models">
    <CardHeader title={t('lab.savedModels')} description={t('lab.savedModelsHelp')} action={
      <Button size="sm" variant="ghost" loading={loading} onClick={reload}><RefreshCw className="h-4 w-4" aria-hidden="true" />{t('common.refresh')}</Button>
    } />
    <div className="grid gap-3 p-4">
      {error && <Alert variant="danger" title={t('lab.modelsError')}>
        {error.message || t('common.error')}
        <div className="mt-2"><Button size="sm" variant="secondary" onClick={reload}>{t('common.retry')}</Button></div>
      </Alert>}
      {loading && !models.length ? <Skeleton className="h-11 w-full" /> : models.length ? <>
        <Select label={t('lab.selectModel')} value={selectedId} onChange={(event) => onSelect(event.target.value)}
          data-testid="lab-model-select"
          options={[
            { value: '', label: t('lab.chooseModel') },
            ...models.map((model) => ({
              value: String(model.id),
              label: `${model.nom} · ${t(SCOPE_KEY[model.portee] || 'lab.scopePrivate')}`,
            })),
          ]} />
        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="secondary" size="sm" onClick={onLoad} disabled={!selectedId || duplicating} data-testid="lab-load-model">
            <FolderOpen className="h-4 w-4" aria-hidden="true" />{t('lab.loadModel')}
          </Button>
          {canWrite && <Button variant="secondary" size="sm" onClick={onDuplicate} loading={duplicating} disabled={!selectedId} data-testid="lab-duplicate-model">
            <Copy className="h-4 w-4" aria-hidden="true" />{t('lab.duplicateModel')}
          </Button>}
        </div>
      </> : <EmptyState compact title={t('lab.noModels')} description={t('lab.noModelsHelp')} action={
        <Button size="sm" variant="secondary" onClick={reload}>{t('common.refresh')}</Button>
      } />}
    </div>
  </Card>;
}

export default function LaboratoirePage() {
  const { t, lang, dir } = useI18n();
  const { user } = useAuth();
  const { refs } = useRefs();
  const toast = useToast();
  const catalogueQuery = useApiQuery('/syntheses/catalogue');
  const modelsQuery = useApiQuery('/syntheses/modeles');
  const canWrite = user?.role === 'admin' || user?.role === 'operateur';

  const [draft, setDraft] = useState(createDefaultDraft);
  const [result, setResult] = useState(null);
  const [resultError, setResultError] = useState(null);
  const [running, setRunning] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [lastSpec, setLastSpec] = useState(null);
  const [selectedModelId, setSelectedModelId] = useState('');
  const [duplicating, setDuplicating] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveDescription, setSaveDescription] = useState('');
  const [saveScope, setSaveScope] = useState('prive');
  const [saveError, setSaveError] = useState('');

  const revisionRef = useRef(0);
  const draftRef = useRef(draft);
  const autoCatalogueRef = useRef('');
  const catalogueReady = catalogueQuery.isSuccess;
  const catalogueVersion = catalogueQuery.data?.version || '—';
  const models = useMemo(() => modelsQuery.data?.items || [], [modelsQuery.data]);
  const selectedModel = models.find((model) => String(model.id) === String(selectedModelId)) || null;
  const validation = useMemo(() => validateDraft(draft, t), [draft, t]);
  const filterConfigs = useMemo(() => filterConfigsFromRefs(refs, lang, t), [refs, lang, t]);

  useEffect(() => { draftRef.current = draft; }, [draft]);

  useEffect(() => {
    if (!selectedModelId && models.length) setSelectedModelId(String(models[0].id));
  }, [models, selectedModelId]);

  const execute = useCallback(async (spec) => {
    const revision = revisionRef.current;
    setLastSpec(spec);
    setRunning(true);
    setResultError(null);
    try {
      const payload = await api('/syntheses/evaluer', { method: 'POST', body: { requetes: [spec] } });
      const parsed = syntheseBatchSchema.safeParse(payload);
      const item = parsed.success ? parsed.data.items?.[0] : null;
      if (!item) throw new Error(t('lab.emptyResponse'));
      setResult(item);
      if (revision === revisionRef.current) setDirty(false);
    } catch (error) {
      setResultError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setRunning(false);
    }
  }, [t]);

  const run = useCallback((snapshot) => {
    const issues = validateDraft(snapshot, t);
    if (issues.length) {
      setResultError(null);
      return;
    }
    void execute(buildRequete(snapshot));
  }, [execute, t]);

  const runRef = useRef(run);
  useEffect(() => { runRef.current = run; }, [run]);

  useEffect(() => {
    if (!catalogueReady) return;
    const key = catalogueQuery.data?.version || 'fallback';
    if (autoCatalogueRef.current === key) return;
    autoCatalogueRef.current = key;
    runRef.current(draftRef.current);
  }, [catalogueReady, catalogueQuery.data?.version]);

  const changeDraft = (updater) => {
    revisionRef.current += 1;
    setDraft((current) => {
      const next = typeof updater === 'function' ? updater(current) : { ...current, ...updater };
      draftRef.current = next;
      return next;
    });
    setDirty(true);
  };

  const reset = () => {
    const next = createDefaultDraft();
    revisionRef.current += 1;
    setDraft(next);
    draftRef.current = next;
    setDirty(true);
    setResultError(null);
  };

  const loadDraft = (requete, name) => {
    const next = draftFromRequete(requete);
    revisionRef.current += 1;
    setDraft(next);
    draftRef.current = next;
    setDirty(true);
    setResultError(null);
    toast.push(t('lab.modelLoaded', { name }));
    runRef.current(next);
  };

  const loadSelected = () => {
    if (!selectedModel) return;
    const requete = firstRequete(selectedModel);
    if (!requete) {
      toast.push(t('lab.modelNoQuery'), 'danger');
      return;
    }
    loadDraft(requete, selectedModel.nom);
  };

  const duplicateSelected = async () => {
    if (!selectedModel || !canWrite || duplicating) return;
    setDuplicating(true);
    try {
      const payload = await api(`/syntheses/modeles/${selectedModel.id}/dupliquer`, {
        method: 'POST',
        body: { portee: 'prive' },
      });
      const parsed = syntheseModelSchema.safeParse(payload?.item);
      if (!parsed.success) throw new Error(t('lab.emptyResponse'));
      await modelsQuery.reload();
      setSelectedModelId(String(parsed.data.id));
      const requete = firstRequete(parsed.data);
      toast.push(t('lab.modelDuplicated', { name: parsed.data.nom }));
      if (requete) loadDraft(requete, parsed.data.nom);
    } catch (error) {
      toast.push(error instanceof Error ? error.message : t('lab.errorHelp'), 'danger');
    } finally {
      setDuplicating(false);
    }
  };

  const openSave = () => {
    setSaveName('');
    setSaveDescription('');
    setSaveScope('prive');
    setSaveError('');
    setSaveOpen(true);
  };

  const saveModel = async () => {
    if (!canWrite || saving) return;
    const issues = validateDraft(draft, t);
    if (issues.length) {
      setSaveError(issues[0]);
      return;
    }
    if (!saveName.trim()) {
      setSaveError(t('lab.modelNameRequired'));
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      const definition = {
        schema_version: 1,
        sections: [{
          id: 'lab-section',
          colonnes: [[{
            id: 'lab-requete',
            type: 'tableau',
            requete: buildRequete(draft),
          }]],
        }],
      };
      const payload = await api('/syntheses/modeles', {
        method: 'POST',
        body: {
          nom: saveName.trim(),
          description: saveDescription.trim() || null,
          portee: saveScope,
          definition,
        },
      });
      const parsed = syntheseModelSchema.safeParse(payload?.item);
      if (!parsed.success) throw new Error(t('lab.emptyResponse'));
      setSelectedModelId(String(parsed.data.id));
      setSaveOpen(false);
      toast.push(t('lab.modelSaved', { name: parsed.data.nom }));
      await modelsQuery.reload();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : t('lab.errorHelp'));
    } finally {
      setSaving(false);
    }
  };

  const onRetry = lastSpec ? () => void execute(lastSpec) : undefined;

  return <div className="page-container">
    <PageHeader eyebrow={t('lab.eyebrow')} title={t('lab.title')} description={t('lab.subtitle')} actions={<>
      <Button variant="secondary" onClick={reset} disabled={running}><RotateCcw className="h-4 w-4" aria-hidden="true" />{t('common.reset')}</Button>
      {canWrite && <Button variant="secondary" onClick={openSave} disabled={running || !catalogueReady || validation.length > 0} data-testid="lab-save-open">
        <Save className="h-4 w-4" aria-hidden="true" />{t('lab.saveModel')}
      </Button>}
      <Button onClick={() => run(draft)} loading={running} disabled={!catalogueReady}><Play className="h-4 w-4" aria-hidden="true" />{t('lab.evaluate')}</Button>
    </>} />

    {catalogueQuery.error ? <Alert variant="danger" title={t('lab.catalogueError')} action={
      <Button size="sm" variant="secondary" onClick={() => catalogueQuery.reload()}>{t('common.retry')}</Button>
    }>{catalogueQuery.error.message || t('common.error')}</Alert> : !catalogueReady ? <Card className="p-4"><LoadingBlock /></Card> : <>
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,380px)]">
        <LabBuilder
          draft={draft}
          onChange={changeDraft}
          filterConfigs={filterConfigs}
          catalogueVersion={catalogueVersion}
          running={running}
          dirty={dirty}
          hasResult={Boolean(result)}
          validation={validation}
          onRun={() => run(draft)}
          t={t}
          lang={lang}
        />
        <div className="grid min-w-0 content-start gap-5">
          <LabModelsCard
            models={models}
            loading={modelsQuery.loading}
            error={modelsQuery.error}
            reload={() => modelsQuery.reload()}
            selectedId={selectedModelId}
            onSelect={setSelectedModelId}
            onLoad={loadSelected}
            onDuplicate={duplicateSelected}
            canWrite={canWrite}
            duplicating={duplicating}
            t={t}
          />
          <Card className="p-4">
            <p className="text-xs font-bold text-muted">{t('lab.helpTitle')}</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-ink2">
              <li>{t('lab.helpMeasure')}</li>
              <li>{t('lab.helpDimension')}</li>
              <li>{t('lab.helpSave')}</li>
            </ul>
          </Card>
        </div>
      </div>

      <div className="mt-5 min-w-0">
        <LabResults result={result} error={resultError} running={running} dirty={dirty}
          onRetry={onRetry} t={t} lang={lang} dir={dir} />
      </div>
    </>}

    <Dialog open={saveOpen} onClose={() => { if (!saving) setSaveOpen(false); }} title={t('lab.saveTitle')} footer={<>
      <Button variant="secondary" onClick={() => setSaveOpen(false)} disabled={saving}>{t('common.cancel')}</Button>
      <Button onClick={saveModel} loading={saving}><Save className="h-4 w-4" aria-hidden="true" />{t('lab.saveModel')}</Button>
    </>}>
      <div className="grid gap-4">
        {saveError && <Alert variant="danger">{saveError}</Alert>}
        <Input label={t('lab.modelName')} required maxLength={200} value={saveName}
          placeholder={t('lab.modelNamePlaceholder')} onChange={(event) => setSaveName(event.target.value)} />
        <Textarea label={t('lab.modelDescription')} rows={3} maxLength={2000} value={saveDescription}
          placeholder={t('lab.modelDescriptionPlaceholder')} onChange={(event) => setSaveDescription(event.target.value)} />
        <Select label={t('lab.modelScope')} value={saveScope} onChange={(event) => setSaveScope(event.target.value)}
          options={[{ value: 'prive', label: t('lab.scopePrivate') }, { value: 'equipe', label: t('lab.scopeTeam') }]} />
        <p className="text-xs text-muted">{t('lab.saveHelp')}</p>
      </div>
    </Dialog>
  </div>;
}
