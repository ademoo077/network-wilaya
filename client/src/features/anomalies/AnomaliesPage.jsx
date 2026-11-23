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
  const isFil = prefs.mode === 'fil';
  const jour = filters.jour || 'aujourdhui';
  const groupeFil = filters.groupe || 'date';
  const [filLimit, setFilLimit] = useState(24);
  const filSentinelRef = useRef(null);
  useEffect(() => { setFilLimit(24); }, [signature, jour, groupeFil]);
  const query = useApiQuery(isFil ? `/anomalies/fil${queryString({ ...filters, q, limite: filLimit })}` : `/anomalies${queryString({ ...filters, q })}`);
  const data = query.data;
  const rows = data?.items || data?.data || data?.groupes?.flatMap(g => g.items) || [];
  const filTotal = isFil ? (data?.groupes?.reduce((s, g) => s + (g.total || 0), 0) || 0) : 0;
  useEffect(() => {
    if (!isFil || !filSentinelRef.current) return;
    if (rows.length >= filTotal) return;
    const obs = new IntersectionObserver((entries) => { if (entries[0]?.isIntersecting) setFilLimit((n) => n + 24); }, { rootMargin: '200px' });
    obs.observe(filSentinelRef.current);
    return () => obs.disconnect();
  }, [isFil, rows.length, filTotal]);
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
  const count = isFil ? (data?.resume?.signalees ?? 0) : (data?.total ?? 0);
  return <div className="page-container">
    <PageHeader title={t('anomalies.title')} description={t('anomalies.count', { count })} actions={<>
      <Button variant="secondary" loading={exporting === 'csv'} disabled={Boolean(exporting)} onClick={() => exportFile('csv')}><Download className="h-4 w-4" />{t('anomalies.exportCsv')}</Button>
      <Button variant="secondary" loading={exporting === 'xlsx'} disabled={Boolean(exporting)} onClick={() => exportFile('xlsx')}><Download className="h-4 w-4" />{t('anomalies.exportXlsx')}</Button>
      {writable && <Button variant="secondary" aria-label={t('import.button')} onClick={() => setImportOpen(true)}><Upload className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">{t('import.button')}</span></Button>}</>} />
    <SavedViews filters={{ ...filters, q }} apply={applyFilters} />
    <QuickViews filters={{ ...filters, q }} update={update} />
    <AnomalyListToolbar prefs={prefs} period={filters.periode || ''} onPeriod={applyPeriod} />
    <details data-filters open={active.length > 0 || !isFil} className="mb-4 rounded-md border border-border bg-surface">
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
    {!isFil && <Card className="overflow-hidden"><QueryContent query={query} loading={<ListSkeleton />}>
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
    </QueryContent></Card>}
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
    {isFil && (
      <section data-fil-section aria-label={t('anomalies.fil.title')}>
        <header className="mb-3 rounded-lg border border-border bg-surface p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-bold">{t('anomalies.fil.aujourdHui')} · {formatDate(todayAlgiers())}</h2>
              <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                <span className="rounded-full bg-surface2 px-2 py-0.5 font-semibold text-ink2">{data?.resume?.signalees ?? 0} {t('anomalies.fil.tabSignalees')}</span>
                <span className="rounded-full bg-stnonbg px-2 py-0.5 font-semibold text-stnon">{data?.resume?.urgentes ?? 0} {t('priority.urgente')}</span>
                <span className="rounded-full bg-stcoursbg px-2 py-0.5 font-semibold text-stcours">{data?.resume?.en_cours ?? 0} {t('status.en_cours')}</span>
                <span className="rounded-full bg-straitebg px-2 py-0.5 font-semibold text-straite">{data?.resume?.traite ?? 0} {t('status.traite')}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {[['aujourdhui', 'anomalies.fil.tabSignalees'], ['traitees', 'anomalies.fil.tabTraitees'], ['maj', 'anomalies.fil.tabMaj']].map(([val, label]) => (
                <button key={val} type="button" onClick={() => update({ jour: val, page: 1 })}
                  className={`min-h-11 rounded-full border px-3 text-xs font-semibold ${jour === val ? 'border-brand-500 bg-brand-100 text-brand-800' : 'border-border bg-surface text-ink-2 hover:bg-surface2'}`}
                  aria-pressed={jour === val}>{t(label)}</button>
              ))}
              <label className="flex items-center gap-1 text-xs text-ink-2">
                <span>{t('anomalies.fil.groupBy')}</span>
                <select className="min-h-11 rounded-md border border-border bg-surface px-2 text-xs" value={groupeFil} onChange={(e) => update({ groupe: e.target.value, page: 1 })}>
                  <option value="date">{t('field.date_signalement')}</option>
                  <option value="commune">{t('field.commune')}</option>
                  <option value="daira">{t('field.daira')}</option>
                  <option value="agent">{t('field.agent')}</option>
                  <option value="categorie">{t('field.domaine')}</option>
                  <option value="statut">{t('field.statut')}</option>
                </select>
              </label>
            </div>
          </div>
        </header>

        {query.isError ? (
          <p role="alert" className="rounded-md border border-danger bg-surface p-4 text-sm text-danger">{t('common.error')}</p>
        ) : query.isPending ? (
          <ListSkeleton />
        ) : data?.groupes?.length ? (
          (() => {
            const today = todayAlgiers();
            const yesterday = addDays(today, -1);
            const weekStart = addDays(today, -((new Date(today + 'T00:00:00Z').getUTCDay() + 6) % 7));
            const lastWeekStart = addDays(weekStart, -7);
            const monthStart = today.slice(0, 7) + '-01';
            const bucketOf = (cle) => {
              if (!cle) return 'older';
              if (cle === today) return 'today';
              if (cle === yesterday) return 'yesterday';
              if (cle >= weekStart) return 'week';
              if (cle >= lastWeekStart) return 'lastweek';
              if (cle >= monthStart) return 'month';
              return 'older';
            };
            const labels = { today: t('anomalies.fil.aujourdHui'), yesterday: t('common.yesterday'), week: t('anomalies.fil.thisWeek', { defaultValue: 'Cette semaine' }), lastweek: t('anomalies.fil.lastWeek', { defaultValue: 'Semaine dernière' }), month: t('anomalies.fil.thisMonth', { defaultValue: 'Ce mois' }), older: t('anomalies.fil.older', { defaultValue: 'Plus ancien' }) };
            const order = ['today', 'yesterday', 'week', 'lastweek', 'month', 'older'];
            const displayGroupes = groupeFil === 'date'
              ? order.map((k) => {
                  const src = data.groupes.filter((g) => bucketOf(g.cle) === k);
                  if (!src.length) return null;
                  const items = src.flatMap((g) => g.items || []);
                  const par = src.reduce((a, g) => ({ non_traite: a.non_traite + (g.par_statut?.non_traite || 0), en_cours: a.en_cours + (g.par_statut?.en_cours || 0), traite: a.traite + (g.par_statut?.traite || 0) }), { non_traite: 0, en_cours: 0, traite: 0 });
                  return { cle: k, libelle: labels[k], total: src.reduce((s, g) => s + (g.total || 0), 0), par_statut: par, items };
                }).filter(Boolean)
              : data.groupes;
            return displayGroupes.map((groupe) => {
              const total = groupe.total || 0;
              const nt = groupe.par_statut?.non_traite || 0;
              const ec = groupe.par_statut?.en_cours || 0;
              const tr = groupe.par_statut?.traite || 0;
              return (
                <details key={groupe.cle || 'groupe'} open className="mb-4 rounded-md border border-border bg-surface">
                  <summary className="sticky top-0 z-10 flex min-h-11 cursor-pointer items-center justify-between gap-2 border-b border-border bg-surface px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-bold">{groupe.libelle} ({total})</span>
                      <span className="hidden h-2 w-24 overflow-hidden rounded-full bg-surface2 sm:flex" aria-hidden="true">
                        <span className="bg-stnon" style={{ width: `${total ? (nt / total) * 100 : 0}%` }} />
                        <span className="bg-stcours" style={{ width: `${total ? (ec / total) * 100 : 0}%` }} />
                        <span className="bg-straite" style={{ width: `${total ? (tr / total) * 100 : 0}%` }} />
                      </span>
                    </div>
                    {groupeFil === 'date' && typeof groupe.cle === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(groupe.cle) && <Link to={`/anomalies?from=${groupe.cle}&to=${groupe.cle}`} onClick={(e) => e.stopPropagation()} className="text-xs text-brand-700 hover:underline">{t('anomalies.fil.voirTableau')}</Link>}
                  </summary>
                  <div className="mx-auto grid max-w-6xl gap-4 p-3 sm:grid-cols-2 xl:grid-cols-3">
                    {groupe.items.map((row, index) => (
                      <AnomalieCarte key={row.id} row={row} index={index}
                        selected={selected} onSelect={setSelected} onPreview={openPreview} writable={writable}
                        active={activeRow === index} onRowFocus={(r, i) => { activeRef.current = i; setActiveRow(i); }}
                      />
                    ))}
                  </div>
                </details>
              );
            });
          })()
        ) : (
          <EmptyState icon={ListX} title={t('anomalies.fil.empty')} action={writable && <Button as={Link} to="/anomalies/nouvelle">{t('nav.new')}</Button>} />
        )}
        {data?.groupes?.length > 0 && rows.length < filTotal && (
          <div className="mb-6 flex flex-col items-center gap-2">
            <div ref={filSentinelRef} aria-hidden="true" />
            <Button variant="secondary" onClick={() => setFilLimit((n) => n + 24)}>{t('common.loadMore')}</Button>
          </div>
        )}
      </section>
    )}

</div>
}
