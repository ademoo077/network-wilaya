import { useState } from 'react';
import {
  Activity, AlertTriangle, ArrowRight, BarChart3, Clock3, FilePlus2,
  Flame, Gauge, Layers, Radar, ShieldCheck, TrendingUp,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDateTime } from '@anm/shared';
import { queryString } from '../../api/client.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import {
  Card, EmptyState, KpiCard, SegmentedControl,
} from '../../components/ui/index.js';
import QueryContent from '../../components/ui/QueryContent.jsx';
import { useApiQuery } from '../../hooks/useApiQuery.js';
import { useI18n } from '../../i18n/index.jsx';
import VeilleAlertsPanel from './VeilleAlertsPanel.jsx';

function percent(value) {
  return value === null || value === undefined ? null : Math.round(Number(value) * 1000) / 10;
}

function DailyChart({ days, t }) {
  const max = Math.max(1, ...days.map((day) => day.collectes));
  return <div>
    <div className="flex h-36 items-end gap-1 border-b border-border pb-1" dir="ltr" role="img" aria-label={t('veille.dashboard.byDay')}>
      {days.map((day) => <div key={day.jour} className="group relative flex h-full min-w-0 flex-1 items-end" title={`${day.jour} · ${day.collectes}`}>
        <div className="w-full rounded-t-sm bg-brand-600 transition group-hover:bg-brand-700" style={{ height: `${Math.max(2, (day.collectes / max) * 100)}%` }} />
      </div>)}
    </div>
    <div className="mt-1 flex justify-between text-xs text-muted" dir="ltr"><span>{days[0]?.jour || '—'}</span><span>{days.at(-1)?.jour || '—'}</span></div>
  </div>;
}

function RankList({ rows, label, empty, nameKey = 'name_fr' }) {
  if (!rows?.length) return <EmptyState icon={BarChart3} title={empty} />;
  const max = Math.max(1, ...rows.map((row) => row.collectes || 0));
  return <ul className="grid gap-2">{rows.map((row) => <li key={row.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold text-ink"><bdi>{row[nameKey] || row.nom || row.name_ar || '—'}</bdi></p>
      <div className="mt-1 h-1.5 rounded-full bg-surface2"><div className="h-1.5 rounded-full bg-brand-600" style={{ width: `${Math.max(3, ((row.collectes || 0) / max) * 100)}%` }} /></div>
    </div>
    <span className="text-xs text-muted">{label(row)}</span>
  </li>)}</ul>;
}

export default function VeilleDashboardPage() {
  const { t, lang } = useI18n();
  const [period, setPeriod] = useState('30');
  const query = useApiQuery(`/veille/tableau${queryString({ jours: period })}`);
  const data = query.data?.item;
  const options = [
    { value: '7', label: t('veille.dashboard.7') },
    { value: '30', label: t('veille.dashboard.30') },
    { value: '90', label: t('veille.dashboard.90') },
  ];
  return <div className="page-container">
    <PageHeader title={t('veille.dashboard.title')} description={t('veille.dashboard.subtitle')}
      actions={<SegmentedControl label={t('veille.dashboard.period')} value={period} options={options} onChange={setPeriod} />} />
    <QueryContent query={query}>
      {data && <>
        <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <KpiCard icon={Radar} label={t('veille.dashboard.total')} value={data.totaux.collectes} />
          <KpiCard icon={Layers} label={t('veille.dashboard.relevant')} value={data.totaux.pertinents} />
          <KpiCard icon={ShieldCheck} label={t('veille.dashboard.retained')} value={data.totaux.retenus} />
          <KpiCard icon={FilePlus2} label={t('veille.dashboard.converted')} value={data.totaux.convertis} />
          <KpiCard icon={Gauge} label={t('veille.dashboard.precision')} value={percent(data.qualite.precision_estimee)} suffix=" %" decimals={1} />
          <KpiCard icon={TrendingUp} label={t('veille.dashboard.recall')} value={percent(data.qualite.rappel_estime)} suffix=" %" decimals={1} />
        </div>
        <div className="mt-4 grid items-start gap-4 md:grid-cols-2">
          <Card className="p-4">
            <h2 className="mb-3 flex items-center gap-2 font-bold text-ink"><Clock3 className="h-4 w-4" aria-hidden="true" />{t('veille.dashboard.reaction')}</h2>
            <p className="text-3xl font-black text-ink">{data.qualite.delai_median_heures === null ? '—' : `${data.qualite.delai_median_heures} h`}</p>
            <p className="mt-1 text-xs text-muted">{t('veille.dashboard.reactionHelp')}</p>
          </Card>
          <Card className="p-4">
            <h2 className="mb-3 flex items-center gap-2 font-bold text-ink"><Activity className="h-4 w-4" aria-hidden="true" />{t('veille.dashboard.treatment')}</h2>
            <p className="text-3xl font-black text-ink">{data.qualite.delai_traitement_heures === null ? '—' : `${data.qualite.delai_traitement_heures} h`}</p>
            <p className="mt-1 text-xs text-muted">{t('veille.dashboard.treatmentHelp')}</p>
          </Card>
        </div>

        <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Card className="p-4"><h2 className="mb-3 font-bold text-ink">{t('veille.dashboard.byDay')}</h2><DailyChart days={data.par_jour} t={t} /></Card>
          <VeilleAlertsPanel onChanged={() => query.refetch()} />
        </div>

        <div className="mt-4 grid items-start gap-4 md:grid-cols-2">
          <Card className="p-4"><h2 className="mb-3 font-bold text-ink">{t('veille.dashboard.bySource')}</h2>
            <RankList rows={data.par_source.slice(0, 8)} nameKey="nom" empty={t('veille.dashboard.noData')}
              label={(row) => `${row.collectes} · ${row.retenus} ${t('veille.dashboard.shortRetained')}`} /></Card>
          <Card className="p-4"><h2 className="mb-3 font-bold text-ink">{t('veille.dashboard.byGroup')}</h2>
            <RankList rows={data.par_groupe.slice(0, 8)} nameKey={lang === 'ar' ? 'name_ar' : 'name_fr'} empty={t('veille.dashboard.noData')}
              label={(row) => `${row.collectes} · ${row.retenus} ${t('veille.dashboard.shortRetained')}`} /></Card>
          <Card className="p-4"><h2 className="mb-3 font-bold text-ink">{t('veille.dashboard.byCommune')}</h2>
            <RankList rows={data.par_commune.slice(0, 8)} nameKey={lang === 'ar' ? 'name_ar' : 'name_fr'} empty={t('veille.dashboard.noData')}
              label={(row) => `${row.collectes} · ${row.retenus} ${t('veille.dashboard.shortRetained')}`} /></Card>
          <Card className="p-4"><h2 className="mb-3 flex items-center gap-2 font-bold text-ink"><TrendingUp className="h-4 w-4" aria-hidden="true" />{t('veille.dashboard.peaks')}</h2>
            {data.pics.length ? <ul className="grid gap-2">{data.pics.map((peak) => <li key={`${peak.groupe_id}-${peak.commune_id}`} className="rounded-md border border-border p-2 text-sm">
              <p className="font-semibold text-ink"><bdi>{lang === 'ar' ? peak.groupe_ar || peak.groupe_fr : peak.groupe_fr}</bdi> · <bdi>{lang === 'ar' ? peak.commune_ar || peak.commune_fr : peak.commune_fr}</bdi></p>
              <p className="text-xs text-muted">{t('veille.dashboard.peakLine', { total: peak.total_7j, mean: peak.moyenne_28j, z: peak.z })}</p>
            </li>)}</ul> : <EmptyState icon={TrendingUp} title={t('veille.dashboard.noPeaks')} />}</Card>
        </div>

        <div className="mt-4 grid items-start gap-4 md:grid-cols-2">
          <Card className="p-4"><h2 className="mb-3 flex items-center gap-2 font-bold text-ink"><Flame className="h-4 w-4" aria-hidden="true" />{t('veille.dashboard.viral')}</h2>
            {data.viral.length ? <ul className="grid gap-2">{data.viral.map((item) => <li key={item.id} className="rounded-md border border-border p-2">
              <div className="flex items-start justify-between gap-2"><p className="min-w-0 text-sm font-semibold text-ink"><bdi>{item.page_nom || t('veille.dashboard.unknownSource')}</bdi></p><span className="text-xs font-bold text-brand-700">{Math.round(item.viralite)}</span></div>
              <p className="mt-1 line-clamp-2 text-xs text-muted"><bdi>{item.texte}</bdi></p>
              <Link className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-700" to={`/veille/elements/${item.id}`}>{t('veille.dashboard.open')}<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>
            </li>)}</ul> : <EmptyState icon={Flame} title={t('veille.dashboard.noViral')} />}</Card>
          <Card className="p-4"><h2 className="mb-3 flex items-center gap-2 font-bold text-ink"><Layers className="h-4 w-4" aria-hidden="true" />{t('veille.dashboard.events')}</h2>
            {data.evenements.length ? <ul className="grid gap-2">{data.evenements.map((event) => <li key={event.id} className="rounded-md border border-border p-2 text-sm">
              <p className="font-semibold text-ink"><bdi>{lang === 'ar' ? event.groupe_ar || event.groupe_fr : event.groupe_fr || '—'}</bdi> · <bdi>{lang === 'ar' ? event.commune_ar || event.commune_fr : event.commune_fr || '—'}</bdi></p>
              <p className="text-xs text-muted">{t('veille.dashboard.eventLine', { elements: event.nb_elements, sources: event.nb_sources })} · {formatDateTime(event.fin)}</p>
            </li>)}</ul> : <EmptyState icon={Layers} title={t('veille.dashboard.noEvents')} />}</Card>
        </div>

        <Card className="mt-4 p-4"><h2 className="mb-3 flex items-center gap-2 font-bold text-ink"><AlertTriangle className="h-4 w-4" aria-hidden="true" />{t('veille.dashboard.health')}</h2>
          <div className="overflow-x-auto"><table className="w-full min-w-[36rem] text-sm">
            <thead><tr className="border-b border-border text-start text-xs uppercase text-muted"><th className="px-2 py-2 text-start">{t('veille.dashboard.source')}</th><th className="px-2 py-2 text-start">{t('veille.dashboard.status')}</th><th className="px-2 py-2 text-start">{t('veille.dashboard.lastRun')}</th><th className="px-2 py-2 text-start">{t('veille.dashboard.nextRun')}</th></tr></thead>
            <tbody>{data.sante_sources.map((source) => <tr key={source.id} className="border-b border-border last:border-0">
              <td className="px-2 py-2"><bdi>{source.nom}</bdi><span className="block text-xs text-muted">{t(`veille.sourceType.${source.type}`)}</span></td>
              <td className="px-2 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${source.actif ? 'bg-straitebg text-straite' : 'bg-surface2 text-muted'}`}>{source.actif ? t('veille.sources.active') : t('veille.sources.inactive')}</span>
                {source.job_statut && <span className="ms-1 text-xs text-muted">{t(`veille.job.${source.job_statut}`)}</span>}
                {source.erreur_message && <span className="block text-xs text-danger"><bdi>{source.erreur_message}</bdi></span>}</td>
              <td className="px-2 py-2 text-muted">{source.derniere_execution ? formatDateTime(source.derniere_execution) : t('veille.sources.never')}</td>
              <td className="px-2 py-2 text-muted">{source.prochaine_execution ? formatDateTime(source.prochaine_execution) : '—'}</td>
            </tr>)}</tbody>
          </table></div>
          {!data.sante_sources.length && <EmptyState icon={Radar} title={t('veille.dashboard.noSources')} />}
        </Card>
      </>}
    </QueryContent>
  </div>;
}
