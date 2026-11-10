import { useEffect, useMemo, useState } from 'react';
import { Download, FilterX, ListX, Plus } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { anomalyAction } from '@anm/shared';
import { download, queryString } from '../../api/client.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { Button, Card, EmptyState, Pagination, useToast } from '../../components/ui/index.js';
import QueryContent from '../../components/ui/QueryContent.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useRefs } from '../../context/RefsContext.jsx';
import { useApiQuery } from '../../hooks/useApiQuery.js';
import { useDebounced } from '../../hooks/useDebounced.js';
import { useI18n } from '../../i18n/index.jsx';
import AnomalyFilters from './AnomalyFilters.jsx';
import AnomalyPreview from './AnomalyPreview.jsx';
import AnomalyTable from './AnomalyTable.jsx';
import AnomalyActionDialog from './AnomalyActionDialog.jsx';
import BulkStatusDialog from './BulkStatusDialog.jsx';
import QuickViews from './QuickViews.jsx';
import SavedViews from '../views/SavedViews.jsx';
import { useAnomalyMutation, usePendingAnomalies } from './useAnomalyMutation.js';

const filterLabels = { q: 'common.search', statut: 'field.status', verification: 'field.verification', domaine: 'field.category',
  type: 'field.type', daira: 'field.daira', commune: 'field.commune', epic: 'field.epic', agent: 'field.agent',
  plateforme: 'field.platform', priorite: 'field.priority', from: 'field.from', to: 'field.to', gps: 'field.gps',
  include_infirmees: 'dashboard.includeDenied', ouvertes: 'dashboard.openStock', retard: 'list.late',
  verification_retard: 'work.verification', sla_depassee: 'work.urgent', incompletes: 'work.incomplete', sans_photo: 'work.noPhoto', sans_agent: 'field.agent' };

export default function AnomaliesPage() {
  const { t } = useI18n(); const { user } = useAuth(); const { refs } = useRefs(); const { push } = useToast();
  const [searchParams, setSearchParams] = useSearchParams(); const signature = searchParams.toString();
  const filters = useMemo(() => Object.fromEntries(new URLSearchParams(signature).entries()), [signature]);
  const q = useDebounced(filters.q || '');
  const query = useApiQuery(`/anomalies${queryString({ ...filters, q })}`); const data = query.data;
  const [selected, setSelected] = useState([]); const [preview, setPreview] = useState(null); const [bulk, setBulk] = useState(null);
  const [action, setAction] = useState(null); const [exporting, setExporting] = useState(null);
  const mutation = useAnomalyMutation(); const pending = usePendingAnomalies();
  const writable = user.role !== 'lecteur';
  useEffect(() => { setSelected([]); }, [signature]);
  const update = (changes) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value === '' || value === null || value === undefined || value === false) next.delete(key);
      else next.set(key, String(value));
    }
    setSearchParams(next, { replace: true });
  };
  const setFilter = (key, value, extra = {}) => update({ [key]: value, ...extra, page: 1 });
  const applyFilters = (next) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(next)) if (value !== '' && value !== null && value !== undefined && value !== false) params.set(key, String(value));
    setSearchParams(params, { replace: true });
  };
  const sort = filters.sort || 'date_signalement'; const dir = filters.dir || 'desc';
  const onAction = (item, field, value) => {
    if (item[field] === value) return;
    const plan = anomalyAction(item, field, value);
    if (plan.blocked) { push(t(`action.${plan.blocked}`), 'warning'); return; }
    if (plan.needsInput) setAction({ item, field, value });
    else mutation.mutate({ item, field, body: plan.body });
  };
  const exportFile = async (format) => {
    setExporting(format);
    try { await download(`/anomalies/export${queryString({ ...filters, page: undefined, pageSize: undefined, format })}`, `anomalies.${format}`); push(t('common.success')); }
    catch (error) { push(error.message, 'danger'); } finally { setExporting(null); }
  };
  const active = Object.entries(filters).filter(([key, value]) => filterLabels[key] && value);
  return <div className="page-container">
    <PageHeader title={t('anomalies.title')} description={t('anomalies.count', { count: data?.total || 0 })} actions={<>
      {['csv', 'xlsx'].map((format) => <Button key={format} variant="secondary" loading={exporting === format} disabled={Boolean(exporting)} onClick={() => exportFile(format)}><Download className="h-4 w-4" />{format === 'csv' ? 'CSV' : 'Excel'}</Button>)}
      {writable && <Button as={Link} to="/anomalies/nouvelle"><Plus className="h-4 w-4" />{t('nav.new')}</Button>}</>} />
    <SavedViews filters={{ ...filters, q }} apply={applyFilters} />
    <QuickViews filters={{ ...filters, q }} update={update} />
    <AnomalyFilters filters={filters} setFilter={setFilter} refs={refs} />
    {active.length > 0 && <div className="mb-4 flex flex-wrap items-center gap-2">{active.map(([key, value]) => <button key={key}
      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-surface px-3 text-xs font-semibold hover:bg-surface2" onClick={() => setFilter(key, '')}>
      <span>{t(filterLabels[key])}: <bdi>{key === 'gps' ? t(`gps.${value}`) : value}</bdi></span><span aria-hidden="true">×</span></button>)}
      <Button size="sm" variant="ghost" onClick={() => setSearchParams({}, { replace: true })}><FilterX className="h-4 w-4" />{t('common.clearFilters')}</Button></div>}
    {query.isFetching && !query.isPending && <p role="status" className="mb-2 text-sm text-muted">{t('common.loading')}</p>}
    <Card className="overflow-hidden"><QueryContent query={query}>
      {data?.items?.length ? <><AnomalyTable rows={data.items} selected={selected} onSelect={setSelected} sort={sort} dir={dir}
        onSort={(key) => update({ sort: key, dir: sort === key && dir === 'asc' ? 'desc' : 'asc', page: 1 })}
        onPreview={setPreview} writable={writable} onAction={onAction} pending={pending} />
        <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={(page) => update({ page })} onPageSize={(pageSize) => update({ pageSize, page: 1 })} /></>
        : <EmptyState icon={ListX} title={t('anomalies.empty')} action={writable && <Button as={Link} to="/anomalies/nouvelle">{t('nav.new')}</Button>} />}
    </QueryContent></Card>
    {selected.length > 0 && writable && <Card className="sticky bottom-0 z-40 mt-4 flex flex-wrap items-center gap-3 p-3">
      <span>{t('anomalies.selected', { count: selected.length })}</span><Button onClick={() => setBulk({ ids: selected, statut: 'en_cours' })}>{t('anomalies.bulk')}</Button><Button variant="ghost" onClick={() => setSelected([])}>{t('common.cancel')}</Button>
    </Card>}
    <AnomalyPreview item={preview ? data?.items?.find((row) => row.id === preview.id) || preview : null} onClose={() => setPreview(null)} />
    {bulk && <BulkStatusDialog open ids={bulk.ids} initialStatus={bulk.statut} onClose={() => setBulk(null)} onDone={() => query.refetch()} />}
    {action && <AnomalyActionDialog item={action.item} action={action} onClose={() => setAction(null)} />}
  </div>;
}
