import { memo, useMemo, useState } from 'react';
import { normalize } from '@anm/shared';
import { queryString } from '../../api/client.js';
import { Button, Card, CardHeader, EmptyState, Input } from '../../components/ui/index.js';
import QueryContent from '../../components/ui/QueryContent.jsx';
import StatusBars from '../../components/ui/StatusBars.jsx';
import { useApiQuery } from '../../hooks/useApiQuery.js';
import { useI18n } from '../../i18n/index.jsx';

function GroupCard({ title, by, params, onFilter }) {
  const { t, lang } = useI18n(); const [expanded, setExpanded] = useState(false); const [search, setSearch] = useState('');
  const query = useApiQuery(`/stats/group${queryString({ ...params, by })}`);
  const rows = useMemo(() => (query.data?.item?.rows ?? []).filter((row) => normalize(`${row.label_ar || ''} ${row.label_fr || ''}`).includes(normalize(search))), [query.data, search]);
  return <Card data-group={by}>
    <CardHeader title={title} action={rows.length > 12 && <Button size="sm" variant="ghost" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
      {t(expanded ? 'common.showLess' : 'dashboard.viewAll')} ({rows.length})</Button>} />
    <QueryContent query={query} className="p-4">
      {by === 'type' && <Input label={t('field.type')} placeholder={t('form.typePlaceholder')} value={search} onChange={(event) => setSearch(event.target.value)} />}
      <div className="max-h-[420px] space-y-3 overflow-auto">
        {(expanded ? rows : rows.slice(0, 12)).map((row) => <div key={row.id} className="border-b border-border pb-2 last:border-0">
          <button className="flex min-h-11 w-full items-center justify-between gap-2 rounded-sm text-start hover:bg-surface2" onClick={() => onFilter({ [by]: row.id })}>
            <bdi className="min-w-0 truncate text-sm font-semibold">{lang === 'ar' ? row.label_ar || row.label_fr : row.label_fr || row.label_ar}</bdi>
            <strong className="text-sm">{row.total}</strong>
          </button>
          <StatusBars row={row} onStatus={(statut) => onFilter({ [by]: row.id, statut })} />
        </div>)}
        {!rows.length && <EmptyState title={t('dashboard.empty')} compact />}
      </div>
    </QueryContent>
  </Card>;
}
export default memo(GroupCard);
