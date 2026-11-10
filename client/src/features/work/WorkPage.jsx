import { BellRing, CheckCircle2, HardDrive, ListTodo, RefreshCw, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { queryString } from '../../api/client.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { Button, Card, EmptyState } from '../../components/ui/index.js';
import QueryContent from '../../components/ui/QueryContent.jsx';
import { useApiQuery } from '../../hooks/useApiQuery.js';
import { useI18n } from '../../i18n/index.jsx';

const severity = {
  critique: 'border-danger/40 bg-danger/10 text-danger',
  attention: 'border-warning/40 bg-warning/10 text-ink',
  info: 'border-border bg-surface2 text-ink2',
};

function AlertRow({ icon: Icon, text }) {
  return <li className="flex items-start gap-2 text-sm"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" /><span>{text}</span></li>;
}

/** Page « À faire » : mêmes compteurs que la cloche et que les listes filtrées. */
export default function WorkPage() {
  const { t, lang } = useI18n(); const query = useApiQuery('/work');
  const data = query.data?.item; const items = (data?.items || []).filter((item) => item.count > 0);
  const alerts = Object.entries(data?.alertes || {}).filter(([, value]) => value > 0);
  const updated = data?.calcule_le ? new Date(data.calcule_le).toLocaleString(lang === 'ar' ? 'ar-DZ' : 'fr-DZ') : '';
  return <div className="page-container">
    <PageHeader title={t('work.title')} description={t('work.subtitle')}
      actions={<Button variant="secondary" loading={query.isFetching} onClick={() => query.reload()}>
        <RefreshCw className="h-4 w-4" />{t('work.refresh')}</Button>} />
    <QueryContent query={query}>
      <p role="status" className="mb-4 text-sm font-bold">{t('work.total', { count: data?.total || 0 })}</p>
      {items.length ? <ul className="grid gap-3 md:grid-cols-2" aria-label={t('work.title')}>
        {items.map((item) => <li key={item.id}>
          <Link to={`/anomalies${queryString({ ...item.filters, page: 1 })}`}
            className="flex min-h-16 items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4 shadow-1 transition hover:border-brand-600 hover:bg-surface2">
            <span className="flex min-w-0 items-center gap-3"><ListTodo className="h-5 w-5 shrink-0 text-brand-700" aria-hidden="true" />
              <span className="min-w-0"><span className="block font-bold">{t(item.label)}</span>
                <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${severity[item.gravite] || severity.info}`}>
                  {t(`work.${item.gravite}`)}</span></span></span>
            <span aria-hidden="true" className="text-2xl font-black tabular-nums">{item.count}</span>
            <span className="sr-only">{t('work.open')}</span>
          </Link></li>)}
      </ul> : <EmptyState icon={CheckCircle2} title={t('work.empty')} description={t('work.empty')} />}
      {alerts.length > 0 && <Card className="mt-4 p-4">
        <h2 className="mb-2 flex items-center gap-2 font-bold"><ShieldAlert className="h-4 w-4 text-danger" aria-hidden="true" />{t('work.alerts')}</h2>
        <ul className="grid gap-2">{alerts.map(([key]) => <AlertRow key={key}
          icon={key === 'sauvegarde_manquante' ? HardDrive : BellRing}
          text={t(key === 'sauvegarde_manquante' ? 'work.alertBackup' : 'work.alertCertificate')} />)}</ul>
      </Card>}
      {updated && <p className="mt-4 text-xs text-muted">{t('work.updated', { date: updated })}</p>}
    </QueryContent>
  </div>;
}
