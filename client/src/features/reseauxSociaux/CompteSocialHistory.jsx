import { formatDateTime } from '@anm/shared';
import { EmptyState, ErrorState } from '../../components/ui/index.js';
import QueryContent from '../../components/ui/QueryContent.jsx';
import { useApiQuery } from '../../hooks/useApiQuery.js';
import { useI18n } from '../../i18n/index.jsx';

export default function CompteSocialHistory({ id }) {
  const { t } = useI18n(); const query = useApiQuery(`/reseaux-sociaux/${id}/historique`);
  return <section data-social-history className="rounded-lg border border-border p-4">
    <h4 className="mb-3 text-sm font-bold">{t('social.history.title')}</h4>
    <QueryContent query={query}>
      {!query.data ? <ErrorState message={t('social.badResponse')} onRetry={query.refetch} />
        : !query.data.items.length ? <EmptyState title={t('social.history.empty')} />
          : <ol className="space-y-3">{query.data.items.map((row) => {
            const key = `social.history.action.${row.action}`; const label = t(key);
            return <li key={row.id} className="flex flex-wrap items-start justify-between gap-2 border-b border-border pb-2 last:border-0">
              <div className="min-w-0"><p className="text-sm font-semibold"><bdi>{label === key ? row.action : label}</bdi></p>
                {row.username && <p className="text-xs text-muted"><bdi>{row.username}</bdi></p>}</div>
              <time className="text-xs text-muted"><bdi>{formatDateTime(row.at)}</bdi></time>
            </li>;
          })}</ol>}
    </QueryContent>
  </section>;
}
