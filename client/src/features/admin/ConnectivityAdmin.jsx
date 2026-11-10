import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import { Alert, Button, Card, CardHeader } from '../../components/ui/index.js';
import { useI18n } from '../../i18n/index.jsx';

export default function ConnectivityAdmin() {
  const { t } = useI18n();
  const query = useQuery({ queryKey: ['connectivity'], enabled: false, staleTime: 60000,
    queryFn: ({ signal }) => api('/admin/connectivity', { method: 'POST', signal }) });
  const result = query.data;
  return <Card><CardHeader title={t('health.connectivity')} action={<Button onClick={() => query.refetch()} loading={query.isFetching}>{t('health.test')}</Button>} />
    <div className="p-5" aria-live="polite" aria-busy={query.isFetching}>
      {query.error ? <Alert variant="danger">{t('health.advice.NETWORK_UNAVAILABLE')}</Alert> : result ? <>
        <Alert variant={result.ok ? 'success' : 'danger'}>{t(`health.advice.${result.code}`)}</Alert>
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">{['dns', 'https', 'proxy'].map((key) => <div key={key}><dt className="text-sm text-muted">{key === 'proxy' ? t('health.proxy') : key.toUpperCase()}</dt><dd className="font-semibold">{t(result[key] ? 'common.yes' : 'common.no')}</dd></div>)}</dl>
        {result.cache && <p className="mt-3 text-xs text-muted">{t('health.cached')}</p>}
      </> : <p className="text-muted">{t('health.testHelp')}</p>}
    </div></Card>;
}
