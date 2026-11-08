import { useEffect, useMemo, useState } from 'react';
import { Download, FilterX, ListX, Plus } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, download, queryString } from '../../api/client.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { Button, Card, EmptyState, ErrorState, LoadingBlock, Pagination, useToast } from '../../components/ui/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useRefs } from '../../context/RefsContext.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { useI18n } from '../../i18n/index.jsx';
import AnomalyFilters from './AnomalyFilters.jsx';
import AnomalyPreview from './AnomalyPreview.jsx';
import AnomalyTable from './AnomalyTable.jsx';
import BulkStatusDialog from './BulkStatusDialog.jsx';

const filterLabels = {
  q: 'common.search', statut: 'field.status', verification: 'field.verification', domaine: 'field.category',
  type: 'field.type', daira: 'field.daira', commune: 'field.commune', epic: 'field.epic', agent: 'field.agent',
  plateforme: 'field.platform', priorite: 'field.priority', from: 'field.from', to: 'field.to',
  include_infirmees: 'dashboard.includeDenied',
};

export default function AnomaliesPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { refs } = useRefs();
  const { push } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const signature = searchParams.toString();
  const filters = useMemo(() => Object.fromEntries(new URLSearchParams(signature).entries()), [signature]);
  const { data, loading, error, reload } = useFetch(() => api(`/anomalies${signature ? `?${signature}` : ''}`), [signature]);
  const [selected, setSelected] = useState([]);
  const [preview, setPreview] = useState(null);
  const [bulk, setBulk] = useState(null);
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
  const reset = () => setSearchParams({}, { replace: true });
  const sort = filters.sort || 'date_signalement';
  const dir = filters.dir || 'desc';
  const onSort = (key) => update({ sort: key, dir: sort === key && dir === 'asc' ? 'desc' : 'asc', page: 1 });
  const exportFile = async (format) => {
    try {
      const exportFilters = { ...filters, page: undefined, pageSize: undefined, format };
      await download(`/anomalies/export${queryString(exportFilters)}`, `anomalies.${format}`);
    } catch (requestError) { push(requestError.message, 'danger'); }
  };
  const active = Object.entries(filters).filter(([key, value]) => filterLabels[key] && value);
  return <div className="page-container"><PageHeader title={t('anomalies.title')} description={t('anomalies.count', { count: data?.total || 0 })} actions={<><Button variant="secondary" onClick={() => exportFile('csv')}><Download className="h-4 w-4" />CSV</Button><Button variant="secondary" onClick={() => exportFile('xlsx')}><Download className="h-4 w-4" />Excel</Button>{writable && <Button as={Link} to="/anomalies/nouvelle"><Plus className="h-4 w-4" />{t('nav.new')}</Button>}</>} /><AnomalyFilters filters={filters} setFilter={setFilter} refs={refs} />{active.length > 0 && <div className="mb-4 flex flex-wrap items-center gap-2">{active.map(([key, value]) => <button key={key} className="inline-flex min-h-9 items-center gap-2 rounded-full border border-border bg-surface px-3 text-xs font-semibold hover:bg-surface2" onClick={() => setFilter(key, '')}><span>{t(filterLabels[key])}: <bdi>{value}</bdi></span><span aria-hidden="true">×</span></button>)}<Button size="sm" variant="ghost" onClick={reset}><FilterX className="h-4 w-4" />{t('common.clearFilters')}</Button></div>}<Card className="overflow-hidden">{loading ? <div className="p-5"><LoadingBlock /></div> : error ? <ErrorState message={error.message} onRetry={reload} /> : data?.items?.length ? <><AnomalyTable rows={data.items} selected={selected} onSelect={setSelected} sort={sort} dir={dir} onSort={onSort} onPreview={setPreview} writable={writable} onStatus={(row, statut) => setBulk({ ids: [row.id], statut })} /><Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={(page) => update({ page })} onPageSize={(pageSize) => update({ pageSize, page: 1 })} /></> : <EmptyState icon={ListX} title={t('anomalies.empty')} action={writable && <Button as={Link} to="/anomalies/nouvelle">{t('nav.new')}</Button>} />}</Card>{selected.length > 0 && writable && <div className="fixed bottom-4 start-1/2 z-50 flex max-w-[calc(100%-32px)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-lg border border-border bg-surface p-3 shadow-3"><span className="px-2 text-sm font-bold">{t('anomalies.selected', { count: selected.length })}</span>{['en_cours', 'traite', 'non_traite'].map((statut) => <Button key={statut} size="sm" variant={statut === 'non_traite' ? 'secondary' : 'primary'} onClick={() => setBulk({ ids: selected, statut })}>{t(`status.${statut}`)}</Button>)}</div>}<AnomalyPreview item={preview} onClose={() => setPreview(null)} /><BulkStatusDialog open={Boolean(bulk)} ids={bulk?.ids || []} initialStatus={bulk?.statut} onClose={() => setBulk(null)} onDone={async () => { await reload(); if (bulk?.ids?.length > 1) setSelected([]); }} /></div>;
}
