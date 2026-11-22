import { Check, RotateCcw } from 'lucide-react';
import { PERIOD_OPTIONS } from '@anm/shared';
import { COLUMN_LABELS } from './useListPreferences.js';
import { useI18n } from '../../../i18n/index.jsx';

const buttonClass = 'min-h-9 rounded-sm border px-3 text-xs font-bold';
const activeClass = 'border-brand-600 bg-brand-100 text-brand-800';
const idleClass = 'border-border bg-surface text-ink2 hover:bg-surface2';

export default function AnomalyListToolbar({ prefs, period, onPeriod }) {
  const { t } = useI18n();
  const modes = [['standard', 'list.standard'], ['complet', 'list.complete'], ['galerie', 'list.gallery']];
  const densities = [['comfortable', 'list.comfortable'], ['compact', 'list.compact']];
  return <div data-list-toolbar className="mb-4 flex flex-wrap items-center gap-2">
    <div role="group" aria-label={t('list.view')} className="flex flex-wrap gap-1">
      {modes.map(([value, label]) => <button key={value} type="button" data-list-mode={value} aria-pressed={prefs.mode === value}
        onClick={() => prefs.setMode(value)} className={`${buttonClass} ${prefs.mode === value ? activeClass : idleClass}`}>{t(label)}</button>)}
    </div>
    <div role="group" aria-label={t('list.density')} className="flex flex-wrap gap-1">
      {densities.map(([value, label]) => <button key={value} type="button" data-density={value} aria-pressed={prefs.density === value}
        onClick={() => prefs.setDensity(value)} className={`${buttonClass} ${prefs.density === value ? activeClass : idleClass}`}>{t(label)}</button>)}
    </div>
    <details data-column-picker className="relative">
      <summary className={`inline-flex min-h-9 cursor-pointer list-none items-center rounded-sm border px-3 text-xs font-bold ${idleClass}`}>{t('list.columns')}</summary>
      <div className="absolute start-0 top-full z-30 mt-1 w-64 rounded-md border border-border bg-surface p-3 shadow-3">
        <div className="grid max-h-72 gap-1 overflow-y-auto">
          {prefs.available.map((key) => <label key={key} className="flex min-h-9 items-center gap-2 text-sm">
            <input type="checkbox" aria-label={t('list.columnOption', { name: t(COLUMN_LABELS[key]) })} checked={prefs.columns.includes(key)} onChange={() => prefs.toggleColumn(key)} />
            <span>{t(COLUMN_LABELS[key])}</span>
          </label>)}
        </div>
        <div className="mt-2 flex flex-wrap gap-3">
          <button type="button" onClick={prefs.resetColumns} className="inline-flex min-h-9 items-center gap-2 text-xs font-bold text-brand-text-700">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />{t('common.reset')}
          </button>
          <button type="button" data-reset-widths onClick={prefs.resetWidths} className="inline-flex min-h-9 items-center gap-2 text-xs font-bold text-brand-text-700">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />{t('list.resetWidths')}
          </button>
        </div>
      </div>
    </details>
    <label className="inline-flex min-h-9 items-center gap-2 rounded-sm border border-border bg-surface px-3 text-xs font-bold text-ink2">
      {t('list.period')}
      <select data-list-period value={period} onChange={(event) => onPeriod(event.target.value)} className="max-w-32 bg-surface text-ink2">
        {PERIOD_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{t(label)}</option>)}
      </select>
    </label>
    <span className="ms-auto hidden text-xs text-muted lg:inline"><Check className="me-1 inline h-3.5 w-3.5" aria-hidden="true" />{t('list.stickyHint')}</span>
  </div>;
}
