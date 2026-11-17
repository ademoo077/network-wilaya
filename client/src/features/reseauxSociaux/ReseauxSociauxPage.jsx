import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Database, FileSpreadsheet, FileText, MapPin, Plus, RefreshCw, RotateCcw, Upload, UserRound } from 'lucide-react';
import { COMPTE_SOCIAL_TYPES, COMPTE_SOCIAL_VERIFICATIONS, PLATEFORMES, reseauxSociauxQuerySchema } from '@anm/shared';
import { download, queryString } from '../../api/client.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { Alert, Button, Card, ErrorState, Input, KpiCard, Select, Tabs, useToast } from '../../components/ui/index.js';
import QueryContent from '../../components/ui/QueryContent.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useRefs } from '../../context/RefsContext.jsx';
import { useApiQuery } from '../../hooks/useApiQuery.js';
import { useAsyncAction } from '../../hooks/useAsyncAction.js';
import { useDebounced } from '../../hooks/useDebounced.js';
import { refLabel, useI18n } from '../../i18n/index.jsx';
import CompteSocialDetail from './CompteSocialDetail.jsx';
import CompteSocialDialog from './CompteSocialDialog.jsx';
import ComptesSociauxList from './ComptesSociauxList.jsx';
import QualificationQueue from './QualificationQueue.jsx';
import ReseauxSociauxImportDialog from './ReseauxSociauxImportDialog.jsx';
import ReseauxSociauxStats from './ReseauxSociauxStats.jsx';
import { ImportsPanel, QualityPanel } from './SocialPanels.jsx';

const VIEWS = ['repertoire', 'statistiques', 'qualifier', 'imports', 'qualite'];
const FILTER_KEYS = ['q', 'plateforme', 'categorie', 'daira_id', 'commune_id', 'verification', 'actif', 'page', 'pageSize', 'sort', 'dir', 'non_rattache', 'ca_libelle', 'commune_libelle'];
const CLEAR_ATTACHMENT = { non_rattache: '', ca_libelle: '', commune_libelle: '' };
const isSocialQuery = ({ queryKey }) => queryKey[0] === 'api' && String(queryKey[1]).startsWith('/reseaux-sociaux');

export function ReseauxSociauxWorkspace({ embedded = false }) {
  const { t, lang } = useI18n(); const { user } = useAuth(); const { refs } = useRefs(); const { push } = useToast();
  const queryClient = useQueryClient(); const action = useAsyncAction({ success: false });
  const [params, setParams] = useSearchParams(); const [editing, setEditing] = useState(null); const [importing, setImporting] = useState(false);
  const parsed = reseauxSociauxQuerySchema.safeParse(Object.fromEntries(FILTER_KEYS.filter((key) => params.has(key)).map((key) => [key, params.get(key)])));
  const filters = parsed.success ? parsed.data : reseauxSociauxQuerySchema.parse({});
  const q = useDebounced(filters.q, 250);
  const listing = useApiQuery(`/reseaux-sociaux${queryString({ ...filters, q })}`);
  const { page: _page, pageSize: _size, sort: _sort, dir: _dir, ...scope } = filters;
  const requestedView = params.get('onglet');
  const view = VIEWS.includes(requestedView) ? requestedView : 'repertoire';
  const stats = useApiQuery(`/reseaux-sociaux/stats${queryString({ ...scope, q })}`);
  const queue = useApiQuery(`/reseaux-sociaux${queryString({ ...scope, q, verification: 'a_verifier', page: 1, pageSize: 25, sort: 'updated_at', dir: 'desc' })}`,
    { enabled: view === 'qualifier' });
  const data = stats.data?.item;
  const selectedId = /^[1-9]\d*$/.test(params.get('fiche') || '') ? Number(params.get('fiche')) : null;
  const canManage = user?.role === 'admin';
  const updating = stats.isPlaceholderData || listing.isPlaceholderData || filters.q !== q;
  const update = useCallback((values, resetPage = true) => setParams((previous) => {
    const next = new URLSearchParams(previous);
    if (resetPage) next.delete('page');
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined || value === null || value === '') next.delete(key); else next.set(key, String(value));
    }
    return next;
  }, { replace: Object.hasOwn(values, 'q') }), [setParams]);
  const reset = () => setParams((previous) => { const next = new URLSearchParams(previous); for (const key of FILTER_KEYS) next.delete(key); return next; });
  const invalidate = useCallback(() => queryClient.invalidateQueries({ predicate: isSocialQuery }), [queryClient]);
  const saved = async (item) => {
    queryClient.setQueryData(['api', `/reseaux-sociaux/${item.id}`], { item });
    setEditing(null); update({ fiche: item.id }, false); await invalidate(); push(t('social.saved'));
  };
  const edit = (item) => { update({ fiche: '' }, false); setEditing(item); };
  const drill = (values) => update({ ...(Object.hasOwn(values, 'daira_id') || Object.hasOwn(values, 'commune_id') ? CLEAR_ATTACHMENT : {}), ...values, onglet: 'repertoire', fiche: '' });
  const communes = filters.daira_id ? refs.dairas.find((row) => row.id === filters.daira_id)?.communes || [] : refs.dairas.flatMap((row) => row.communes || []);
  const addButton = canManage && <Button onClick={() => setEditing({})}><Plus className="h-4 w-4" aria-hidden="true" />{t('social.add')}</Button>;
  const tools = <>
    <Button variant="secondary" loading={action.isPending} disabled={updating || !parsed.success || !data || !listing.data} onClick={() => action.run(() => download(`/reseaux-sociaux/export${queryString({ ...scope, q, sort: filters.sort, dir: filters.dir, format: 'xlsx' })}`, 'reseaux-sociaux.xlsx'))}>
      <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />{t('social.exportExcel')}</Button>
    <Button variant="secondary" disabled={action.isPending || updating || !parsed.success || !data || !listing.data} onClick={() => action.run(() => download(`/reseaux-sociaux/export${queryString({ ...scope, q, sort: filters.sort, dir: filters.dir, format: 'csv' })}`, 'reseaux-sociaux.csv'))}>{t('social.exportCsv')}</Button>
    {canManage && <Button variant="secondary" onClick={() => setImporting(true)}><Upload className="h-4 w-4" aria-hidden="true" />{t('social.import')}</Button>}{addButton}
  </>;
  return <div className="space-y-5" data-social-workspace>
    {embedded ? <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-black">{t('social.title')}</h2><p className="mt-1 text-sm text-muted">{t('social.subtitle')}</p></div><div className="flex flex-wrap gap-2">{tools}</div></div>
      : <PageHeader title={t('social.title')} description={t('social.subtitle')} eyebrow={t('social.eyebrow')} actions={tools} />}
    <Card className="flex items-start gap-3 p-4"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-brand-100 text-brand-700"><Database className="h-5 w-5" aria-hidden="true" /></div>
      <div className="min-w-0"><p className="text-sm font-bold">{t('social.directoryPurpose')}</p><p className="mt-1 text-xs text-muted">{t('social.scopeHelp')}</p></div></Card>
    <QueryContent query={stats}>
      {data ? <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-4" data-social-kpis>
        <div data-social-kpi="total"><KpiCard icon={Database} label={t('social.count.total')} value={data.resume.total}><p className="text-xs text-muted">{t('social.activeCount', { count: data.resume.actifs })}</p></KpiCard></div>
        <div data-social-kpi="pages"><KpiCard icon={FileText} label={t('social.count.pages')} value={data.resume.pages} onClick={() => drill({ categorie: 'page' })} /></div>
        <div data-social-kpi="profils"><KpiCard icon={UserRound} label={t('social.count.profils')} value={data.resume.profils} onClick={() => drill({ categorie: 'profil' })} /></div>
        <div data-social-kpi="communes"><KpiCard icon={MapPin} label={t('social.coveredCommunes')} value={data.resume.communes_couvertes} onClick={() => update({ onglet: 'statistiques' }, false)}><p className="text-xs text-muted">{t('social.caCount', { count: data.resume.ca_couverts })}</p></KpiCard></div>
      </div> : <ErrorState message={t('social.badResponse')} onRetry={stats.refetch} />}
    </QueryContent>
    <Tabs value={view} ariaLabel={t('social.views')} tabs={[
      { value: 'repertoire', label: t('social.tab.directory') },
      { value: 'statistiques', label: t('social.tab.statistics') },
      { value: 'qualifier', label: t('social.tab.qualify') },
      { value: 'imports', label: t('social.tab.imports') },
      { value: 'qualite', label: t('social.tab.quality') },
    ]} onChange={(onglet) => update({ onglet }, false)} />
    {!parsed.success && <Alert variant="warning" action={<Button variant="secondary" onClick={reset}>{t('social.resetFilters')}</Button>}>{t('social.invalidFilters')}</Alert>}
    {filters.non_rattache && <Alert variant="info" action={<Button variant="secondary" onClick={() => update(CLEAR_ATTACHMENT)}>{t('social.clearAttachmentFilter')}</Button>}>
      {t('social.attachmentFilter')} <bdi>{filters.ca_libelle || '—'}{filters.non_rattache === 'commune' ? ` / ${filters.commune_libelle || '—'}` : ''}</bdi>
    </Alert>}
    {updating && <p role="status" className="text-xs text-muted">{t('social.updating')}</p>}
    {['repertoire', 'statistiques', 'qualifier'].includes(view) && <Card className="p-4"><div className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Input type="search" label={t('social.search')} maxLength={150} value={filters.q} onChange={(event) => update({ q: event.target.value })} placeholder={t('social.searchPlaceholder')} />
      <Select label={t('social.network')} placeholder={t('common.all')} value={filters.plateforme || ''} options={PLATEFORMES.map((value) => ({ value, label: t(`platform.${value}`) }))}
        onChange={(event) => update({ plateforme: event.target.value })} />
      <Select label={t('social.accountType')} placeholder={t('common.all')} value={filters.categorie || ''} options={COMPTE_SOCIAL_TYPES.map((value) => ({ value, label: t(`social.type.${value}`) }))}
        onChange={(event) => update({ categorie: event.target.value })} />
      <Select label={t('social.ca')} placeholder={t('common.all')} value={filters.daira_id || ''} options={refs.dairas.map((row) => ({ value: row.id, label: refLabel(row, lang) }))}
        onChange={(event) => update({ ...CLEAR_ATTACHMENT, daira_id: event.target.value, commune_id: '' })} />
      <Select label={t('field.commune')} placeholder={t('common.all')} value={filters.commune_id || ''} options={communes.map((row) => ({ value: row.id, label: refLabel(row, lang) }))}
        onChange={(event) => { const commune = communes.find((row) => String(row.id) === event.target.value); update({ ...CLEAR_ATTACHMENT, commune_id: event.target.value, ...(commune ? { daira_id: commune.daira_id } : {}) }); }} />
      <Select label={t('social.verificationLabel')} placeholder={t('common.all')} value={filters.verification || ''} options={COMPTE_SOCIAL_VERIFICATIONS.map((value) => ({ value, label: t(`social.verification.${value}`) }))}
        onChange={(event) => update({ verification: event.target.value })} />
      <Select label={t('social.activity')} placeholder={t('common.all')} value={filters.actif ?? ''} options={[{ value: '1', label: t('social.active') }, { value: '0', label: t('social.inactive') }]}
        onChange={(event) => update({ actif: event.target.value })} />
      <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={reset}><RotateCcw className="h-4 w-4" aria-hidden="true" />{t('social.resetFilters')}</Button>
        <Button variant="ghost" aria-label={t('social.refresh')} loading={stats.isFetching || listing.isFetching} onClick={() => action.run(() => Promise.all([stats.refetch(), listing.refetch()]))}><RefreshCw className="h-4 w-4" aria-hidden="true" /></Button></div>
    </div></Card>}
    {view === 'statistiques' && <QueryContent query={stats}>{data && <ReseauxSociauxStats data={data} onDrill={drill} />}</QueryContent>}
    {view === 'qualifier' && <QueryContent query={queue}>
      <QualificationQueue query={queue} canManage={canManage} onChanged={invalidate} onOpen={(fiche) => update({ fiche }, false)} />
    </QueryContent>}
    {view === 'imports' && <ImportsPanel canManage={canManage} onImport={() => setImporting(true)} />}
    {view === 'qualite' && <QualityPanel resume={data?.resume} onFilter={(values) => update({ ...CLEAR_ATTACHMENT, ...values }, false)} />}
    {['repertoire', 'statistiques'].includes(view) && <ComptesSociauxList query={listing} filters={filters} onFilter={update} onOpen={(fiche) => update({ fiche }, false)} onEdit={edit} canManage={canManage}
      title={view === 'statistiques' ? t('social.accountsInScope') : t('social.directory')} emptyAction={canManage ? addButton : null} />}
    {!canManage && <p className="text-xs text-muted">{t('social.readOnly')}</p>}
    {selectedId && !editing && <CompteSocialDetail id={selectedId} onClose={() => update({ fiche: '' }, false)} canManage={canManage} onEdit={edit} />}
    {editing && canManage && <CompteSocialDialog key={editing.id || 'new'} item={editing} onClose={() => setEditing(null)} onSaved={saved} />}
    {importing && canManage && <ReseauxSociauxImportDialog onClose={() => setImporting(false)} onChanged={invalidate} />}
  </div>;
}
export default function ReseauxSociauxPage() { return <div className="page-container"><ReseauxSociauxWorkspace /></div>; }
