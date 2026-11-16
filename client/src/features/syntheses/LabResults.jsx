import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown, ArrowUp, ChevronsUpDown, FlaskConical, SearchX, TrendingDown, TrendingUp,
} from 'lucide-react';
import { formatDateShort, formatNumber, formatValue, pluralDays } from '@anm/shared';
import {
  Alert, Button, Card, CardHeader, EmptyState, LoadingBlock,
} from '../../components/ui/index.js';

function labelFor(item, lang) {
  if (!item) return '—';
  return lang === 'ar' ? (item.label_ar || item.label_fr || '—') : (item.label_fr || item.label_ar || '—');
}

function VariationLine({ variation, t, lang }) {
  if (!variation) return null;
  const value = variation.kind === 'points' || variation.kind === 'jours'
    ? variation.abs
    : variation.pct ?? variation.abs;
  if (!Number.isFinite(Number(value))) return null;
  const number = Number(value);
  const signed = `${number > 0 ? '+' : ''}${formatNumber(number, lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
  let text;
  if (variation.kind === 'points') text = t('lab.variationPoints', { value: signed });
  else if (variation.kind === 'jours') text = t('lab.variationDays', { value: signed, unit: pluralDays(number, lang) });
  else if (variation.pct !== null && variation.pct !== undefined) text = t('lab.variationPercent', { value: signed });
  else text = t('lab.variationAbsolute', { value: signed });
  const tone = number > 0 ? 'text-straite' : number < 0 ? 'text-danger' : 'text-muted';
  const Icon = number < 0 ? TrendingDown : TrendingUp;
  return <span className={`inline-flex items-center gap-1 text-xs font-semibold ${tone}`}>
    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
    <span>{text}</span>
  </span>;
}

function SortIcon({ active, direction }) {
  if (!active) return <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />;
  return direction === 'asc'
    ? <ArrowUp className="h-3.5 w-3.5 shrink-0 text-brand-700" aria-hidden="true" />
    : <ArrowDown className="h-3.5 w-3.5 shrink-0 text-brand-700" aria-hidden="true" />;
}

function MeasureValue({ row, measure, t, lang }) {
  const hasComparison = row.comparaison && Object.prototype.hasOwnProperty.call(row.comparaison, measure.id);
  const previous = row.comparaison?.[measure.id];
  const variation = row.variations?.[measure.id];
  return <>
    <span className="block font-semibold text-ink">{formatValue(row.valeurs?.[measure.id], measure.format, lang)}</span>
    {hasComparison && <span className="mt-0.5 block text-xs text-muted">{t('lab.before')} {formatValue(previous, measure.format, lang)}</span>}
    {variation && <span className="mt-0.5 block"><VariationLine variation={variation} t={t} lang={lang} /></span>}
  </>;
}

export default function LabResults({
  result, error, running, dirty, onRetry, t, lang, dir,
}) {
  const [sort, setSort] = useState(null);
  useEffect(() => { setSort(null); }, [result]);

  const dimensions = useMemo(() => result?.colonnes?.dimensions || [], [result]);
  const measures = useMemo(() => result?.colonnes?.mesures || [], [result]);
  const rows = useMemo(() => result?.lignes || [], [result]);
  const measureIds = useMemo(() => new Set(measures.map((measure) => measure.id)), [measures]);

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const valueFor = (row, champ) => {
      if (measureIds.has(champ)) return row.valeurs?.[champ];
      const dimension = row.dimensions?.find((item) => item.id === champ);
      return labelFor(dimension, lang);
    };
    return [...rows].sort((first, second) => {
      const a = valueFor(first, sort.champ);
      const b = valueFor(second, sort.champ);
      if (a === null || a === undefined) return b === null || b === undefined ? 0 : 1;
      if (b === null || b === undefined) return -1;
      let comparison;
      if (typeof a === 'number' && typeof b === 'number') comparison = a - b;
      else comparison = String(a).localeCompare(String(b), lang === 'ar' ? 'ar' : 'fr');
      return sort.direction === 'asc' ? comparison : -comparison;
    });
  }, [rows, sort, measureIds, lang]);

  const toggleSort = (champ) => setSort((current) => {
    if (current?.champ === champ) return { champ, direction: current.direction === 'asc' ? 'desc' : 'asc' };
    return { champ, direction: measureIds.has(champ) ? 'desc' : 'asc' };
  });

  const totals = result?.totaux?.valeurs;
  const meta = result?.meta || {};
  const period = meta.periode;
  const periodText = period?.debut && period?.fin
    ? t('lab.periodRange', { debut: formatDateShort(period.debut, lang), fin: formatDateShort(period.fin, lang) })
    : t('lab.resultsSubtitle');
  const metaText = meta.ms !== undefined
    ? `${t('lab.computed', { ms: formatNumber(meta.ms, lang), version: meta.catalogue_version || '—' })}${meta.cache ? ` · ${t('lab.cache')}` : ''}`
    : '';

  const chartMeasure = measures.find((measure) => measure.format !== 'pourcentage') || measures[0];
  const chartRows = useMemo(() => {
    if (!chartMeasure) return [];
    return sortedRows.filter((row) => Number.isFinite(Number(row.valeurs?.[chartMeasure.id]))).slice(0, 20);
  }, [sortedRows, chartMeasure]);
  const chartMax = chartRows.reduce((maximum, row) => Math.max(maximum, Math.abs(Number(row.valeurs?.[chartMeasure.id] || 0))), 0);

  if (error) {
    return <div className="grid gap-5" data-testid="lab-results">
      <Alert variant="danger" title={t('lab.error')} action={onRetry && <Button size="sm" variant="secondary" onClick={onRetry}>{t('common.retry')}</Button>}>
        {error.message || t('lab.errorHelp')}
      </Alert>
    </div>;
  }

  if (!result && running) {
    return <div className="grid gap-5" data-testid="lab-results"><Card className="p-4"><LoadingBlock /></Card></div>;
  }

  if (!result) {
    return <div className="grid gap-5" data-testid="lab-results">
      <Card><EmptyState icon={FlaskConical} title={t('lab.ready')} description={t('lab.readyHelp')} /></Card>
    </div>;
  }

  return <div className="grid gap-5" data-testid="lab-results" aria-busy={running}>
    {dirty && <Alert variant="warning" title={t('lab.dirty')}>{t('lab.dirtyHelp')}</Alert>}

    <Card>
      <CardHeader title={t('lab.results')} description={periodText} action={
        <span className="text-xs text-muted" role="status">{running ? t('lab.evaluating') : metaText}</span>
      } />
      <div className="grid gap-4 p-4">
        {result.totaux === null && <Alert variant="info">{t('lab.noTotals')}</Alert>}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="lab-kpis">
          {measures.map((measure) => {
            const value = totals?.[measure.id];
            const variation = result.totaux?.variations?.[measure.id];
            return <div key={measure.id} data-testid={`lab-kpi-${measure.id}`} className="rounded-md border border-border bg-surface2 p-4">
              <p className="text-xs font-bold text-muted"><bdi>{labelFor(measure, lang)}</bdi></p>
              <p className="mt-1 break-words text-2xl font-black text-ink"><bdi>{formatValue(value, measure.format, lang)}</bdi></p>
              {variation && <div className="mt-1"><VariationLine variation={variation} t={t} lang={lang} /></div>}
            </div>;
          })}
        </div>
        {meta.avertissements?.length > 0 && <Alert variant="warning" title={t('lab.warnings')}>
          <ul className="list-inside list-disc space-y-1">{meta.avertissements.map((warning) => <li key={warning}>{warning}</li>)}</ul>
        </Alert>}
        {dimensions.length === 0 && <Alert variant="info">{t('lab.resultsNoDimensions')}</Alert>}
      </div>
    </Card>

    {dimensions.length > 0 && chartRows.length > 1 && <Card data-testid="lab-chart">
      <CardHeader title={t('lab.chart')} description={t('lab.chartHelp', { measure: labelFor(chartMeasure, lang) })} />
      <div className="grid gap-3 p-4">
        {chartRows.map((row, index) => {
          const value = Number(row.valeurs?.[chartMeasure.id] || 0);
          const label = row.dimensions.map((dimension) => labelFor(dimension, lang)).join(' · ');
          const width = chartMax > 0 ? Math.max(1, Math.round((Math.abs(value) / chartMax) * 100)) : 0;
          return <div key={`${label}-${index}`} className="min-w-0">
            <div className="flex min-w-0 items-baseline justify-between gap-3 text-sm">
              <span className={`min-w-0 truncate ${row.autre ? 'font-bold text-ink' : 'text-ink2'}`}><bdi>{label}</bdi></span>
              <bdi className="shrink-0 font-bold text-ink">{formatValue(value, chartMeasure.format, lang)}</bdi>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface2" dir={dir} aria-hidden="true">
              <div className={`h-full rounded-full ${value < 0 ? 'bg-danger' : 'bg-brand-600'}`} style={{ width: `${width}%` }} />
            </div>
          </div>;
        })}
      </div>
    </Card>}

    {dimensions.length > 0 && <Card>
      <CardHeader title={t('lab.detail')} description={t('lab.detailHelp')} />
      <div className="p-4">
        {sortedRows.length === 0
          ? <EmptyState icon={SearchX} title={t('lab.resultsEmpty')} description={t('lab.resultsEmptyDesc')} />
          : <div className="max-h-[72vh] overflow-auto rounded-md border border-border">
            <table data-testid="lab-table" className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
              <thead className="sticky top-0 z-10 bg-surface2">
                <tr>
                  {dimensions.map((dimension) => <th key={dimension.id} scope="col" className="border-b border-border px-3 py-1 text-start"
                    aria-sort={sort?.champ === dimension.id ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" onClick={() => toggleSort(dimension.id)} className="flex min-h-11 w-full items-center gap-1 text-start text-xs font-bold text-ink2">
                      <bdi className="min-w-0">{labelFor(dimension, lang)}</bdi>
                      <SortIcon active={sort?.champ === dimension.id} direction={sort?.direction} />
                    </button>
                  </th>)}
                  {measures.map((measure) => <th key={measure.id} scope="col" className="border-b border-border px-3 py-1 text-end"
                    aria-sort={sort?.champ === measure.id ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" onClick={() => toggleSort(measure.id)} className="flex min-h-11 w-full items-center justify-end gap-1 text-end text-xs font-bold text-ink2">
                      <bdi className="min-w-0">{labelFor(measure, lang)}</bdi>
                      <SortIcon active={sort?.champ === measure.id} direction={sort?.direction} />
                    </button>
                  </th>)}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row, rowIndex) => <tr key={`${row.dimensions?.map((dimension) => `${dimension.id}:${dimension.key}`).join('|')}-${rowIndex}`}
                  data-testid="lab-row" className={row.autre ? 'bg-surface2 font-bold' : 'hover:bg-surface2'}>
                  {row.dimensions?.map((dimension, index) => <td key={`${dimension.id}-${index}`}
                    className={`border-b border-border px-3 py-2 align-top ${index === 0 ? 'font-semibold text-ink' : 'text-ink2'}`}>
                    <bdi>{labelFor(dimension, lang)}</bdi>
                  </td>)}
                  {measures.map((measure) => <td key={measure.id} className="border-b border-border px-3 py-2 text-end align-top">
                    <MeasureValue row={row} measure={measure} t={t} lang={lang} />
                  </td>)}
                </tr>)}
              </tbody>
              {result.totaux && <tfoot>
                <tr data-testid="lab-total-row" className="bg-surface2 font-bold">
                  <td colSpan={dimensions.length} className="border-b border-border px-3 py-2 text-ink">{t('lab.tableTotal')}</td>
                  {measures.map((measure) => <td key={measure.id} className="border-b border-border px-3 py-2 text-end align-top">
                    <MeasureValue row={{ ...result.totaux, valeurs: result.totaux.valeurs }} measure={measure} t={t} lang={lang} />
                  </td>)}
                </tr>
              </tfoot>}
            </table>
          </div>}
      </div>
    </Card>}
  </div>;
}
