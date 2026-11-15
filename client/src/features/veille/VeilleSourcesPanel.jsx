import { useState } from 'react';
import {
  Activity, FlaskConical, Pause, Play, Plus, RefreshCw, Save, Trash2, Upload,
} from 'lucide-react';
import { formatDateTime } from '@anm/shared';
import { api } from '../../api/client.js';
import {
  Alert, Button, Checkbox, Dialog, EmptyState, Input, Select, useToast,
} from '../../components/ui/index.js';
import QueryContent from '../../components/ui/QueryContent.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useApiQuery } from '../../hooks/useApiQuery.js';
import { useI18n } from '../../i18n/index.jsx';

const SECRET = /token|secret|password|key/i;
const EMPTY = {
  mode: 'create', id: null, type: 'rss', nom: '', frequence_min: 30, actif: 1, config: {},
};

function typeLabel(t, type) { return t(`veille.sourceType.${type}`); }

function typeFields(type) {
  if (type === 'rss') return ['url'];
  if (type === 'google_news') return ['query'];
  if (type === 'facebook_page_geree' || type === 'facebook_page_publique') {
    return ['page_id', 'page_token', 'page_nom', 'max_posts', 'max_comments', 'include_comments', 'include_tagged'];
  }
  return [];
}

function configFrom(row) {
  const config = { ...(row.config_masquee || {}) };
  for (const key of Object.keys(config)) if (SECRET.test(key)) config[key] = '';
  return config;
}

export default function VeilleSourcesPanel() {
  const { t } = useI18n(); const { user } = useAuth(); const { push } = useToast();
  const admin = user?.role === 'admin';
  const sourcesQuery = useApiQuery('/veille/sources');
  const sources = sourcesQuery.data?.items || [];
  const catalogue = sourcesQuery.data?.connecteurs || [];
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState('');
  const [results, setResults] = useState({});
  const [toDelete, setToDelete] = useState(null);
  const [upload, setUpload] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const typeOptions = catalogue.filter((item) => item.type !== 'import')
    .map((item) => ({ value: item.type, label: item.label || typeLabel(t, item.type) }));
  const currentConnector = catalogue.find((item) => item.type === form?.type);

  const openCreate = () => setForm({
    ...EMPTY, type: typeOptions[0]?.value || 'rss', config: {},
  });

  const openEdit = (row) => setForm({
    mode: 'edit', id: row.id, type: row.type, nom: row.nom,
    frequence_min: row.frequence_min, actif: row.actif, config: configFrom(row),
  });

  const patch = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const patchConfig = (key, value) => setForm((current) => ({ ...current, config: { ...current.config, [key]: value } }));

  const submit = async (event) => {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      const config = { ...form.config };
      for (const key of Object.keys(config)) {
        if (SECRET.test(key) && String(config[key] || '').trim() === '') delete config[key];
      }
      const payload = {
        nom: form.nom, frequence_min: Number(form.frequence_min), actif: Number(form.actif), config,
      };
      if (form.mode === 'create') {
        await api('/veille/sources', { method: 'POST', body: { ...payload, type: form.type } });
        push(t('veille.sources.created'), 'success');
      } else {
        await api(`/veille/sources/${form.id}`, { method: 'PATCH', body: payload });
        push(t('veille.sources.updated'), 'success');
      }
      setForm(null);
      await sourcesQuery.refetch();
    } catch (cause) { push(cause.message, 'danger'); }
    finally { setSaving(false); }
  };

  const act = async (row, action) => {
    setBusy(`${action}:${row.id}`);
    try {
      if (action === 'toggle') {
        await api(`/veille/sources/${row.id}`, { method: 'PATCH', body: { actif: row.actif ? 0 : 1 } });
        push(row.actif ? t('veille.sources.disabled') : t('veille.sources.enabled'), 'success');
      } else if (action === 'test') {
        const data = await api(`/veille/sources/${row.id}/tester`, { method: 'POST' });
        setResults((current) => ({ ...current, [row.id]: data.item }));
      } else if (action === 'collect') {
        const data = await api(`/veille/sources/${row.id}/collecter`, { method: 'POST' });
        const item = data.item || {};
        setResults((current) => ({ ...current, [row.id]: item }));
        if (item.ok) {
          push(t('veille.toast.collected', { count: item.newCount || 0, total: item.collected || 0 }), 'success');
        } else {
          push(item.message || t('veille.toast.error'), 'danger');
        }
      }
      await sourcesQuery.refetch();
    } catch (cause) { push(cause.message, 'danger'); }
    finally { setBusy(''); }
  };

  const remove = async () => {
    if (!toDelete) return;
    setBusy(`delete:${toDelete.id}`);
    try {
      await api(`/veille/sources/${toDelete.id}`, { method: 'DELETE' });
      push(t('veille.sources.deleted'), 'success');
      setToDelete(null);
      await sourcesQuery.refetch();
    } catch (cause) { push(cause.message, 'danger'); }
    finally { setBusy(''); }
  };

  const openImport = () => { setUpload({ format: 'csv', nom: '' }); setUploadFile(null); };

  const chooseFile = (file) => {
    setUploadFile(file);
    if (!file) return;
    const extension = String(file.name || '').split('.').pop().toLowerCase();
    const format = extension === 'json' ? 'json' : extension === 'txt' ? 'whatsapp' : 'csv';
    setUpload((current) => ({ ...current, format, nom: current.nom || file.name.replace(/\.[^.]+$/, '').slice(0, 200) }));
  };

  const runImport = async (event) => {
    event.preventDefault();
    if (!uploadFile) { push(t('veille.import.noFile'), 'danger'); return; }
    setUploading(true);
    try {
      const text = await uploadFile.text();
      const data = await api(`/veille/import?format=${encodeURIComponent(upload.format)}&nom=${encodeURIComponent(upload.nom || '')}`, {
        method: 'POST', headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: text,
      });
      const item = data.item || {};
      push(t('veille.import.done', { created: item.newCount || 0, total: item.total || 0 }), 'success');
      if (item.truncated) push(t('veille.import.truncated'), 'warning');
      setUpload(null);
      setUploadFile(null);
      await sourcesQuery.refetch();
    } catch (cause) { push(cause.message, 'danger'); }
    finally { setUploading(false); }
  };

  return <div className="p-4">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <p className="max-w-2xl text-sm text-muted">{t('veille.sources.subtitle')}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" loading={sourcesQuery.isFetching} onClick={() => sourcesQuery.refetch()}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />{t('common.refresh')}
        </Button>
        {admin && <Button variant="secondary" onClick={openImport}>
          <Upload className="h-4 w-4" aria-hidden="true" />{t('veille.import.button')}
        </Button>}
        {admin && <Button onClick={openCreate} disabled={!typeOptions.length}>
          <Plus className="h-4 w-4" aria-hidden="true" />{t('veille.sources.add')}
        </Button>}
      </div>
    </div>

    {!catalogue.length && admin && <Alert variant="warning" className="mb-4">{t('veille.sources.noConnector')}</Alert>}

    <QueryContent query={sourcesQuery}>
      {sources.length ? <ul className="grid gap-3">{sources.map((row) => {
        const job = row.job || {};
        const result = results[row.id];
        return <li key={row.id} className="rounded-md border border-border p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-bold text-ink">
                <bdi>{row.nom}</bdi>
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${row.actif ? 'bg-straitebg text-straite' : 'bg-surface2 text-muted'}`}>
                  {row.actif ? t('veille.sources.active') : t('veille.sources.inactive')}
                </span>
                {!row.connecteur_disponible && <span className="inline-flex items-center rounded-full bg-stcoursbg px-2.5 py-1 text-xs font-bold text-stcours">{t('veille.sources.unavailable')}</span>}
              </p>
              <p className="text-xs text-muted">
                {typeLabel(t, row.type)} · {t('veille.sources.frequency', { minutes: row.frequence_min })}
                {' · '}{t('veille.sources.lastRun')} : {row.derniere_execution ? formatDateTime(row.derniere_execution) : t('veille.sources.never')}
              </p>
              <p className="mt-1 flex flex-wrap gap-2 text-xs text-muted">
                <span>{t('veille.sources.elements')} : <strong className="text-ink2">{row.elements ?? 0}</strong></span>
                <span>{t('veille.sources.pending')} : <strong className="text-ink2">{row.a_qualifier ?? 0}</strong></span>
                <span>{t('veille.sources.retained')} : <strong className="text-ink2">{row.retenus ?? 0}</strong></span>
                {job.statut && <span>{t('veille.sources.job')} : {t(`veille.job.${job.statut}`)}</span>}
              </p>
              {row.config_erreur && <p className="mt-1 text-xs text-danger">{row.config_erreur}</p>}
              {job.erreur_message && <p className="mt-1 text-xs text-danger"><bdi>{job.erreur_message}</bdi></p>}
            </div>
            {admin && <div className="flex flex-wrap items-start gap-2">
              <Button size="sm" variant="ghost" onClick={() => openEdit(row)}>
                <Save className="h-4 w-4" aria-hidden="true" />{t('common.edit')}
              </Button>
              <Button size="sm" variant="ghost" loading={busy === `test:${row.id}`} disabled={!row.connecteur_disponible}
                onClick={() => act(row, 'test')}>
                <FlaskConical className="h-4 w-4" aria-hidden="true" />{t('veille.sources.test')}
              </Button>
              <Button size="sm" variant="ghost" loading={busy === `collect:${row.id}`} disabled={!row.connecteur_disponible}
                onClick={() => act(row, 'collect')}>
                <Activity className="h-4 w-4" aria-hidden="true" />{t('veille.sources.collect')}
              </Button>
              <Button size="sm" variant="ghost" loading={busy === `toggle:${row.id}`} onClick={() => act(row, 'toggle')}>
                {row.actif ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
                {row.actif ? t('veille.sources.pause') : t('veille.sources.resume')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setToDelete(row)}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />{t('common.delete')}
              </Button>
            </div>}
          </div>
          {result && <Alert variant={result.ok ? 'success' : 'danger'} className="mt-3">
            {result.ok
              ? <>{t('veille.sources.testOk')}{result.page?.nom ? ` — ${result.page.nom}` : ''}{typeof result.nb_elements === 'number' ? ` · ${t('veille.sources.items', { count: result.nb_elements })}` : ''}{typeof result.newCount === 'number' ? ` · ${t('veille.sources.newItems', { count: result.newCount })}` : ''}</>
              : <><bdi>{result.message}</bdi>{result.code ? ` (${result.code})` : ''}</>}
          </Alert>}
        </li>;
      })}</ul> : <EmptyState icon={Activity} title={t('veille.sources.empty')}
        description={admin ? t('veille.sources.emptyHelp') : undefined}
        action={admin && typeOptions.length ? <Button onClick={openCreate}><Plus className="h-4 w-4" aria-hidden="true" />{t('veille.sources.add')}</Button> : undefined} />}
    </QueryContent>

    <Dialog open={Boolean(form)} onClose={() => setForm(null)} title={form?.mode === 'create' ? t('veille.sources.add') : t('veille.sources.edit')}
      footer={<>
        <Button variant="ghost" type="button" onClick={() => setForm(null)} disabled={saving}>{t('common.cancel')}</Button>
        <Button type="submit" form="veille-source-form" loading={saving}><Save className="h-4 w-4" aria-hidden="true" />{t('veille.sources.save')}</Button>
      </>}>
      {form && <form id="veille-source-form" className="grid gap-3" onSubmit={submit}>
        <Select label={t('veille.sources.type')} value={form.type} disabled={form.mode === 'edit'}
          options={typeOptions.some((option) => option.value === form.type)
            ? typeOptions
            : [...typeOptions, { value: form.type, label: typeLabel(t, form.type) }]}
          onChange={(event) => patch('type', event.target.value)} required />
        {currentConnector?.permissionNote && <Alert variant="info">{currentConnector.permissionNote}</Alert>}
        <Input label={t('veille.sources.name')} value={form.nom} maxLength={200} required
          onChange={(event) => patch('nom', event.target.value)} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input type="number" min="5" max="10080" label={t('veille.sources.frequencyLabel')} value={form.frequence_min} required
            onChange={(event) => patch('frequence_min', event.target.value)} />
          <div className="flex items-end pb-1">
            <Checkbox label={t('veille.sources.activeLabel')} checked={Number(form.actif) === 1}
              onChange={(event) => patch('actif', event.target.checked ? 1 : 0)} />
          </div>
        </div>

        {typeFields(form.type).includes('url') && <Input label={t('veille.sources.url')} type="url" maxLength={2000} value={form.config.url || ''}
          hint={t('veille.sources.urlHint')} required onChange={(event) => patchConfig('url', event.target.value)} />}
        {typeFields(form.type).includes('query') && <Input label={t('veille.sources.query')} maxLength={300} value={form.config.query || ''}
          hint={t('veille.sources.queryHint')} required onChange={(event) => patchConfig('query', event.target.value)} />}
        {typeFields(form.type).includes('page_id') && <>
          <Input label={t('veille.sources.pageId')} inputMode="numeric" maxLength={100} value={form.config.page_id || ''} required
            onChange={(event) => patchConfig('page_id', event.target.value)} />
          <Input label={t('veille.sources.pageToken')} type="password" autoComplete="off" maxLength={2000}
            value={form.config.page_token || ''} required={form.mode === 'create'}
            placeholder={form.mode === 'edit' ? t('veille.sources.tokenUnchanged') : ''}
            hint={t('veille.sources.tokenHint')} onChange={(event) => patchConfig('page_token', event.target.value)} />
          <Input label={t('veille.sources.pageName')} maxLength={200} value={form.config.page_nom || ''}
            onChange={(event) => patchConfig('page_nom', event.target.value)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input type="number" min="1" max="50" label={t('veille.sources.maxPosts')} value={form.config.max_posts ?? 15}
              onChange={(event) => patchConfig('max_posts', event.target.value)} />
            <Input type="number" min="0" max="50" label={t('veille.sources.maxComments')} value={form.config.max_comments ?? 10}
              onChange={(event) => patchConfig('max_comments', event.target.value)} />
          </div>
          <div className="flex flex-wrap gap-4">
            <Checkbox label={t('veille.sources.includeComments')} checked={form.config.include_comments !== false && form.config.include_comments !== 'false'}
              onChange={(event) => patchConfig('include_comments', event.target.checked)} />
            <Checkbox label={t('veille.sources.includeTagged')} checked={form.config.include_tagged !== false && form.config.include_tagged !== 'false'}
              onChange={(event) => patchConfig('include_tagged', event.target.checked)} />
          </div>
        </>}
        {form.mode === 'edit' && <p className="text-xs text-muted">{t('veille.sources.secretHelp')}</p>}
      </form>}
    </Dialog>

    <Dialog open={Boolean(toDelete)} onClose={() => setToDelete(null)} title={t('veille.sources.deleteTitle')}
      footer={<>
        <Button variant="ghost" onClick={() => setToDelete(null)} disabled={busy.startsWith('delete:')}>{t('common.cancel')}</Button>
        <Button variant="danger" loading={busy.startsWith('delete:')} onClick={remove}>{t('common.delete')}</Button>
      </>}>
      <p>{t('veille.sources.deleteBody', { name: toDelete?.nom || '' })}</p>
      <p className="mt-2 text-sm text-danger">{t('veille.sources.deleteWarning')}</p>
    </Dialog>

    <Dialog open={Boolean(upload)} onClose={() => setUpload(null)} title={t('veille.import.title')}
      footer={<>
        <Button variant="ghost" type="button" onClick={() => setUpload(null)} disabled={uploading}>{t('common.cancel')}</Button>
        <Button type="submit" form="veille-import-form" loading={uploading} disabled={!uploadFile}>
          <Upload className="h-4 w-4" aria-hidden="true" />{t('veille.import.submit')}
        </Button>
      </>}>
      {upload && <form id="veille-import-form" className="grid gap-4" onSubmit={runImport}>
        <p className="text-sm text-muted">{t('veille.import.help')}</p>
        <label className="grid min-h-28 cursor-pointer place-items-center rounded-md border border-dashed border-border bg-surface2 p-4 text-center text-sm text-muted">
          <Upload className="mb-2 h-6 w-6" aria-hidden="true" />
          <bdi>{uploadFile?.name || t('veille.import.choose')}</bdi>
          <input className="sr-only" type="file" accept=".csv,.json,.txt,text/csv,application/json,text/plain"
            onChange={(event) => chooseFile(event.target.files?.[0] || null)} />
        </label>
        <Select label={t('veille.import.format')} value={upload.format} required
          options={[
            { value: 'csv', label: t('veille.import.formatCsv') },
            { value: 'json', label: t('veille.import.formatJson') },
            { value: 'whatsapp', label: t('veille.import.formatWhatsapp') },
          ]}
          onChange={(event) => setUpload((current) => ({ ...current, format: event.target.value }))} />
        <Input label={t('veille.import.source')} maxLength={200} value={upload.nom}
          hint={t('veille.import.sourceHint')}
          onChange={(event) => setUpload((current) => ({ ...current, nom: event.target.value }))} />
      </form>}
    </Dialog>
  </div>;
}
