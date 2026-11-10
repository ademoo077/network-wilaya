import { memo, useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDate, STATUTS } from '@anm/shared';
import { Card, CardHeader, EmptyState } from '../../components/ui/index.js';
import QueryContent from '../../components/ui/QueryContent.jsx';
import StatusBars from '../../components/ui/StatusBars.jsx';
import StatusLegend from '../../components/ui/StatusLegend.jsx';
import { useI18n } from '../../i18n/index.jsx';

const colors = ['var(--st-non)', 'var(--st-cours)', 'var(--st-traite)'];
const tooltipStyle = { background: 'var(--surface)', color: 'var(--ink)', borderColor: 'var(--border)', borderRadius: 12 };
function DashboardCharts({ overview, timeline, onFilter }) {
  const { t, lang } = useI18n(); const counts = overview.data?.item?.cohorte;
  const rows = timeline.data?.items ?? [];
  const statuses = useMemo(() => STATUTS.map((key, i) => ({ key, value: counts?.[key] ?? 0, color: colors[i] })), [counts]);
  return <div className="mt-5 grid min-w-0 items-start gap-5 lg:grid-cols-2">
    <Card><CardHeader title={t('dashboard.statusDistribution')} /><QueryContent query={overview} className="p-4">
      <StatusLegend />
      <div className="relative h-[280px] min-w-0">{counts?.total ? <>
        <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statuses} dataKey="value" nameKey="key" innerRadius={70} outerRadius={105} paddingAngle={3} isAnimationActive={false}
          onClick={(entry) => onFilter({ statut: entry.key })}>{statuses.map((entry) => <Cell key={entry.key} fill={entry.color} />)}</Pie>
          <Tooltip contentStyle={tooltipStyle} formatter={(value, key) => [`${value} (${counts[`pct_${key}`]} %)`, t(`status.${key}`)]} /></PieChart></ResponsiveContainer>
        <span className="pointer-events-none absolute inset-0 grid place-content-center text-center"><strong className="text-3xl">{counts.total}</strong><span className="text-xs text-muted">{t('common.total')}</span></span>
      </> : <EmptyState title={t('dashboard.empty')} compact />}</div>
      {counts && <StatusBars row={counts} onStatus={(statut) => onFilter({ statut })} />}
    </QueryContent></Card>
    <Card><CardHeader title={t('dashboard.timeline')} /><QueryContent query={timeline} className="p-4">
      <div className="h-[320px] min-w-0">{rows.some((row) => row.recues || row.traitees) ? <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows}><CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey="debut" tickFormatter={formatDate} reversed={lang === 'ar'} tick={{ fill: 'var(--muted)', fontSize: 11 }} minTickGap={25} />
          <YAxis orientation={lang === 'ar' ? 'right' : 'left'} allowDecimals={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} width={36} />
          <Tooltip labelFormatter={formatDate} contentStyle={tooltipStyle} />
          <Area type="monotone" dataKey="recues" name={t('dashboard.received')} stroke="var(--brand-700)" fill="var(--brand-100)" isAnimationActive={false} />
          <Area type="monotone" dataKey="traitees" name={t('dashboard.treated')} stroke="var(--st-traite)" fill="transparent" isAnimationActive={false} />
        </AreaChart></ResponsiveContainer> : <EmptyState title={t('dashboard.empty')} compact />}</div>
      <p className="text-center text-xs text-muted">{t('dashboard.received')} · {t('dashboard.treated')}</p>
    </QueryContent></Card>
  </div>;
}
export default memo(DashboardCharts);
