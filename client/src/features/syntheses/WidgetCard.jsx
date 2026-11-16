import { useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { ChevronDown, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { formatValue } from '@anm/shared';
import { ErrorBoundary } from '../../components/ErrorBoundary.jsx';
import { Button, Card, CardHeader, EmptyState, Skeleton } from '../../components/ui/index.js';
import {
  chartData, dimensionLabel, dimsOf, downloadWidgetCsv, measureLabel, mesuresOf,
  rowDimensionLabel, rowsOf,
} from './widgetData.js';

const ROWS_PER_PAGE = 12;
const COLORS = ['var(--brand-600)', 'var(--brand-500)', 'var(--brand-800)', 'var(--brand-900)', 'var(--brand-700)'];
function colorFor(index) { return COLORS[index % COLORS.length]; }
function heightClass(bloc) {
  if (bloc.options?.hauteur === 'compacte') return 'h-[220px]';
  if (bloc.options?.hauteur === 'grande') return 'h-[380px]';
  return 'h-[280px]';
}
function firstValue(result, id) { return rowsOf(result)[0]?.valeurs?.[id] ?? null; }
function firstVariation(result, id) { return rowsOf(result)[0]?.comparaison?.[id] ?? null; }

function DataActions({ result, title, lang, t, onVoirFiches }) {
  return <div className="flex flex-wrap items-center justify-end gap-1 no-print">
    {onVoirFiches && <Button size="sm" variant="ghost" onClick={onVoirFiches}>
      <ChevronDown className="h-4 w-4" aria-hidden="true" />{t('synthese.voirFiches')}
    </Button>}
    <Button size="sm" variant="ghost" onClick={() => downloadWidgetCsv(result, title, lang)} aria-label={t('synthese.exporterCsv')}>
      <Download className="h-4 w-4" aria-hidden="true" />CSV
    </Button>
  </div>;
}

function summary(data, measures, lang) {
  return data.slice(0, 12).map((row) => `${row.name}: ${measures.map((m) => `${measureLabel(m.id, lang)} ${row[m.id]}`).join(', ')}`).join('; ');
}

function BarresChart({ result, title, t, lang, dir, height }) {
  const data = chartData(result, lang).slice(0, 12);
  const measures = mesuresOf(result);
  return <>
    <CardHeader title={title} action={<DataActions result={result} title={title} lang={lang} t={t} />} />
    <p className="sr-only">{summary(data, measures, lang)}</p>
    <div className={`${height} w-full`} aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart accessibilityLayer={false} data={data} margin={{ top: 20, right: 16, bottom: 52, left: 24 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={64} />
          <YAxis allowDecimals={false} orientation={dir === 'rtl' ? 'right' : 'left'} />
          <Tooltip /><Legend />
          {measures.map((measure, index) => <Bar key={measure.id} dataKey={measure.id} name={measureLabel(measure.id, lang)} fill={colorFor(index)} radius={[4, 4, 0, 0]} />)}
        </BarChart>
      </ResponsiveContainer>
    </div>
  </>;
}

function CourbeChart({ result, title, t, lang, dir, height }) {
  const data = chartData(result, lang).slice(0, 40);
  const measures = mesuresOf(result);
  return <>
    <CardHeader title={title} action={<DataActions result={result} title={title} lang={lang} t={t} />} />
    <p className="sr-only">{summary(data, measures, lang)}</p>
    <div className={`${height} w-full`} aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart accessibilityLayer={false} data={data} margin={{ top: 20, right: 16, bottom: 52, left: 24 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis allowDecimals={false} orientation={dir === 'rtl' ? 'right' : 'left'} />
          <Tooltip /><Legend />
          {measures.map((measure, index) => <Line key={measure.id} type="monotone" dataKey={measure.id} name={measureLabel(measure.id, lang)} stroke={colorFor(index)} strokeWidth={2.5} dot={data.length < 15} />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
  </>;
}

function AnneauChart({ result, title, t, lang, height }) {
  const measure = mesuresOf(result)[0];
  const data = chartData(result, lang).slice(0, 10).map((row) => ({ name: row.name, value: row[measure?.id] || 0 }));
  const total = data.reduce((sum, row) => sum + row.value, 0);
  return <>
    <CardHeader title={title} action={<DataActions result={result} title={title} lang={lang} t={t} />} />
    <p className="sr-only">{data.map((row) => `${row.name}: ${row.value}`).join('; ')}</p>
    <div className={`relative ${height} w-full`} aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart accessibilityLayer={false}><Pie rootTabIndex={-1} dataKey="value" nameKey="name" data={data} innerRadius={68} outerRadius={94} paddingAngle={2}>
          {data.map((entry, index) => <Cell key={`${entry.name}-${index}`} fill={colorFor(index)} stroke="var(--surface)" />)}
        </Pie><Tooltip /><Legend verticalAlign="bottom" /></PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 grid place-items-center pb-8"><div className="text-center"><div className="text-2xl font-black text-ink">{total}</div><div className="text-xs text-muted">{t('common.total')}</div></div></div>
    </div>
  </>;
}

function TableauWidget({ result, title, lang, dir, t, onVoirFiches }) {
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
    <CardHeader title={title} action={<DataActions result={result} title={title} lang={lang} t={t} onVoirFiches={onVoirFiches} />} />
    <div className="max-h-[56vh] overflow-auto rounded-md border border-border" role="region" aria-label={title} tabIndex={0}>
      <table className="w-full min-w-full text-sm"><thead className="sticky top-0 z-10 bg-surface2"><tr>{headers.map((text, index) => <th key={`${text}-${index}`} className="border-b border-border px-3 py-2 text-start text-xs font-bold text-ink2">{text}</th>)}</tr></thead>
        <tbody>{pageRows.length === 0 ? <tr><td colSpan={Math.max(1, headers.length)} className="px-4 py-5 text-center text-muted">{t('synthese.aucuneLigne')}</td></tr> : pageRows.map((row, rowIndex) => <tr key={rowIndex} className="border-b border-border last:border-0">
          {dimensions.map((dimension, index) => <td key={`${dimension.id}-${index}`} className="px-3 py-2 text-start text-ink">{rowDimensionLabel(row, dimension, index, lang)}</td>)}
          {measures.map((measure) => <td key={measure.id} className="px-3 py-2 text-end tabular-nums text-ink">{formatValue(row.valeurs?.[measure.id], measure.format, lang)}</td>)}
        </tr>)}
        {result?.totaux && <tr className="border-t border-border bg-surface2 font-bold">{dimensions.map((dimension) => <td key={dimension.id} className="px-3 py-2 text-start text-muted">{t('synthese.total')}</td>)}{measures.map((measure) => <td key={measure.id} className="px-3 py-2 text-end tabular-nums">{formatValue(result.totaux.valeurs?.[measure.id], measure.format, lang)}</td>)}</tr>}
        </tbody></table>
    </div>
    <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs text-muted no-print"><span>{t('synthese.page', { page: page + 1, total: totalPages })}</span><div className="flex gap-1">
      <Button size="sm" variant="ghost" disabled={page === 0} aria-label={t('common.previous')} onClick={() => setPage((value) => Math.max(0, value - 1))}><Previous className="h-4 w-4" aria-hidden="true" /></Button>
      <Button size="sm" variant="ghost" disabled={page >= totalPages - 1} aria-label={t('common.next')} onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))}><Next className="h-4 w-4" aria-hidden="true" /></Button>
    </div></div>
  </>;
}

function KpiWidget({ result, title, lang, t }) {
  const measures = mesuresOf(result);
  return <><CardHeader title={title} action={<DataActions result={result} title={title} lang={lang} t={t} />} /><div className="grid gap-3 p-2 sm:grid-cols-2 lg:grid-cols-4">{measures.map((measure) => {
    const variation = firstVariation(result, measure.id);
    return <div key={measure.id} className="rounded-lg border border-border bg-surface2 p-4 text-start"><p className="text-xs font-bold text-muted">{measureLabel(measure.id, lang)}</p><p className="mt-1 break-words text-3xl font-black tabular-nums text-ink">{formatValue(firstValue(result, measure.id), measure.format, lang)}</p>{variation != null && <p className="mt-1 text-xs font-semibold text-brand-700">{formatValue(variation, measure.format, lang)}</p>}</div>;
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

function RenderWidget({ bloc, result, t, lang, dir, onVoirFiches }) {
  const title = bloc.titre || typeLabel(bloc.type, lang);
  const height = heightClass(bloc);
  if (['texte', 'signature', 'legende', 'annexe'].includes(bloc.type)) return <TexteWidget bloc={bloc} lang={lang} t={t} />;
  if (bloc.type === 'kpi') return <KpiWidget result={result} title={title} lang={lang} t={t} />;
  if (['tableau', 'liste_fiches', 'classement', 'chronologie'].includes(bloc.type)) return <TableauWidget result={result} title={title} lang={lang} dir={dir} t={t} onVoirFiches={onVoirFiches} />;
  if (['courbe', 'lignes', 'aire'].includes(bloc.type)) return <CourbeChart result={result} title={title} t={t} lang={lang} dir={dir} height={height} />;
  if (bloc.type === 'anneau') return <AnneauChart result={result} title={title} t={t} lang={lang} height={height} />;
  if (['barres', 'histogramme', 'carte_thermique', 'pareto', 'cascade', 'treemap', 'radar', 'nuage', 'entonnoir'].includes(bloc.type)) return <BarresChart result={result} title={title} t={t} lang={lang} dir={dir} height={height} />;
  return <EmptyState title={title} description={t('synthese.visuelNonRendu', { visuel: bloc.type })} />;
}

export default function WidgetCard({ bloc, result, t, lang, dir, onVoirFiches }) {
  if (bloc.type === 'separateur') return <div className="my-4 border-t-2 border-border" data-testid={`widget-${bloc.id}`} />;
  const needsResult = !['texte', 'signature', 'legende', 'annexe'].includes(bloc.type);
  if (needsResult && !result) return <Card className="p-4"><Skeleton className="h-24 w-full" /></Card>;
  return <ErrorBoundary key={bloc.id}><Card data-testid={`widget-${bloc.id}`} className="overflow-hidden p-4"><RenderWidget bloc={bloc} result={result} t={t} lang={lang} dir={dir} onVoirFiches={onVoirFiches} /></Card></ErrorBoundary>;
}
