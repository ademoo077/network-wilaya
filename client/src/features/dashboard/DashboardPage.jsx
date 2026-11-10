import { useCallback, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Gauge as GaugeIcon, ListChecks, Timer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { addDays, formatDate, monthStart, todayAlgiers, weekEnd, weekStart } from '@anm/shared';
import { queryString } from '../../api/client.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { Alert, Button, Checkbox, Gauge, Input, KpiCard, SegmentedControl } from '../../components/ui/index.js';
import QueryContent from '../../components/ui/QueryContent.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useRefs } from '../../context/RefsContext.jsx';
import { useApiQuery } from '../../hooks/useApiQuery.js';
import { useI18n } from '../../i18n/index.jsx';
import ActivityCard from './ActivityCard.jsx';
import DashboardCharts from './DashboardCharts.jsx';
import GroupCard from './GroupCard.jsx';

function periodFor(key, weekStartDay, custom) {
  const today = todayAlgiers();
  if (key === 'custom') return custom;
  if (key === 'lastWeek') { const end = addDays(weekStart(today, weekStartDay), -1); return { from: addDays(end, -6), to: end }; }
  if (key === 'month') return { from: monthStart(today), to: today };
  if (key === 'last30') return { from: addDays(today, -29), to: today };
  if (key === 'all') return { all_periods: 1 };
  return { from: weekStart(today, weekStartDay), to: weekEnd(today, weekStartDay) };
}
const dimensions = [['domaine', 'byCategory'], ['daira', 'byDaira'], ['type', 'byType'], ['commune', 'byCommune'], ['epic', 'byEpic']];
export default function DashboardPage() {
  const { t } = useI18n(); const { user } = useAuth(); const { refs } = useRefs(); const navigate = useNavigate();
  const [period, setPeriod] = useState('week'); const [includeDenied, setIncludeDenied] = useState(false);
  const [custom, setCustom] = useState({ from: monthStart(todayAlgiers()), to: todayAlgiers() });
  const params = useMemo(() => ({ ...periodFor(period, Number(refs.parametres.week_start_day) || 0, custom),
    include_infirmees: includeDenied ? 1 : undefined }), [includeDenied, period, custom, refs.parametres.week_start_day]);
  const overview = useApiQuery(`/stats/overview${queryString(params)}`);
  const timeline = useApiQuery(`/stats/timeline${queryString({ include_infirmees: params.include_infirmees, to: params.to })}`);
  const go = useCallback((filter = {}) => navigate(`/anomalies${queryString({ ...params, all_periods: undefined, ...filter })}`), [navigate, params]);
  const o = overview.data?.item; const c = o?.cohorte;
  const options = [['week', 'thisWeek'], ['lastWeek', 'lastWeek'], ['month', 'thisMonth'], ['last30', 'last30'], ['all', 'allPeriods'], ['custom', 'custom']]
    .map(([value, key]) => ({ value, label: t(`dashboard.${key}`) }));
  return <div className="page-container">
    <PageHeader title={t('dashboard.hello', { name: user.full_name })} description={`${formatDate(todayAlgiers())} · ${t('dashboard.scope')}`}
      actions={user.role !== 'lecteur' && <Button onClick={() => navigate('/anomalies/nouvelle')}>{t('nav.new')}</Button>} />
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><SegmentedControl label={t('common.filters')} value={period} options={options} onChange={setPeriod} />
      <Checkbox label={t('dashboard.includeDenied')} checked={includeDenied} onChange={(event) => setIncludeDenied(event.target.checked)} /></div>
    {period === 'custom' && <div className="mb-5 grid gap-3 sm:grid-cols-2">
      <Input type="date" label={t('field.from')} value={custom.from} max={custom.to} onChange={(event) => setCustom({ ...custom, from: event.target.value })} />
      <Input type="date" label={t('field.to')} value={custom.to} min={custom.from} onChange={(event) => setCustom({ ...custom, to: event.target.value })} />
    </div>}
    <QueryContent query={overview}>
      {c && <><div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <KpiCard icon={ListChecks} label={t('common.total')} value={c.total} variation={o.variations?.total} onClick={() => go()} />
        <KpiCard icon={AlertTriangle} label={t('status.non_traite')} value={c.non_traite} variation={o.variations?.non_traite} onClick={() => go({ statut: 'non_traite' })} />
        <KpiCard icon={Clock3} label={t('status.en_cours')} value={c.en_cours} variation={o.variations?.en_cours} onClick={() => go({ statut: 'en_cours' })} />
        <KpiCard icon={CheckCircle2} label={t('status.traite')} value={c.traite} variation={o.variations?.traite} onClick={() => go({ statut: 'traite' })} />
        <KpiCard icon={GaugeIcon} label={t('dashboard.treatmentRate')} value={o.taux_traitement === null ? null : o.taux_traitement * 100} suffix=" %" decimals={1} variation={o.variations?.taux_traitement}>
          <Gauge value={(o.taux_traitement || 0) * 100} /></KpiCard>
        <KpiCard icon={Timer} label={t('dashboard.avgDelay')} value={o.delai_moyen_jours} suffix={` ${t('dashboard.days')}`} decimals={1} variation={o.variations?.delai_moyen_jours} />
      </div><div className="mt-4 grid items-start gap-4 md:grid-cols-2">
        <Alert variant="danger" title={t('dashboard.urgentOpen')} action={<Button size="sm" variant="ghost" onClick={() => go({ from: undefined, to: undefined, priorite: 'urgente', ouvertes: 1 })}>{o.urgentes_ouvertes}</Button>}>{t('priority.urgente')}</Alert>
        <Alert variant="warning" title={t('dashboard.late', { days: o.periode.delai_retard_jours })} action={<Button size="sm" variant="ghost" onClick={() => go({ from: undefined, to: undefined, retard: 1 })}>{o.en_retard}</Button>}>{t('dashboard.openStock')}</Alert>
      </div></>}
    </QueryContent>
    <DashboardCharts overview={overview} timeline={timeline} onFilter={go} />
    <div className="mt-5 grid items-start gap-5 xl:grid-cols-2">
      {dimensions.map(([by, title]) => <GroupCard key={by} title={t(`dashboard.${title}`)} by={by} params={params} onFilter={go} />)}
    </div>
    <div className="mt-5"><ActivityCard /></div>
  </div>;
}
