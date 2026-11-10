import { useQuery } from '@tanstack/react-query';
import { formatDateTime } from '@anm/shared';
import { api } from '../../api/client.js';
import { Button, Card, CardHeader, ErrorState, LoadingBlock } from '../../components/ui/index.js';
import { useI18n } from '../../i18n/index.jsx';
import ConnectivityAdmin from './ConnectivityAdmin.jsx';

export default function HealthAdmin() {
  const { t } = useI18n();
  const health = useQuery({ queryKey: ['health'], queryFn: ({ signal }) => api('/admin/health', { signal }) });
  const errors = useQuery({ queryKey: ['client-errors'], queryFn: ({ signal }) => api('/admin/client-errors', { signal }) });
  return <div className="grid items-start gap-6">
    <Card><CardHeader title={t('health.title')} action={<Button loading={health.isFetching} onClick={() => health.refetch()}>{t('common.refresh')}</Button>} />
      <div className="p-5">{health.isPending ? <LoadingBlock /> : health.error ? <ErrorState onRetry={health.refetch} /> :
        <dl className="grid gap-4 sm:grid-cols-2">{Object.entries({ version: health.data.version, database: health.data.integrity,
          size: `${health.data.size} octets`, protocol: health.data.https ? 'HTTPS' : 'HTTP', backup: health.data.backup || '—',
          certificate: health.data.certificate || '—' }).map(([key, value]) => <div key={key} className="min-w-0"><dt className="text-sm text-muted">{t(`health.${key}`)}</dt><dd className="break-words font-semibold"><bdi>{value}</bdi></dd></div>)}</dl>}
      </div></Card>
    <ConnectivityAdmin />
    <Card><CardHeader title={t('health.errors')} action={<Button loading={errors.isFetching} onClick={() => errors.refetch()}>{t('common.refresh')}</Button>} />
      <div className="space-y-3 p-5">{errors.isPending ? <LoadingBlock /> : errors.error ? <ErrorState onRetry={errors.refetch} /> : errors.data?.items?.length
        ? errors.data.items.map((item) => <details key={item.id} className="rounded-md border border-border p-3"><summary className="min-h-11 cursor-pointer break-words">{item.message} · {formatDateTime(item.created_at)}</summary><p className="text-sm">{item.route}</p><pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words text-xs">{item.stack}</pre></details>)
        : <p className="text-muted">{t('health.noErrors')}</p>}</div></Card>
  </div>;
}
