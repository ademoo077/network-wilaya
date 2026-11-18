import { useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatValue } from '@anm/shared';
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

function TableauWidget({ bloc, result, title, lang, dir, t, actions }) {
  const dimensions = dimsOf(result);
  const measures = mesuresOf(result);
  const rows = rowsOf(result);
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));
  const pageRows = rows.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE);
  const headers = dimensions.map((d) => dimensionLabel(d.champ, lang)).concat(measures.map((m) => measureLabel(m.id, lang)));
  const Previous = dir === 'rtl' ? ChevronRight : ChevronLeft;
  const Next = dir === 'rtl' ? ChevronLeft : ChevronRight;
  return <>
    <CardHeader title={title} action={actions} />
    {bloc.options?.avec_graphique && <MiniChart result={result} lang={lang} t={t} />}
    <div className="overflow-x-auto rounded-md border border-border lg:overflow-x-visible" role="region" aria-label={title} tabIndex={0}>
      <table className="w-full text-sm" data-widget-table><thead className="sticky top-0 z-10 bg-surface2"><tr>{headers.map((text, index) => <th key={`${text}-${index}`} className="border-b border-border px-2 py-2 text-start text-xs font-bold text-ink2 lg:px-3">{text}</th>)}</tr></thead>
        <tbody>{pageRows.length === 0 ? <tr><td colSpan={Math.max(1, headers.length)} className="px-4 py-5 text-center text-muted">{t('synthese.aucuneLigne')}</td></tr> : pageRows.map((row, rowIndex) => <tr key={rowIndex} className="border-b border-border last:border-0">
          {dimensions.map((dimension, index) => <td key={`${dimension.id}-${index}`} className="px-2 py-2 text-start text-ink lg:px-3"><bdi>{rowDimensionLabel(row, dimension, index, lang)}</bdi></td>)}
          {measures.map((measure) => <td key={measure.id} className="px-2 py-2 text-end tabular-nums text-ink lg:px-3"><bdi dir="ltr">{formatValue(row.valeurs?.[measure.id], measure.format, lang)}</bdi></td>)}
        </tr>)}
        {result?.totaux && <tr className="border-t border-border bg-surface2 font-bold">{dimensions.map((dimension) => <td key={dimension.id} className="px-2 py-2 text-start text-muted lg:px-3">{t('synthese.total')}</td>)}{measures.map((measure) => <td key={measure.id} className="px-2 py-2 text-end tabular-nums lg:px-3"><bdi dir="ltr">{formatValue(result.totaux.valeurs?.[measure.id], measure.format, lang)}</bdi></td>)}</tr>}
        </tbody></table>
    </div>
    {totalPages > 1 && <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs text-muted no-print"><span><bdi dir="ltr">{t('synthese.page', { page: page + 1, total: totalPages })}</bdi></span><div className="flex gap-1">
      <Button size="sm" variant="ghost" disabled={page === 0} aria-label={t('common.previous')} onClick={() => setPage((value) => Math.max(0, value - 1))}><Previous className="h-4 w-4" aria-hidden="true" /></Button>
      <Button size="sm" variant="ghost" disabled={page >= totalPages - 1} aria-label={t('common.next')} onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))}><Next className="h-4 w-4" aria-hidden="true" /></Button>
    </div></div>}
  </>;
}

function KpiWidget({ result, title, lang, actions }) {
  const measures = mesuresOf(result);
  return <><CardHeader title={title} action={actions} /><div className="kpi-grid p-2">{measures.map((measure) => {
    const variation = firstVariation(result, measure.id);
    return <div key={measure.id} className="min-w-0 rounded-lg border border-border bg-surface2 p-3 text-start">
      <p className="min-h-[2.4rem] text-xs font-bold leading-tight text-muted" data-kpi-label>{measureLabel(measure.id, lang)}</p>
      <p className="mt-1 whitespace-nowrap text-2xl font-black tabular-nums text-ink sm:text-3xl" data-kpi-value><bdi dir="ltr">{formatValue(firstValue(result, measure.id), measure.format, lang)}</bdi></p>
      {variation != null && <p className="mt-1 text-xs font-semibold text-brand-700"><bdi dir="ltr">{formatValue(variation, measure.format, lang)}</bdi></p>}
    </div>;
  })}</div></>;
}

function TexteWidget({ bloc, lang, t }) {
  const text = lang === 'ar' ? (bloc.options?.texte_ar || bloc.options?.texte_fr) : (bloc.options?.texte_fr || bloc.options?.texte_ar);
  return <div className="whitespace-pre-wrap p-2 text-sm leading-relaxed text-ink2">{text || t('synthese.texteAjouter')}</div>;
}

function typeLabel(type, lang) {
  const labels = { kpi: 'Indicateur', tableau: 'Tableau', barres: 'Barres', lignes: 'Lignes', courbe: 'Courbe', aire: 'Aire', anneau: 'Anneau', histogramme: 'Histogramme', cascade: 'Cascade', carte_thermique: 'Carte thermique', radar: 'Radar', nuage: 'Nuage', treemap: 'Treemap', entonnoir: 'Entonnoir', pareto: 'Pareto', texte: 'Texte', signature: 'Signature', separateur: 'Séparateur', legende: 'Légende', annexe: 'Annexe' };
  return lang === 'ar' ? 'عنصر' : (labels[type] || type);
}

function RenderWidget({ bloc, result, t, lang, dir, actions }) {
  const title = bloc.titre || typeLabel(bloc.type, lang);
  const height = heightClass(bloc);
  if (['texte', 'signature', 'legende', 'annexe'].includes(bloc.type)) return <><CardHeader title={title} action={actions} /><TexteWidget bloc={bloc} lang={lang} t={t} /></>;
  if (bloc.type === 'kpi') return <KpiWidget result={result} title={title} lang={lang} actions={actions} />;
  if (['tableau', 'liste_fiches', 'classement', 'chronologie'].includes(bloc.type)) return <TableauWidget bloc={bloc} result={result} title={title} lang={lang} dir={dir} t={t} actions={actions} />;
  if (['courbe', 'lignes', 'aire'].includes(bloc.type)) return <CourbeChart result={result} title={title} lang={lang} dir={dir} height={height} actions={actions} t={t} />;
  if (bloc.type === 'anneau') return <AnneauChart result={result} title={title} t={t} lang={lang} actions={actions} />;
  if (['barres', 'histogramme', 'carte_thermique', 'pareto', 'cascade', 'treemap', 'radar', 'nuage', 'entonnoir'].includes(bloc.type)) return <BarresChart result={result} title={title} lang={lang} dir={dir} height={height} actions={actions} t={t} />;
  return <EmptyState title={title} description={t('synthese.visuelNonRendu', { visuel: bloc.type })} />;
}

function WidgetError({ error, reset, t, bloc }) {
  return <Card data-testid={`widget-${bloc.id}`} data-widget-error className="p-4"><p className="font-bold text-danger">{t('synthese.erreurWidget')}</p><p className="mt-1 text-xs text-muted">{error?.message || t('common.error')}</p><Button size="sm" variant="secondary" className="mt-3" onClick={reset}>{t('common.retry')}</Button></Card>;
}

export default function WidgetCard({ bloc, result, t, lang, dir, onVoirFiches, editorActions = null }) {
  const [dialog, setDialog] = useState(null);
  if (bloc.type === 'separateur') return <div className="my-4 border-t-2 border-border" data-testid={`widget-${bloc.id}`} />;
  const needsResult = !['texte', 'signature', 'legende', 'annexe'].includes(bloc.type);
  const title = bloc.titre || typeLabel(bloc.type, lang);
  const actions = <WidgetActionBar result={result} bloc={bloc} title={title} lang={lang} t={t} onDialog={setDialog} onVoirFiches={onVoirFiches} editorActions={editorActions} />;
  const body = needsResult && !result
    ? <><CardHeader title={title} action={actions} /><div className="p-4"><Skeleton className="h-24 w-full" /></div></>
    : <RenderWidget bloc={bloc} result={result} t={t} lang={lang} dir={dir} actions={actions} />;
  const fullBody = needsResult && !result ? <Skeleton className="h-24 w-full" /> : <RenderWidget bloc={bloc} result={result} t={t} lang={lang} dir={dir} actions={null} />;
  return <ErrorBoundary fallback={({ error, reset }) => <WidgetError error={error} reset={reset} t={t} bloc={bloc} />}>
    <Card data-testid={`widget-${bloc.id}`} data-widget-card className="p-4">{body}</Card>
    <WidgetDialogs dialog={dialog} onClose={() => setDialog(null)} title={title} result={result} lang={lang} t={t} fullBody={fullBody} />
  </ErrorBoundary>;
}
