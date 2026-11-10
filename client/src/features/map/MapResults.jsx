import { MapPin } from 'lucide-react';
import { formatDate } from '@anm/shared';
import { EmptyState, ErrorState, LoadingBlock, StatusBadge } from '../../components/ui/index.js';
import VirtualList from '../../components/ui/VirtualList.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { anomalyLabel } from '../anomalies/helpers.js';

export default function MapResults({ result, selectedId, onSelect }) {
  const { t, lang } = useI18n(); const items = result.data?.items || [];
  if (result.isPending) return <div className="p-4"><LoadingBlock /></div>;
  if (result.error) return <ErrorState onRetry={result.refetch} />;
  if (!items.length) return <EmptyState icon={MapPin} title={t('map.empty')} description={t('map.emptyHelp')} />;
  const render = (item, index) => <button type="button" data-map-row={item.id} aria-pressed={selectedId === item.id}
    className={`flex min-h-[124px] w-full items-start gap-3 border-b border-border p-3 text-start transition hover:bg-surface2 ${selectedId === item.id ? 'bg-brand-100 ring-2 ring-inset ring-brand-600' : 'bg-surface'}`}
    onClick={() => onSelect(item.id)}>
    <span className="grid h-8 min-w-8 shrink-0 place-items-center rounded-full bg-brand-100 px-1 text-xs font-bold text-brand-800" aria-hidden="true">{index + 1}</span>
    <span className="min-w-0 flex-1"><bdi className="text-sm font-bold text-brand-700">{item.reference}</bdi>
      <bdi className="my-1 block truncate text-sm font-semibold">{anomalyLabel(item, 'type', lang)}</bdi>
      <bdi className="mb-2 block truncate text-xs text-muted">{anomalyLabel(item, 'commune', lang)}</bdi>
      <span className="flex flex-wrap items-center gap-2 text-xs text-muted">{formatDate(item.date_signalement)} <StatusBadge value={item.statut} /></span>
    </span>
  </button>;
  return <VirtualList items={items} render={render} rowHeight={140} scrollToId={selectedId} className="h-full max-h-full" />;
}
