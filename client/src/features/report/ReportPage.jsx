import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, FileText, FlaskConical, LayoutGrid, PanelTop, Printer, ShieldAlert, SlidersHorizontal } from 'lucide-react';
import { addDays, formatDate, todayAlgiers, weekStart } from '@anm/shared';
import { useSearchParams } from 'react-router-dom';
import { Button, EmptyState, ErrorState, LoadingBlock } from '../../components/ui/index.js';
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
  const legacySnapshot = params.get('source') === 'snapshot';
  const snapshotVersion = Number(params.get('version')) || null;
  const [displayWidth, setDisplayWidth] = useState('large');
  const studioActions = useRef(null);
  const [studioState, setStudioState] = useState({ canPersonnaliser: false, peutFiger: false, alreadyFrozen: false, mode: 'lecture', busy: false });
  const registerActions = useCallback((next) => { studioActions.current = next; }, []);
  const onStudioState = useCallback((next) => setStudioState((prev) => (
    Object.keys(next).every((key) => prev[key] === next[key]) ? prev : next
  )), []);

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

  useEffect(() => {
    if (!legacySnapshot) return;
    const next = new URLSearchParams(params);
    next.delete('source');
    setParams(next, { replace: true });
  }, [legacySnapshot, params, setParams]);

  const moveWeek = (days) => updateParams({ semaine: addDays(week, days), version: null });
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
    <div className="sticky top-0 z-20 min-w-0 overflow-hidden no-print" data-report-studio>
      <div className="border-b border-border bg-surface shadow-sm">
        <div className="page-container flex min-w-0 flex-wrap items-center gap-2 py-2">
          <h1 className="shrink-0 truncate text-base font-black lg:text-lg">{t('report.studio.title')}</h1>
          <span className="hidden whitespace-nowrap text-xs text-muted 2xl:inline">{formatDate(week)} → {formatDate(addDays(week, 6))}</span>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-surface2 p-1" data-studio-toolbar>
            <Button size="sm" variant="ghost" className="px-1.5" aria-label={t('common.previous')} onClick={() => moveWeek(-7)}>{dir === 'rtl' ? <ChevronRight className="h-4 w-4" aria-hidden="true" /> : <ChevronLeft className="h-4 w-4" aria-hidden="true" />}</Button>
            <label className="sr-only" htmlFor="report-studio-week">{t('report.studio.week')}</label>
            <input id="report-studio-week" type="date" value={week} onChange={(event) => updateParams({ semaine: weekStart(event.target.value, weekStartDay), version: null })} className="h-8 w-28 min-w-0 rounded-md border border-border bg-surface px-1 text-xs font-bold text-ink sm:w-32" />
            <Button size="sm" variant="ghost" className="px-1.5" aria-label={t('common.next')} onClick={() => moveWeek(7)}>{dir === 'rtl' ? <ChevronLeft className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}</Button>
          </div>
          <nav aria-label={t('report.studio.tools')} className="flex min-w-0 max-w-full flex-1 gap-1 overflow-x-auto pb-1 sm:flex-none">
            {TOOLS.map(({ id, key, icon: Icon }) => <Button key={id} size="sm" variant={tool === id ? 'primary' : 'ghost'} aria-current={tool === id ? 'page' : undefined} aria-label={t(key)} onClick={() => updateParams({ outil: id })} className="shrink-0 px-2 text-xs">
              <Icon className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">{t(key)}</span>
            </Button>)}
          </nav>
          <div className="flex items-center gap-1">
            <SlidersHorizontal className="h-4 w-4 text-muted" aria-hidden="true" />
            <label className="sr-only" htmlFor="report-studio-width">{t('report.studio.displayWidth')}</label>
            <select id="report-studio-width" value={displayWidth} onChange={(event) => setDisplayWidth(event.target.value)} className="h-8 max-w-[9rem] rounded-md border border-border bg-surface px-1 text-xs font-bold text-ink">
              <option value="large">{t('report.studio.widthLarge')}</option>
              <option value="print">{t('report.studio.widthPrint')}</option>
            </select>
          </div>
          {tool === 'composition' && <div className="flex flex-wrap items-center gap-1 ms-auto">
            <Button size="sm" className="px-2 text-xs" aria-label={studioState.mode === 'personnaliser'
              ? (studioState.alreadyFrozen ? t('synthese.modeLecture') : t('synthese.quitterPersonnalisation'))
              : t('synthese.personnaliser')}
              disabled={!studioState.canPersonnaliser || studioState.busy} onClick={() => studioActions.current?.personnaliser()}>
              <span className="hidden lg:inline">{studioState.mode === 'personnaliser'
                ? (studioState.alreadyFrozen ? t('synthese.modeLecture') : t('synthese.quitterPersonnalisation'))
                : t('synthese.personnaliser')}</span>
              <SlidersHorizontal className="h-4 w-4 lg:hidden" aria-hidden="true" />
            </Button>
            <Button size="sm" variant="secondary" className="px-2 text-xs" aria-label={t('synthese.figer')} disabled={!studioState.peutFiger || studioState.busy} onClick={() => studioActions.current?.figer()}>
              <ShieldAlert className="h-4 w-4" aria-hidden="true" /><span className="hidden lg:inline">{t('synthese.figer')}</span>
            </Button>
            <Button size="sm" variant="ghost" className="px-2 text-xs" aria-label={t('common.imprimer')} onClick={() => studioActions.current?.print()}>
              <Printer className="h-4 w-4" aria-hidden="true" /><span className="hidden lg:inline">{t('common.imprimer')}</span>
            </Button>
          </div>}
        </div>
      </div>
    </div>

    <Suspense fallback={contentFallback()}>
      {tool === 'modeles' && <SynthesesPage embedded modeleHref={hrefForModele} />}
      {tool === 'laboratoire' && <LaboratoirePage embedded week={week} />}
      {tool === 'officiel' && <WeeklyReportView week={week} version={snapshotVersion}
        onWeek={(nextWeek) => updateParams({ semaine: nextWeek, version: null })}
        onVersion={(nextVersion) => updateParams({ version: nextVersion ?? null })} />}
      {tool === 'composition' && modelsQuery.isPending && contentFallback()}
      {tool === 'composition' && modelsQuery.isError && <div className="page-container"><ErrorState message={modelsQuery.error?.message || t('error.load')} onRetry={() => modelsQuery.refetch()} /></div>}
      {tool === 'composition' && modelsQuery.isSuccess && !modeleId && <div className="page-container"><EmptyState title={t('report.studio.noWeekly')} description={t('report.studio.noWeeklyHelp')} /></div>}
      {tool === 'composition' && modeleId && <SynthesePage embedded modeleId={modeleId} periodeOverride={period} modeleHref={hrefForModele}
        displayWidth={displayWidth} registerActions={registerActions} onStudioState={onStudioState} />}
    </Suspense>
  </>;
}
