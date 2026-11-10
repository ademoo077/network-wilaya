import { Link } from 'react-router-dom';
import { formatDate, formatDateTime } from '@anm/shared';
import { Card, CardHeader, EmptyState } from '../../components/ui/index.js';
import QueryContent from '../../components/ui/QueryContent.jsx';
import { useApiQuery } from '../../hooks/useApiQuery.js';
import { useI18n } from '../../i18n/index.jsx';
import { historyLabel } from '../anomalies/helpers.js';

function valueLabel(value, field, t) {
  if (value === null || value === undefined || value === '') return '—';
  const prefix = { statut: 'status', verification: 'verification', priorite: 'priority', plateforme: 'platform' }[field];
  if (prefix) return t(`${prefix}.${value}`);
  if (field.startsWith('date_')) return formatDate(value);
  return String(value);
}
function Change({ item }) {
  const { t } = useI18n();
  return <span>{item.champ === 'creation' ? t('activity.created') : <>{historyLabel(item.champ, t)} : <bdi>{valueLabel(item.ancienne_valeur, item.champ, t)}</bdi> → <bdi>{valueLabel(item.nouvelle_valeur, item.champ, t)}</bdi></>}
    {item.motif && <span className="block text-muted">{t('field.reason')} : <bdi>{item.motif}</bdi></span>}</span>;
}
export default function ActivityCard() {
  const { t } = useI18n(); const query = useApiQuery('/stats/activite?limit=10'); const items = query.data?.items ?? [];
  return <Card><CardHeader title={t('dashboard.recent')} /><QueryContent query={query} className="p-4">
    <ul className="max-h-[520px] divide-y divide-border overflow-auto">
      {items.map((item) => <li key={item.id} className="py-3 text-sm">
        <Link className="inline-flex min-h-11 items-center rounded-sm font-bold text-brand-700 underline" to={`/anomalies/${item.anomalie_id}`}><bdi>{item.reference}</bdi></Link>
        {item.changements?.length > 1 ? <details><summary className="min-h-11 cursor-pointer py-3 font-semibold">{t(item.modifications === 1 ? 'activity.change' : 'activity.changes', { count: item.modifications })}</summary>
          <ul className="space-y-2 ps-4">{(item.changements ?? []).map((change, index) => <li key={index}><Change item={change} /></li>)}</ul></details> : <p><Change item={item.changements?.[0] || item} /></p>}
        <p className="mt-1 text-xs text-muted"><bdi>{item.user_nom || item.user_username || '—'}</bdi> · {formatDateTime(item.at)}</p>
      </li>)}
    </ul>{!items.length && <EmptyState title={t('common.noData')} compact />}
  </QueryContent></Card>;
}
