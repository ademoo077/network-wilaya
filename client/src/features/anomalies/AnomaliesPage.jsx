import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, FilterX, ListX, Upload } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { addDays, anomalyAction, formatDate, PERIOD_OPTIONS, todayAlgiers } from '@anm/shared';
import { download, queryString } from '../../api/client.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { Button, Card, EmptyState, Pagination, useToast } from '../../components/ui/index.js';
import ErrorBoundary from '../../components/ErrorBoundary.jsx';
import QueryContent from '../../components/ui/QueryContent.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useRefs } from '../../context/RefsContext.jsx';
import { useApiQuery } from '../../hooks/useApiQuery.js';
import { useDebounced } from '../../hooks/useDebounced.js';
import { useI18n } from '../../i18n/index.jsx';
import AnomalyFilters from './AnomalyFilters.jsx';
import AnomalyTable from './AnomalyTable.jsx';
import AnomalyGallery from './list/AnomalyGallery.jsx';
import AnomalieCarte from './AnomalieCarte.jsx';
import AnomalyActionDialog from './AnomalyActionDialog.jsx';
import BulkStatusDialog from './BulkStatusDialog.jsx';
import ImportAnomaliesDialog from './ImportAnomaliesDialog.jsx';
import QuickViews from './QuickViews.jsx';
import SavedViews from '../views/SavedViews.jsx';
import { photoModeKey } from './photos/usePhotoLibrary.js';
import AnomalyQuickView from './list/AnomalyQuickView.jsx';
import ListSkeleton from './list/ListSkeleton.jsx';
import AnomalyListToolbar from './list/AnomalyListToolbar.jsx';
import useListPreferences from './list/useListPreferences.js';
import { useAnomalyMutation, usePendingAnomalies } from './useAnomalyMutation.js';

const filterLabels = { q: 'common.search', statut: 'field.status', domaine: 'field.category',
  type: 'field.type', daira: 'field.daira', commune: 'field.commune', epic: 'field.epic', agent: 'field.agent',
  plateforme: 'field.platform', priorite: 'field.priority', source: 'v14.source.label', from: 'field.from', to: 'field.to', gps: 'field.gps',
  periode: 'list.period', include_infirmees: 'dashboard.includeDenied', ouvertes: 'dashboard.openStock', retard: 'list.late',
  sla_depassee: 'work.urgent', incompletes: 'work.incomplete', sans_photo: 'work.noPhoto', sans_agent: 'field.agent' };
const periodLabels = Object.fromEntries(PERIOD_OPTIONS.filter(({ value }) => value).map(({ value, label }) => [value, label]));

export default function AnomaliesPage() {
  const { t } = useI18n(); const { user } = useAuth(); const { refs } = useRefs(); const { push } = useToast();
  const queryClient = useQueryClient(); const navigate = useNavigate(); const prefs = useListPreferences(user?.id);
  const [searchParams, setSearchParams] = useSearchParams(); const signature = searchParams.toString();
  const filters = useMemo(() => Object.fromEntries(new URLSearchParams(signature).entries()), [signature]);
  const q = useDebounced(filters.q || '');
  const query = useApiQuery(`/anomalies${queryString({ ...filters, q })}`); const data = query.data; const rows = data?.items || [];
  const [selected, setSelected] = useState([]); const [previewId, setPreviewId] = useState(null); const [bulk, setBulk] = useState(null);
  const [action, setAction] = useState(null); const [exporting, setExporting] = useState(null);
  const [importOpen, setImportOpen] = useState(false); const [activeRow, setActiveRow] = useState(0);
  const [photoMode, setPhotoMode] = useState(() => { try { return localStorage.getItem(photoModeKey(user?.id)) || 'slider'; } catch { return 'slider'; } });
  const { mutate } = useAnomalyMutation(); const pending = usePendingAnomalies(); const writable = user.role !== 'lecteur';
  const rowsRef = useRef(rows); rowsRef.current = rows;
  const selectedRef = useRef(selected); selectedRef.current = selected;
  const previewRef = useRef(previewId); previewRef.current = previewId;
  const activeRef = useRef(activeRow); activeRef.current = activeRow;
  useEffect(() => { setSelected([]); setActiveRow(0); }, [signature]);
  const update = useCallback((changes) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value === '' || value === null || value === undefined || value === false) next.delete(key);
      else next.set(key, String(value));
    }
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);
  const setFilter = (key, value, extra = {}) => update({
    ...(key === 'periode' && !value ? { from: '', to: '' } : {}),
    ...(['from', 'to'].includes(key) ? { periode: '' } : {}),
    [key]: value, ...extra, page: 1,
  });
  const applyFilters = (next) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(next)) if (value !== '' && value !== null && value !== undefined && value !== false) params.set(key, String(value));
    setSearchParams(params, { replace: true });
  };
  const applyPeriod = (value) => {
    if (!value) { update({ periode: '', from: '', to: '', page: 1 }); return; }
    const to = todayAlgiers(); const from = addDays(to, -(Number(value) - 1));
    update({ periode: value, from, to, page: 1 });
  };
  const sort = filters.sort || 'date_signalement'; const dir = filters.dir || 'desc';
  const onSort = useCallback((key) => update({ sort: key, dir: sort === key && dir === 'asc' ? 'desc' : 'asc', page: 1 }), [dir, sort, update]);
  const onAction = useCallback((item, field, value) => {
    if (item[field] === value) return;
    const plan = anomalyAction(item, field, value);
    if (plan.blocked) { push(t(`action.${plan.blocked}`), 'warning'); return; }
    if (field === 'statut' && value === 'traite') { setAction({ item, field, value }); return; }
    if (plan.needsInput) setAction({ item, field, value });
    else mutate({ item, field, body: plan.body });
  }, [mutate, push, t]);
  const openPreview = useCallback((row) => {
    const index = rowsRef.current.findIndex((item) => item.id === row.id);
    if (index >= 0) { setActiveRow(index); activeRef.current = index; }
    setPreviewId(row.id);
  }, []);
  const navigatePreview = useCallback((delta) => {
    const list = rowsRef.current; if (!list.length) return;
    const index = Math.max(0, list.findIndex((item) => item.id === previewRef.current));
    const next = (index + delta + list.length) % list.length;
    setActiveRow(next); activeRef.current = next; setPreviewId(list[next].id);
  }, []);
  useEffect(() => {
    const handler = (event) => {
      if (previewRef.current) return;
      if (event.target instanceof Element && event.target.closest('input, select, textarea, [contenteditable="true"], [role="dialog"]')) return;
      const list = rowsRef.current; if (!list.length) return;
      const focusRow = (index) => document.querySelector(`[data-row-index="${index}"]`)?.focus();
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const next = (activeRef.current + (event.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length;
        activeRef.current = next; setActiveRow(next); focusRow(next);
      } else if (event.key === 'p' || event.key === 'P') {
        event.preventDefault(); setPreviewId(list[activeRef.current]?.id);
      } else if (event.key === 'Enter') {
        event.preventDefault(); if (list[activeRef.current]) navigate(`/anomalies/${list[activeRef.current].id}`);
      } else if (event.key === ' ' && writable) {
        event.preventDefault(); const id = list[activeRef.current]?.id;
        if (id) setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [navigate, writable]);
  const exportFile = async (format) => {
    setExporting(format);
    try { await download(`/anomalies/export${queryString({ ...filters, page: undefined, pageSize: undefined, format })}`, `anomalies.${format}`); push(t('common.success')); }
    catch (error) { push(error.message, 'danger'); } finally { setExporting(null); }
  };
  const active = Object.entries(filters).filter(([key, value]) => filterLabels[key] && value);
  const previewItem = rows.find((row) => row.id === previewId) || null;
  return <div className="page-container">
    <PageHeader title={t('anomalies.title')} description={t('anomalies.count', { count: data?.total || 0 })} actions={<>
      <Button variant="secondary" loading={exporting === 'csv'} disabled={Boolean(exporting)} onClick={() => exportFile('csv')}><Download className="h-4 w-4" />{t('anomalies.exportCsv')}</Button>
      <Button variant="secondary" loading={exporting === 'xlsx'} disabled={Boolean(exporting)} onClick={() => exportFile('xlsx')}><Download className="h-4 w-4" />{t('anomalies.exportXlsx')}</Button>
      {writable && <Button variant="secondary" aria-label={t('import.button')} onClick={() => setImportOpen(true)}><Upload className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">{t('import.button')}</span></Button>}</>} />
    <SavedViews filters={{ ...filters, q }} apply={applyFilters} />
    <QuickViews filters={{ ...filters, q }} update={update} />
    <AnomalyListToolbar prefs={prefs} period={filters.periode || ''} onPeriod={applyPeriod} />
    <details data-filters className="mb-4 rounded-md border border-border bg-surface">
      <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 px-4 text-sm font-bold text-ink">
        {t('common.filters')}
        {active.length > 0 && <span className="rounded-full bg-brand-100 px-2 text-xs text-brand-800">{active.length}</span>}
      </summary>
      <div className="border-t border-border p-4"><AnomalyFilters filters={filters} setFilter={setFilter} refs={refs} /></div>
    </details>
    {active.length > 0 && <div className="mb-4 flex flex-wrap items-center gap-2">{active.map(([key, value]) => <button key={key}
      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-surface px-3 text-xs font-semibold hover:bg-surface2" onClick={() => setFilter(key, '')}>
      <span>{key === 'periode' ? t(periodLabels[value] || filterLabels[key]) : <>{t(filterLabels[key])}: <bdi>{key === 'gps' ? t(`gps.${value}`) : value}</bdi></>}</span><span aria-hidden="true">×</span></button>)}
      <Button size="sm" variant="ghost" onClick={() => setSearchParams({}, { replace: true })}><FilterX className="h-4 w-4" />{t('common.clearFilters')}</Button></div>}
    {query.isFetching && !query.isPending && <p role="status" className="mb-2 text-sm text-muted">{t('common.loading')}</p>}
    <Card className="overflow-hidden"><QueryContent query={query} loading={<ListSkeleton />}>
      <div data-list-mode={prefs.mode} data-list-density={prefs.density}>
        {rows.length ? <><div className="min-w-0">
          {prefs.mode === 'galerie' ? <AnomalyGallery rows={rows} selected={selected} onSelect={setSelected}
            onPreview={openPreview} writable={writable} activeIndex={activeRow}
            onRowFocus={(row, index) => { activeRef.current = index; setActiveRow(index); }} />
            : <AnomalyTable rows={rows} selected={selected} onSelect={setSelected} sort={sort} dir={dir}
              onSort={onSort} onPreview={openPreview} writable={writable} onAction={onAction} pending={pending}
              columns={prefs.columns} mode={prefs.mode} density={prefs.density} activeIndex={activeRow}
              widths={prefs.widths} onResizeColumn={(key, width) => prefs.setWidth(key, width)}
              onRowFocus={(row, index) => { activeRef.current = index; setActiveRow(index); }} />}
        </div>
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={(page) => update({ page })} onPageSize={(pageSize) => update({ pageSize, page: 1 })} /></>
          : <EmptyState icon={ListX} title={t('anomalies.empty')} action={writable && <Button as={Link} to="/anomalies/nouvelle">{t('nav.new')}</Button>} />}
      </div>
    </QueryContent></Card>
    {selected.length > 0 && writable && <Card className="sticky bottom-0 z-40 mt-4 flex flex-wrap items-center gap-3 p-3">
      <span>{t('anomalies.selected', { count: selected.length })}</span><Button onClick={() => setBulk({ ids: selected, statut: 'en_cours' })}>{t('anomalies.bulk')}</Button><Button variant="ghost" onClick={() => setSelected([])}>{t('common.cancel')}</Button>
    </Card>}
    <ErrorBoundary fallback={<p role="alert" className="text-sm text-danger">{t('common.error')}</p>}>
      <AnomalyQuickView item={previewItem} items={rows} mode={photoMode}
        onMode={(value) => { setPhotoMode(value); try { localStorage.setItem(photoModeKey(user?.id), value); } catch { /* stockage indisponible */ } }}
        onNavigate={navigatePreview} onClose={() => setPreviewId(null)} />
    </ErrorBoundary>
    {bulk && <BulkStatusDialog open ids={bulk.ids} initialStatus={bulk.statut} onClose={() => setBulk(null)} onDone={() => query.refetch()} />}
    {action && <AnomalyActionDialog item={action.item} action={action} onClose={() => setAction(null)} />}
    {importOpen && <ImportAnomaliesDialog open onClose={() => setImportOpen(false)} refs={refs} onImported={() => { query.refetch(); queryClient.invalidateQueries({ queryKey: ['stats'] }); }} />}

    {/* === FIL (V16) === */}
    <section data-fil-section aria-label={t('anomalies.fil.title')}>
      <header className="flex items-center justify-between gap-3 px-3 py-2 mb-2 rounded-lg border border-border bg-surface">
        <div className="flex items-center gap-2">
          <span className="font-bold">{t('anomalies.fil.aujourdHui')} · {formatDate(todayAlgiers())}</span>
          <span className="text-xs text-muted">{t('anomalies.fil.resume', { signalees: data?.resume?.signalees ?? 0, urgentes: data?.resume?.urgentes ?? 0, en_cours: data?.resume?.en_cours ?? 0, traitees: data?.resume?.traitees ?? 0 })}</span>
        </div>
        <div className="flex gap-1 rounded-md border border-border bg-surface px-2 py-1 text-xs">
          <button role="tab" aria-selected="true" className="px-2 py-1 text-ink font-medium">{t('anomalies.fil.tabSignalees')}</button>
          <button role="tab" aria-selected="false" className="px-2 py-1 text-muted">{t('anomalies.fil.tabTraitees')}</button>
          <button role="tab" aria-selected="false" className="px-2 py-1 text-muted">{t('anomalies.fil.tabMaj')}</button>
        </div>
      </header>

      {rows.length ? (
        <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map((row, index) => (
            <AnomalieCarte key={row.id} row={row} index={index}
              selected={selected} onSelect={setSelected} onPreview={openPreview} writable={writable}
              active={activeRow === index} onRowFocus={(r, i) => { activeRef.current = i; setActiveRow(i); }}
            />
          ))}
        </div>
      ) : (
        <EmptyState icon={ListX} title={t('anomalies.fil.empty')} action={writable && <Button as={Link} to="/anomalies/nouvelle">{t('nav.new')}</Button>} />
      )}
    </section>

</div>
}
