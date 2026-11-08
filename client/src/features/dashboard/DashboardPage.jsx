import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Gauge as GaugeIcon, ListChecks, Timer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts';
import { addDays, formatDate, formatDateTime, monthStart, todayAlgiers, weekEnd, weekStart } from '@anm/shared';
import { api, queryString } from '../../api/client.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { Alert, Button, Card, CardHeader, Checkbox, EmptyState, ErrorState, Gauge, KpiCard, LoadingBlock, SegmentedControl } from '../../components/ui/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useRefs } from '../../context/RefsContext.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { useI18n } from '../../i18n/index.jsx';

function periodFor(key, weekStartDay) {
  const today = todayAlgiers();
  if (key === 'lastWeek') { const end = addDays(weekStart(today, weekStartDay), -1); return { from: addDays(end, -6), to: end }; }
  if (key === 'month') return { from: monthStart(today), to: today };
  if (key === 'last30') return { from: addDays(today, -29), to: today };
  if (key === 'all') return { all_periods: 1 };
  return { from: weekStart(today, weekStartDay), to: weekEnd(today, weekStartDay) };
}

export default function DashboardPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const { refs } = useRefs();
  const navigate = useNavigate();
  const [period, setPeriod] = useState('week');
  const [includeDenied, setIncludeDenied] = useState(false);
  const params = useMemo(() => ({ ...periodFor(period, Number(refs.parametres.week_start_day) || 0), include_infirmees: includeDenied ? 1 : undefined }), [includeDenied, period, refs.parametres.week_start_day]);
  const signature = queryString(params);
  const { data, loading, error, reload } = useFetch(async () => {
    const [overview, timeline, domains, types, dairas, communes, epics, activity] = await Promise.all([
      api(`/stats/overview${signature}`), api(`/stats/timeline${signature}`),
      ...['domaine', 'type', 'daira', 'commune', 'epic'].map((by) => api(`/stats/group${queryString({ ...params, by })}`)),
      api('/stats/activite?limit=10'),
    ]);
    return { overview: overview.item, timeline: timeline.items, domains: domains.item, types: types.item, dairas: dairas.item, communes: communes.item, epics: epics.item, activity: activity.items };
  }, [signature]);
  const go = (filter = {}) => navigate(`/anomalies${queryString({ ...params, all_periods: undefined, ...filter })}`);
  if (loading) return <div className="page-container"><LoadingBlock /></div>;
  if (error) return <div className="page-container"><ErrorState message={error.message} onRetry={reload} /></div>;
  const o = data.overview;
  const c = o.cohorte;
  const statusData = [
    { key: 'non_traite', value: c.non_traite, pct: c.pct_non_traite, color: 'var(--st-non)' },
    { key: 'en_cours', value: c.en_cours, pct: c.pct_en_cours, color: 'var(--st-cours)' },
    { key: 'traite', value: c.traite, pct: c.pct_traite, color: 'var(--st-traite)' },
  ];
  const options = [
    ['week', 'dashboard.thisWeek'], ['lastWeek', 'dashboard.lastWeek'], ['month', 'dashboard.thisMonth'],
    ['last30', 'dashboard.last30'], ['all', 'dashboard.allPeriods'],
  ].map(([value, key]) => ({ value, label: t(key) }));
  return <div className="page-container"><PageHeader title={t('dashboard.hello', { name: user.full_name })} description={`${formatDate(o.periode.aujourd_hui)} · ${t('dashboard.scope')}`} actions={<Button onClick={() => navigate('/anomalies/nouvelle')}>{t('nav.new')}</Button>} /><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><SegmentedControl label={t('common.filters')} value={period} options={options} onChange={setPeriod} /><Checkbox label={t('dashboard.includeDenied')} checked={includeDenied} onChange={(event) => setIncludeDenied(event.target.checked)} /></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6"><KpiCard icon={ListChecks} label={t('common.total')} value={c.total} variation={o.variations?.total} onClick={() => go()} /><KpiCard icon={AlertTriangle} label={t('status.non_traite')} value={c.non_traite} variation={o.variations?.non_traite} onClick={() => go({ statut: 'non_traite' })} /><KpiCard icon={Clock3} label={t('status.en_cours')} value={c.en_cours} variation={o.variations?.en_cours} onClick={() => go({ statut: 'en_cours' })} /><KpiCard icon={CheckCircle2} label={t('status.traite')} value={c.traite} variation={o.variations?.traite} onClick={() => go({ statut: 'traite' })} /><KpiCard icon={GaugeIcon} label={t('dashboard.treatmentRate')} value={(o.taux_traitement || 0) * 100} suffix=" %" decimals={1} variation={o.variations?.taux_traitement}><Gauge value={(o.taux_traitement || 0) * 100} /></KpiCard><KpiCard icon={Timer} label={t('dashboard.avgDelay')} value={o.delai_moyen_jours || 0} suffix={` ${t('dashboard.days')}`} decimals={1} variation={o.variations?.delai_moyen_jours} /></div><div className="mt-4 grid gap-4 md:grid-cols-2"><Alert variant="danger" title={t('dashboard.urgentOpen')} action={<Button size="sm" variant="ghost" onClick={() => go({ priorite: 'urgente' })}>{o.urgentes_ouvertes}</Button>}>{t('priority.urgente')}</Alert><Alert variant="warning" title={t('dashboard.late', { days: o.periode.delai_retard_jours })} action={<Button size="sm" variant="ghost" onClick={() => go()}>{o.en_retard}</Button>}>{t('status.non_traite')}</Alert></div><div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-2"><Card className="min-w-0"><CardHeader title={t('dashboard.statusDistribution')} /><div className="h-[320px] p-4">{c.total ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statusData} dataKey="value" nameKey="key" innerRadius={72} outerRadius={108} paddingAngle={3}>{statusData.map((entry) => <Cell key={entry.key} fill={entry.color} />)}</Pie><ChartTooltip formatter={(value, name, item) => [`${value} (${item.payload.pct ?? '—'} %)`, t(`status.${name}`)]} /></PieChart></ResponsiveContainer> : <EmptyState title={t('dashboard.empty')} compact />}</div></Card><Card className="min-w-0"><CardHeader title={t('dashboard.timeline')} /><div className="h-[320px] p-4">{data.timeline.some((row) => row.recues || row.traitees) ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={data.timeline}><defs><linearGradient id="received" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--brand-600)" stopOpacity=".5" /><stop offset="100%" stopColor="var(--brand-600)" stopOpacity="0" /></linearGradient></defs><CartesianGrid stroke="var(--border)" strokeDasharray="3 3" /><XAxis dataKey="debut" tickFormatter={formatDate} reversed={lang === 'ar'} /><YAxis orientation={lang === 'ar' ? 'right' : 'left'} /><ChartTooltip labelFormatter={formatDate} /><Area type="monotone" dataKey="recues" name={t('dashboard.received')} stroke="var(--brand-600)" fill="url(#received)" /><Area type="monotone" dataKey="traitees" name={t('dashboard.treated')} stroke="var(--st-traite)" fill="transparent" /></AreaChart></ResponsiveContainer> : <EmptyState title={t('dashboard.empty')} compact />}</div></Card></div><div className="mt-5 grid gap-5 xl:grid-cols-3"><GroupCard title={t('dashboard.byCategory')} group={data.domains} onClick={(id) => go({ domaine: id })} lang={lang} /><GroupCard title={t('dashboard.byDaira')} group={data.dairas} onClick={(id) => go({ daira: id })} lang={lang} /><Card><CardHeader title={t('dashboard.recent')} /><ul className="divide-y divide-border">{data.activity.length ? data.activity.map((item) => <li key={item.id} className="p-4 text-sm"><button className="font-bold text-brand-700" onClick={() => navigate(`/anomalies/${item.anomalie_id}`)}><bdi>{item.reference}</bdi></button><p className="mt-1 text-xs text-muted"><bdi>{item.user_nom || item.user_username || '—'}</bdi> · {formatDateTime(item.at)}</p></li>) : <EmptyState title={t('common.noData')} compact />}</ul></Card></div></div>;
}

function GroupCard({ title, group, onClick, lang }) {
  return <Card><CardHeader title={title} /><div className="space-y-3 p-4">{group.rows.slice(0, 8).map((row) => <button key={row.id} className="block w-full text-start" onClick={() => onClick(row.id)}><span className="flex justify-between gap-2 text-xs"><bdi className="truncate font-semibold">{lang === 'ar' ? row.label_ar || row.label_fr : row.label_fr || row.label_ar}</bdi><span>{row.total}</span></span><span className="mt-1 flex h-2 overflow-hidden rounded-full bg-surface2"><span className="bg-stnon" style={{ width: `${row.pct_non_traite || 0}%` }} /><span className="bg-stcours" style={{ width: `${row.pct_en_cours || 0}%` }} /><span className="bg-straite" style={{ width: `${row.pct_traite || 0}%` }} /></span></button>)}</div></Card>;
}
