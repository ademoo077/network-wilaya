import { QUICK_VIEWS, QUICK_FILTER_KEYS } from '@anm/shared';
import { queryString } from '../../api/client.js';
import { useApiQuery } from '../../hooks/useApiQuery.js';
import { useI18n } from '../../i18n/index.jsx';

export default function QuickViews({ filters, update }) {
  const { t } = useI18n(); const base = { ...filters };
  for (const key of [...QUICK_FILTER_KEYS, 'page', 'pageSize', 'sort', 'dir']) delete base[key];
  const counts = useApiQuery(`/anomalies/counts${queryString(base)}`);
  const selected = QUICK_VIEWS.find((view) => QUICK_FILTER_KEYS.every((key) => String(filters[key] || '') === String(view.filters[key] || '')))?.id;
  return <div role="group" aria-label={t('list.quickViews')} aria-busy={counts.isFetching} className="mb-4 flex flex-wrap gap-2">
    {QUICK_VIEWS.map((view) => <button key={view.id} type="button" aria-pressed={selected === view.id}
      className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm font-semibold transition ${selected === view.id ? 'border-brand-700 bg-brand-100 text-ink' : 'border-border bg-surface text-ink2 hover:bg-surface2'}`}
      onClick={() => update({ ...Object.fromEntries(QUICK_FILTER_KEYS.map((key) => [key, ''])), ...view.filters, page: 1 })}>
      {t(view.label)} <span className="rounded-full bg-surface2 px-2 text-xs text-ink">{counts.data?.item?.[view.id] ?? '…'}</span>
    </button>)}
    {counts.error && <button className="min-h-11 text-sm text-danger underline" onClick={() => counts.refetch()}>{t('common.retry')}</button>}
  </div>;
}
