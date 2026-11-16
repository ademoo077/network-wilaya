import { lazy, Suspense, useCallback, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, FileText, FlaskConical, LayoutGrid, PanelTop } from 'lucide-react';
import { addDays, formatDate, todayAlgiers, weekStart } from '@anm/shared';
import { useSearchParams } from 'react-router-dom';
import { Button, Card, EmptyState, ErrorState, LoadingBlock } from '../../components/ui/index.js';
import { useRefs } from '../../context/RefsContext.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { useApiQuery } from '../../hooks/useApiQuery.js';

const SynthesePage = lazy(() => import('../syntheses/SynthesePage.jsx'));
const SynthesesPage = lazy(() => import('../syntheses/SynthesesPage.jsx'));
const LaboratoirePage = lazy(() => import('../syntheses/LaboratoirePage.jsx'));
const WeeklyReportView = lazy(() => import('./WeeklyReportView.jsx'));

const TOOLS = [
  { id: 'composition', key: 'report.studio.compose', icon: PanelTop },
  { id: 'modeles', key: 'report.studio.models', icon: LayoutGrid },
  { id: 'laboratoire', key: 'report.studio.lab', icon: FlaskConical },
  { id: 'officiel', key: 'report.studio.official', icon: FileText },
];

function contentFallback() {
  return <div className="page-container"><LoadingBlock /></div>;
}

export default function ReportPage() {
  const { t, dir } = useI18n();
  const { refs } = useRefs();
  const [params, setParams] = useSearchParams();
  const weekStartDay = Number(refs.parametres.week_start_day) || 0;
  const fallbackWeek = weekStart(todayAlgiers(), weekStartDay);
  const week = params.get('semaine') || fallbackWeek;
  const tool = TOOLS.some((item) => item.id === params.get('outil')) ? params.get('outil') : 'composition';
  const modelsQuery = useApiQuery('/syntheses/modeles');
  const models = modelsQuery.data?.items || [];
  const weeklyModel = models.find((item) => item.cle_systeme === 'hebdomadaire') || null;
  const requestedModel = Number(params.get('modele'));
  const validRequestedModel = Number.isInteger(requestedModel) && requestedModel > 0;
  const requestedExists = validRequestedModel && models.some((item) => item.id === requestedModel);
  const modeleId = requestedExists ? requestedModel : weeklyModel?.id;
  const period = useMemo(() => ({ mode: 'plage', debut: week, fin: addDays(week, 6) }), [week]);

  const updateParams = useCallback((updates, { replace = false } = {}) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === undefined || value === '') next.delete(key);
      else next.set(key, String(value));
    }
    setParams(next, { replace });
  }, [params, setParams]);

  useEffect(() => {
    if (!params.get('semaine')) updateParams({ semaine: fallbackWeek }, { replace: true });
  }, [fallbackWeek, params, updateParams]);

  useEffect(() => {
    if (modelsQuery.isSuccess && validRequestedModel && !requestedExists && weeklyModel) {
      updateParams({ modele: weeklyModel.id, personnaliser: null, source: null }, { replace: true });
    }
  }, [modelsQuery.isSuccess, requestedExists, updateParams, validRequestedModel, weeklyModel]);

  const moveWeek = (days) => updateParams({ semaine: addDays(week, days), source: null, version: null });
  const hrefForModele = useCallback((id, options = {}) => {
    const next = new URLSearchParams(params);
    next.set('semaine', week);
    next.set('outil', 'composition');
    next.set('modele', String(id));
    if (options.personnaliser) next.set('personnaliser', '1'); else next.delete('personnaliser');
    if (options.source) next.set('source', String(options.source)); else next.delete('source');
    next.delete('version');
    return `/rapport?${next}`;
  }, [params, week]);

  return <>
    <div className="page-container pb-0 no-print" data-report-studio>
      <Card className="overflow-hidden border-brand-700 shadow-2">
        <div className="bg-gradient-to-r from-brand-950 to-brand-800 p-5 text-brand-50 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-100">{t('report.studio.eyebrow')}</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div><h1 className="text-2xl font-black sm:text-3xl">{t('report.studio.title')}</h1><p className="mt-1 max-w-3xl text-sm text-brand-100">{t('report.studio.help')}</p></div>
            <div className="rounded-lg border border-brand-700 bg-brand-900 px-4 py-2 text-sm font-bold">{formatDate(week)} → {formatDate(addDays(week, 6))}</div>
          </div>
        </div>
        <div className="grid gap-3 p-3 lg:grid-cols-[auto_1fr] lg:items-center">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-surface2 p-1">
            <Button size="sm" variant="ghost" aria-label={t('common.previous')} onClick={() => moveWeek(-7)}>{dir === 'rtl' ? <ChevronRight aria-hidden="true" /> : <ChevronLeft aria-hidden="true" />}</Button>
            <label className="sr-only" htmlFor="report-studio-week">{t('report.studio.week')}</label>
            <input id="report-studio-week" type="date" value={week} onChange={(event) => updateParams({ semaine: weekStart(event.target.value, weekStartDay), source: null, version: null })} className="h-11 min-w-36 rounded-md border border-border bg-surface px-3 text-sm font-bold text-ink" />
            <Button size="sm" variant="ghost" aria-label={t('common.next')} onClick={() => moveWeek(7)}>{dir === 'rtl' ? <ChevronLeft aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}</Button>
          </div>
          <nav aria-label={t('report.studio.tools')} className="flex gap-2 overflow-x-auto pb-1 lg:justify-end">
            {TOOLS.map(({ id, key, icon: Icon }) => <Button key={id} size="sm" variant={tool === id ? 'primary' : 'ghost'} aria-current={tool === id ? 'page' : undefined} onClick={() => updateParams({ outil: id })} className="shrink-0">
              <Icon className="h-4 w-4" aria-hidden="true" />{t(key)}
            </Button>)}
          </nav>
        </div>
      </Card>
    </div>

    <Suspense fallback={contentFallback()}>
      {tool === 'modeles' && <SynthesesPage embedded modeleHref={hrefForModele} />}
      {tool === 'laboratoire' && <LaboratoirePage />}
      {tool === 'officiel' && <WeeklyReportView />}
      {tool === 'composition' && modelsQuery.isPending && contentFallback()}
      {tool === 'composition' && modelsQuery.isError && <div className="page-container"><ErrorState message={modelsQuery.error?.message || t('error.load')} onRetry={() => modelsQuery.refetch()} /></div>}
      {tool === 'composition' && modelsQuery.isSuccess && !modeleId && <div className="page-container"><EmptyState title={t('report.studio.noWeekly')} description={t('report.studio.noWeeklyHelp')} /></div>}
      {tool === 'composition' && modeleId && <SynthesePage embedded modeleId={modeleId} periodeOverride={period} modeleHref={hrefForModele} />}
    </Suspense>
  </>;
}
