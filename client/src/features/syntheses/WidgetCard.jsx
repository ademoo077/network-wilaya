import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate, formatValue } from '@anm/shared';
import { colonnesAffichees, colonnesEquilibrees } from '@anm/shared';
import {
  classeAccentStyle, classeAlignementStyle, classeDensiteStyle, normaliserStyle,
} from '@anm/shared';
import { api, queryString } from '../../api/client.js';
import { ErrorBoundary } from '../../components/ErrorBoundary.jsx';
import { Button, Card, CardHeader, EmptyState, Skeleton } from '../../components/ui/index.js';
import {
  chartData, dimensionLabel, dimsOf, measureLabel, mesuresOf,
  rowDimensionLabel, rowsOf,
} from './widgetData.js';
import { WidgetActionBar, WidgetDialogs } from './WidgetActions.jsx';

const ROWS_PER_PAGE = 12;
const COLORS = ['var(--brand-600)', 'var(--brand-500)', 'var(--brand-800)', 'var(--brand-900)', 'var(--brand-700)'];
function colorFor(index) { return COLORS[index % COLORS.length]; }

function ChartLegend({ items, t, className = '' }) {
  return <ul className={`mt-2 flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-ink2 ${className}`} aria-label={t('synthese.action.data')} data-chart-legend>
    {items.map((item, index) => <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-2">
      <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: item.color }} aria-hidden="true" />
      <bdi className="min-w-0 truncate">{item.label}</bdi>
      {item.value && <bdi dir="ltr" className="shrink-0 font-bold tabular-nums text-ink">{item.value}</bdi>}
    </li>)}
  </ul>;
}

function heightClass(bloc) {
  if (bloc.options?.hauteur === 'compacte') return 'h-[220px]';
  if (bloc.options?.hauteur === 'grande') return 'h-[380px]';
  return 'h-[280px]';
}
function firstValue(result, id) { return rowsOf(result)[0]?.valeurs?.[id] ?? null; }
function firstVariation(result, id) { return rowsOf(result)[0]?.comparaison?.[id] ?? null; }

function summary(data, measures, lang) {
  return data.slice(0, 12).map((row) => `${row.name}: ${measures.map((m) => `${measureLabel(m.id, lang)} ${row[m.id]}`).join(', ')}`).join('; ');
}

function BarresChart({ result, title, lang, dir, height, actions, t }) {
  const data = chartData(result, lang).slice(0, 12);
  const measures = mesuresOf(result);
  return <>
    <CardHeader title={title} action={actions} />
    <p className="sr-only">{summary(data, measures, lang)}</p>
    <div className={`${height} w-full`} aria-hidden="true" data-chart>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart accessibilityLayer={false} data={data} margin={{ top: 20, right: 16, bottom: 52, left: 24 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--ink-2)' }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} interval={0} angle={-20} textAnchor="end" height={64} />
          <YAxis allowDecimals={false} orientation={dir === 'rtl' ? 'right' : 'left'} tick={{ fontSize: 10, fill: 'var(--ink-2)' }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
          <Tooltip />
          {measures.map((measure, index) => <Bar key={measure.id} dataKey={measure.id} name={measureLabel(measure.id, lang)} fill={colorFor(index)} radius={[4, 4, 0, 0]}>
            {measures.length === 1 && <LabelList dataKey={measure.id} position="top" formatter={(value) => formatValue(value, measure.format || 'entier', lang)} style={{ fontSize: 10, fill: 'var(--ink-2)' }} />}
          </Bar>)}
        </BarChart>
      </ResponsiveContainer>
    </div>
    <ChartLegend t={t} items={measures.map((measure, index) => ({
      label: measureLabel(measure.id, lang),
      color: colorFor(index),
      value: formatValue(data.reduce((sum, row) => sum + Number(row[measure.id] || 0), 0), measure.format || 'entier', lang),
    }))} />
  </>;
}

function CourbeChart({ result, title, lang, dir, height, actions, t }) {
  const data = chartData(result, lang).slice(0, 40);
  const measures = mesuresOf(result);
  return <>
    <CardHeader title={title} action={actions} />
    <p className="sr-only">{summary(data, measures, lang)}</p>
    <div className={`${height} w-full`} aria-hidden="true" data-chart>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart accessibilityLayer={false} data={data} margin={{ top: 20, right: 16, bottom: 52, left: 24 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--ink-2)' }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} interval="preserveStartEnd" />
          <YAxis allowDecimals={false} orientation={dir === 'rtl' ? 'right' : 'left'} tick={{ fontSize: 10, fill: 'var(--ink-2)' }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
          <Tooltip />
          {measures.map((measure, index) => <Line key={measure.id} type="monotone" dataKey={measure.id} name={measureLabel(measure.id, lang)} stroke={colorFor(index)} strokeWidth={2.5} dot={data.length < 15} />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
    <ChartLegend t={t} items={measures.map((measure, index) => ({
      label: measureLabel(measure.id, lang),
      color: colorFor(index),
      value: formatValue(data.reduce((sum, row) => sum + Number(row[measure.id] || 0), 0), measure.format || 'entier', lang),
    }))} />
  </>;
}

function AnneauChart({ result, title, t, lang, actions }) {
  const measure = mesuresOf(result)[0];
  const data = chartData(result, lang).slice(0, 8).map((row) => ({ name: row.name, value: row[measure?.id] || 0 }));
  const total = data.reduce((sum, row) => sum + row.value, 0);
  return <>
    <CardHeader title={title} action={actions} />
    <p className="sr-only">{data.map((row) => `${row.name}: ${row.value}`).join('; ')}</p>
    <div className="h-56 w-full" aria-hidden="true" data-anneau-chart data-chart>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart accessibilityLayer={false} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Pie rootTabIndex={-1} dataKey="value" nameKey="name" data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={82} paddingAngle={2}>
            {data.map((entry, index) => <Cell key={`${entry.name}-${index}`} fill={colorFor(index)} stroke="var(--surface)" />)}
          </Pie><Tooltip />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-x-0 top-0 grid h-56 place-items-center"><div className="text-center"><div className="text-2xl font-black text-ink"><bdi dir="ltr">{formatValue(total, 'entier', lang)}</bdi></div><div className="text-xs text-muted">{t('common.total')}</div></div></div>
    </div>
    <div data-anneau-legend><ChartLegend t={t} className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2" items={data.map((row, index) => ({
      label: row.name,
      color: colorFor(index),
      value: `${formatValue(row.value, 'entier', lang)} · ${formatValue(total ? (row.value / total) * 100 : 0, 'pourcentage', lang)}`,
    }))} /></div>
  </>;
}

function MiniChart({ result, lang, t }) {
  const data = chartData(result, lang).slice(0, 12);
  const measures = mesuresOf(result);
  return <div className="mb-3" data-chart>
    <div className="h-36 w-full" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 8, bottom: 6, left: 8 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--ink-2)' }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} interval={0} height={26} />
          <YAxis allowDecimals={false} width={34} tick={{ fontSize: 9, fill: 'var(--ink-2)' }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
          <Tooltip />
          {measures.map((measure, index) => <Bar key={measure.id} dataKey={measure.id} name={measureLabel(measure.id, lang)} fill={colorFor(index)} radius={[3, 3, 0, 0]} />)}
        </BarChart>
      </ResponsiveContainer>
    </div>
    <ChartLegend t={t} className="mt-1 text-[11px]" items={measures.map((measure, index) => ({ label: measureLabel(measure.id, lang), color: colorFor(index) }))} />
    <p className="sr-only">{t('synthese.action.data')} : {summary(data, measures, lang)}</p>
  </div>;
}

function TableauWidget({ bloc, result, title, lang, dir, t, actions, role }) {
  const rows = rowsOf(result);
  const [page, setPage] = useState(0);
  const colonnes = colonnesAffichees(bloc, result, { role });
  const dims = colonnes.length ? colonnes : dimsOf(result).map((dimension) => ({
    id: dimension.champ,
    source: 'dimension',
    champ: dimension.champ,
    format: 'entier',
    align: 'left',
    label_fr: dimensionLabel(dimension.champ, lang),
    label_ar: dimensionLabel(dimension.champ, lang),
  })).concat(mesuresOf(result).map((measure) => ({
    id: measure.id,
    source: 'mesure',
    champ: measure.id,
    format: measure.format,
    align: 'right',
    label_fr: measureLabel(measure.id, lang),
    label_ar: measureLabel(measure.id, lang),
  })));
  const totalPages = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));
  const pageRows = rows.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE);
  const Previous = dir === 'rtl' ? ChevronRight : ChevronLeft;
  const Next = dir === 'rtl' ? ChevronLeft : ChevronRight;
  return <>
    <CardHeader title={title} action={actions} />
    {bloc.options?.avec_graphique && <MiniChart result={result} lang={lang} t={t} />}
    <div className="overflow-x-auto rounded-md border border-border lg:overflow-x-visible" role="region" aria-label={title} tabIndex={0}>
      <table className="w-full text-sm" data-widget-table><thead className="sticky top-0 z-10 bg-surface2"><tr>{dims.map((column, index) => <th key={`${column.id}-${index}`} className={`border-b border-border px-2 py-2 text-xs font-bold text-ink2 lg:px-3 ${column.align === 'right' ? 'text-end' : column.align === 'center' ? 'text-center' : 'text-start'}`}>{lang === 'ar' ? column.label_ar : column.label_fr}</th>)}</tr></thead>
        <tbody>{pageRows.length === 0 ? <tr><td colSpan={Math.max(1, dims.length)} className="px-4 py-5 text-center text-muted">{t('synthese.aucuneLigne')}</td></tr> : pageRows.map((row, rowIndex) => <tr key={rowIndex} className="border-b border-border last:border-0">
          {dims.map((column, index) => {
            if (column.source === 'dimension') {
              return <td key={`${column.id}-${index}`} className={`px-2 py-2 text-ink lg:px-3 ${column.align === 'right' ? 'text-end' : column.align === 'center' ? 'text-center' : 'text-start'}`}><bdi>{rowDimensionLabel(row, { id: column.champ, champ: column.champ }, index, lang)}</bdi></td>;
            }
            return <td key={`${column.id}-${index}`} className={`px-2 py-2 tabular-nums text-ink lg:px-3 ${column.align === 'right' ? 'text-end' : column.align === 'center' ? 'text-center' : 'text-start'}`}><bdi dir="ltr">{formatValue(row.valeurs?.[column.champ], column.format, lang)}</bdi></td>;
          })}
        </tr>)}
        {result?.totaux && <tr className="border-t border-border bg-surface2 font-bold">{dims.map((column) => <td key={column.id} className={`px-2 py-2 lg:px-3 ${column.align === 'right' ? 'text-end' : 'text-start'}`}>
          {column.source === 'dimension' ? <span className="text-muted">{t('synthese.total')}</span> : <bdi dir="ltr">{formatValue(result.totaux.valeurs?.[column.champ], column.format, lang)}</bdi>}
        </td>)}</tr>}
        </tbody></table>
    </div>
    {totalPages > 1 && <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs text-muted no-print"><span><bdi dir="ltr">{t('synthese.page', { page: page + 1, total: totalPages })}</bdi></span><div className="flex gap-1">
      <Button size="sm" variant="ghost" disabled={page === 0} aria-label={t('common.previous')} onClick={() => setPage((value) => Math.max(0, value - 1))}><Previous className="h-4 w-4" aria-hidden="true" /></Button>
      <Button size="sm" variant="ghost" disabled={page >= totalPages - 1} aria-label={t('common.next')} onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))}><Next className="h-4 w-4" aria-hidden="true" /></Button>
    </div></div>}
  </>;
}

function KpiWidget({ bloc, result, title, lang, actions }) {
  const measures = mesuresOf(result);
  const count = measures.length;
  const objectifs = bloc.options?.objectifs || {};
  const seuils = bloc.options?.seuils || {};
  const compact = count > 12;
  const dense = count > 6 && count <= 12;
  const cols = compact ? 'sm:grid-cols-4 lg:grid-cols-6' : dense ? 'sm:grid-cols-3 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3';
  const grilleRef = useRef(null);
  const [largeurGrille, setLargeurGrille] = useState(0);
  useEffect(() => {
    const element = grilleRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;
    const observateur = new ResizeObserver(([entree]) => setLargeurGrille(entree.contentRect.width));
    observateur.observe(element);
    return () => observateur.disconnect();
  }, []);
  const nbColonnes = colonnesEquilibrees(count, largeurGrille || 1200, compact ? 130 : 170);
  const styleColonnes = largeurGrille ? { gridTemplateColumns: `repeat(${nbColonnes}, minmax(0, 1fr))` } : undefined;

  const statusOf = (id, value) => {
    const seuil = seuils[id];
    if (!seuil || value == null) return null;
    const n = Number(value);
    if (seuil.critique != null && n <= seuil.critique) return 'critique';
    if (seuil.alerte != null && n <= seuil.alerte) return 'alerte';
    return 'ok';
  };

  const bgClass = (status) => {
    if (status === 'critique') return 'border-danger/40 bg-danger/10';
    if (status === 'alerte') return 'border-warning/40 bg-warning/10';
    return 'border-border bg-surface2';
  };

  return <><CardHeader title={title} action={actions} /><div ref={grilleRef} style={styleColonnes} className={`grid gap-2 p-2 ${cols}`} data-kpi-grid data-kpi-count={count}>
    {measures.map((measure) => {
      const value = firstValue(result, measure.id);
      const variation = firstVariation(result, measure.id);
      const objectif = objectifs[measure.id];
      const status = statusOf(measure.id, value);
      return <div key={measure.id} data-kpi-item data-kpi-status={status || ''} className={`min-w-0 rounded-lg border p-3 text-start transition ${bgClass(status)}`}>
        <p className={`font-bold leading-tight ${compact ? 'text-[11px]' : 'text-xs'} text-muted`} data-kpi-label>{measureLabel(measure.id, lang)}</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
          <p className={`font-black tabular-nums text-ink ${compact ? 'text-xl' : 'text-2xl sm:text-3xl'}`} data-kpi-value><bdi dir="ltr">{formatValue(value, measure.format, lang)}</bdi></p>
          {objectif != null && <span className="text-[11px] font-semibold text-brand-600">/{formatValue(objectif, measure.format, lang)}</span>}
        </div>
        {variation != null && <p className={`mt-1 font-semibold text-brand-700 ${compact ? 'text-[10px]' : 'text-xs'}`}><bdi dir="ltr">{formatValue(variation, measure.format, lang)}</bdi></p>}
      </div>;
    })}
  </div></>;
}

function TexteWidget({ bloc, lang, t, alignement = 'auto' }) {
  const text = lang === 'ar' ? (bloc.options?.texte_ar || bloc.options?.texte_fr) : (bloc.options?.texte_fr || bloc.options?.texte_ar);
  return <div className={`whitespace-pre-wrap p-2 text-sm leading-relaxed text-ink2 ${classeAlignementStyle(alignement)}`}>{text || t('synthese.texteAjouter')}</div>;
}

function PhotoPairsWidget({ bloc, result, t, lang, actions }) {
  const periode = result?.meta?.periode || {};
  const limite = Math.min(24, Math.max(1, Number(bloc.options?.limite) || 12));
  const debut = periode.debut || '';
  const fin = periode.fin || '';
  const [state, setState] = useState({ items: [], loading: true, error: null });
  useEffect(() => {
    let alive = true;
    setState((current) => ({ ...current, loading: true, error: null }));
    const query = queryString({ debut, fin, limite });
    api(`/photos/paires${query}`)
      .then((data) => { if (alive) setState({ items: data.items || [], loading: false, error: null }); })
      .catch((error) => { if (alive) setState({ items: [], loading: false, error }); });
    return () => { alive = false; };
  }, [debut, fin, limite]);
  const title = bloc.titre || (lang === 'ar' ? 'مقارنة قبل / بعد' : 'Comparer avant / après');
  if (state.loading) return <><CardHeader title={title} action={actions} /><div className="p-4"><Skeleton className="h-24 w-full" /></div></>;
  if (state.error) return <><CardHeader title={title} action={actions} /><div className="p-4 text-sm text-danger">{state.error.message}</div></>;
  if (!state.items.length) return <><CardHeader title={title} action={actions} /><EmptyState title={title} description={t('photo.noPairs')} /></>;
  return <>
    <CardHeader title={title} action={actions} />
    <div data-photo-pairs data-photo-pairs-per-page={limite} className="grid min-w-0 grid-cols-1 gap-3 p-4 sm:grid-cols-2">
      {state.items.map((pair) => {
        const lieu = [pair.commune?.[lang] || pair.commune?.fr, pair.daira?.[lang] || pair.daira?.fr].filter(Boolean).join(' / ');
        return <article key={`${pair.anomalie_id}-${pair.avant.id}-${pair.apres.id}`}
          data-photo-pair={pair.anomalie_id} className="min-w-0 overflow-hidden rounded-lg border border-border bg-surface2">
          <div className="grid grid-cols-2 gap-px bg-border">
            {[pair.avant, pair.apres].map((piece) => <figure key={piece.id} className="min-w-0 bg-surface">
              <img src={piece.thumb_url || piece.url} width="320" height="240"
                alt={`${t(piece.role === 'avant' ? 'photo.avant' : 'photo.apres')} — ${pair.reference}`}
                className="aspect-[4/3] w-full object-cover" loading="lazy" />
              <figcaption className="truncate px-2 py-1 text-[11px] text-muted" title={piece.legende || piece.nom_original || ''}>
                <bdi>{t(piece.role === 'avant' ? 'photo.avant' : 'photo.apres')}</bdi>
              </figcaption>
            </figure>)}
          </div>
          <div data-photo-legend className="space-y-0.5 px-3 py-2 text-[11px] text-ink2">
            <Link to={`/anomalies/${pair.anomalie_id}`} className="block truncate font-bold text-brand-700">
              <bdi>{pair.reference}</bdi>
            </Link>
            {lieu && <p className="truncate"><bdi>{lieu}</bdi></p>}
            <p className="flex flex-wrap gap-x-2 tabular-nums text-muted">
              {pair.date_signalement && <time dateTime={pair.date_signalement}>{formatDate(pair.date_signalement)}</time>}
              {pair.date_traitement && <time dateTime={pair.date_traitement}>{formatDate(pair.date_traitement)}</time>}
            </p>
            {pair.intervenant && <p className="truncate"><bdi>{pair.intervenant}</bdi></p>}
          </div>
        </article>;
      })}
    </div>
  </>;
}

function typeLabel(type, lang) {
  const labels = { kpi: 'Indicateur', tableau: 'Tableau', barres: 'Barres', lignes: 'Lignes', courbe: 'Courbe', aire: 'Aire', anneau: 'Anneau', histogramme: 'Histogramme', cascade: 'Cascade', carte_thermique: 'Carte thermique', radar: 'Radar', nuage: 'Nuage', treemap: 'Treemap', entonnoir: 'Entonnoir', pareto: 'Pareto', texte: 'Texte', signature: 'Signature', separateur: 'Séparateur', legende: 'Légende', annexe: 'Annexe', avant_apres: 'Comparer avant / après', liste_fiches: 'Liste de fiches', classement: 'Classement', chronologie: 'Chronologie' };
  return lang === 'ar' ? 'عنصر' : (labels[type] || type);
}

function RenderWidget({ bloc, result, t, lang, dir, actions, role, style }) {
  const title = bloc.titre || typeLabel(bloc.type, lang);
  const height = heightClass(bloc);
  if (['texte', 'signature', 'legende', 'annexe'].includes(bloc.type)) return <><CardHeader title={title} action={actions} /><TexteWidget bloc={bloc} lang={lang} t={t} alignement={style.alignement} /></>;
  if (bloc.type === 'kpi') return <KpiWidget bloc={bloc} result={result} title={title} lang={lang} actions={actions} />;
  if (bloc.type === 'avant_apres') return <PhotoPairsWidget bloc={bloc} result={result} t={t} lang={lang} actions={actions} />;
  if (['tableau', 'liste_fiches', 'classement', 'chronologie'].includes(bloc.type)) return <TableauWidget bloc={bloc} result={result} title={title} lang={lang} dir={dir} t={t} actions={actions} role={role} />;
  if (['courbe', 'lignes', 'aire'].includes(bloc.type)) return <CourbeChart result={result} title={title} lang={lang} dir={dir} height={height} actions={actions} t={t} />;
  if (bloc.type === 'anneau') return <AnneauChart result={result} title={title} t={t} lang={lang} actions={actions} />;
  if (['barres', 'histogramme', 'carte_thermique', 'pareto', 'cascade', 'treemap', 'radar', 'nuage', 'entonnoir'].includes(bloc.type)) return <BarresChart result={result} title={title} lang={lang} dir={dir} height={height} actions={actions} t={t} />;
  return <EmptyState title={title} description={t('synthese.visuelNonRendu', { visuel: bloc.type })} />;
}

function WidgetError({ error, reset, t, bloc }) {
  return <Card data-testid={`widget-${bloc.id}`} data-widget-error className="p-4"><p className="font-bold text-danger">{t('synthese.erreurWidget')}</p><p className="mt-1 text-xs text-muted">{error?.message || t('common.error')}</p><Button size="sm" variant="secondary" className="mt-3" onClick={reset}>{t('common.retry')}</Button></Card>;
}

export default function WidgetCard({ bloc, result, t, lang, dir, onVoirFiches, editorActions = null, role = 'operateur' }) {
  const [dialog, setDialog] = useState(null);
  if (bloc.type === 'separateur') return <div className="my-4 border-t-2 border-border" data-testid={`widget-${bloc.id}`} />;
  const needsResult = !['texte', 'signature', 'legende', 'annexe'].includes(bloc.type);
  const title = bloc.titre || typeLabel(bloc.type, lang);
  const actions = <WidgetActionBar result={result} bloc={bloc} title={title} lang={lang} t={t} onDialog={setDialog} onVoirFiches={onVoirFiches} editorActions={editorActions} />;
  const style = normaliserStyle(bloc.options);
  const densite = classeDensiteStyle(style.densite);
  const accent = classeAccentStyle(style.accent);
  const body = needsResult && !result
    ? <><CardHeader title={title} action={actions} /><div className="p-4"><Skeleton className="h-24 w-full" /></div></>
    : <RenderWidget bloc={bloc} result={result} t={t} lang={lang} dir={dir} actions={actions} role={role} style={style} />;
  const fullBody = needsResult && !result ? <Skeleton className="h-24 w-full" /> : <RenderWidget bloc={bloc} result={result} t={t} lang={lang} dir={dir} actions={null} role={role} style={style} />;
  return <ErrorBoundary fallback={({ error, reset }) => <WidgetError error={error} reset={reset} t={t} bloc={bloc} />}>
    <Card data-testid={`widget-${bloc.id}`} data-widget-card data-style-align={style.alignement} data-style-accent={style.accent} className={`${densite} ${accent}`}>{body}</Card>
    <WidgetDialogs dialog={dialog} onClose={() => setDialog(null)} title={title} result={result} lang={lang} t={t} fullBody={fullBody} />
  </ErrorBoundary>;
}
