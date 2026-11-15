import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Clipboard, FileDown, LockKeyhole, Printer } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts';
import { addDays, formatDate, formatDateTime, todayAlgiers, weekStart } from '@anm/shared';
import { api, download, queryString } from '../../api/client.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { Alert, Button, Card, EmptyState, ErrorState, IconButton, LoadingBlock, StatusBadge, useToast } from '../../components/ui/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useRefs } from '../../context/RefsContext.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { useI18n } from '../../i18n/index.jsx';

export default function ReportPage() {
  const { t, lang, dir } = useI18n();
  const { user } = useAuth();
  const { refs } = useRefs();
  const { push } = useToast();
  const [params, setParams] = useSearchParams();
  const initial = params.get('semaine') || weekStart(todayAlgiers(), Number(refs.parametres.week_start_day) || 0);
  const [week, setWeek] = useState(initial);
  const [snapshot, setSnapshot] = useState(params.get('source') === 'snapshot' ? Number(params.get('version')) : null);
  const signature = queryString({ semaine: week, source: snapshot ? 'snapshot' : 'live', version: snapshot || undefined });
  const { data: report, loading, error, reload } = useFetch(() => api(`/reports/weekly${signature}`).then((result) => result.item), [signature]);
  const { data: history, reload: reloadHistory } = useFetch(() => api(`/reports/weekly/history?semaine=${week}`).then((result) => result.items), [week]);
  useEffect(() => { setParams(snapshot ? { semaine: week, source: 'snapshot', version: String(snapshot) } : { semaine: week }, { replace: true }); }, [setParams, snapshot, week]);
  const move = (days) => { setWeek(addDays(week, days)); setSnapshot(null); };
  const freeze = async () => {
    try { const result = await api('/reports/weekly/snapshot', { method: 'POST', body: { semaine: week } }); setSnapshot(result.version); await reloadHistory(); push(t('common.success')); } catch (requestError) { push(requestError.message, 'danger'); }
  };
  const copy = async () => { await navigator.clipboard.writeText(report.resume); push(t('common.copied')); };
  if (loading) return <div className="page-container"><LoadingBlock /></div>;
  if (error) return <div className="page-container"><ErrorState message={error.message} onRetry={reload} /></div>;
  const k = report.kpis;
  const v = report.veille;
  const hasData = k.recues > 0 || k.traitees_semaine > 0 || k.stock_fin > 0;
  const pieData = [
    { key: 'non_traite', value: k.non_traite, color: 'var(--st-non)' },
    { key: 'en_cours', value: k.en_cours, color: 'var(--st-cours)' },
    { key: 'traite', value: k.traite, color: 'var(--st-traite)' },
  ];
  const author = user.full_name;
  return <div className="page-container">
<div className="no-print">
<PageHeader title={t('report.title')} actions={<>
<Button variant="secondary" disabled={!hasData} onClick={() => window.print()}>
<Printer className="h-4 w-4" />{t('report.print')}</Button>
<Button variant="secondary" disabled={!hasData} onClick={() => download(`/reports/weekly/export${queryString({ semaine: week, source: snapshot ? 'snapshot' : undefined, version: snapshot || undefined })}`, `synthese-${week}.xlsx`)}>
<FileDown className="h-4 w-4" />{t('report.excel')}</Button>{user.role !== 'lecteur' && <Button disabled={!hasData} onClick={freeze}>
<LockKeyhole className="h-4 w-4" />{t('report.freeze')}</Button>}<Button variant="ghost" disabled={!hasData} onClick={copy}>
<Clipboard className="h-4 w-4" />{t('report.copySummary')}</Button>
</>} />
<Card className="mb-5 flex flex-wrap items-center justify-between gap-3 p-3">
<div className="flex items-center gap-2">
<IconButton aria-label={t('common.previous')} onClick={() => move(-7)}>{dir === 'rtl' ? <ChevronRight /> : <ChevronLeft />}</IconButton>
<div className="min-w-52 text-center">
<p className="font-bold">{formatDate(report.semaine.debut)} → {formatDate(report.semaine.fin)}</p>
<button className="text-xs font-semibold text-brand-700" onClick={() => { setWeek(weekStart(todayAlgiers(), Number(refs.parametres.week_start_day) || 0)); setSnapshot(null); }}>{t('report.thisWeek')}</button>
</div>
<IconButton aria-label={t('common.next')} onClick={() => move(7)}>{dir === 'rtl' ? <ChevronLeft /> : <ChevronRight />}</IconButton>
</div>{history?.length > 0 && <select aria-label={t('report.history')} className="h-11 rounded-md border border-border bg-surface px-3 text-sm" value={snapshot || ''} onChange={(event) => setSnapshot(event.target.value ? Number(event.target.value) : null)}>
<option value="">{t('common.refresh')}</option>{history.map((entry) => <option key={entry.version} value={entry.version}>v{entry.version} · {formatDateTime(entry.created_at)}</option>)}</select>}</Card>{snapshot && <Alert variant="info" className="mb-5">{t('report.frozen', { date: formatDateTime(report.snapshot?.created_at) })}</Alert>}</div>
<article className="report-paper mx-auto max-w-[210mm] rounded-sm bg-surface p-6 text-ink shadow-3 sm:p-10">
<header className="border-b-2 border-brand-700 pb-5 text-center">
<p className="text-sm font-bold">{t('app.wilaya')}</p>
<p className="text-xs text-muted">{report.meta.nom_cellule}</p>
<h1 className="mt-4 text-2xl font-black">{t('report.title')}</h1>
<p className="mt-2 font-semibold">{report.semaine.label}</p>
<p className="mt-2 text-xs text-muted">{formatDateTime(report.meta.genere_le)} · <bdi>{author}</bdi>
</p>
</header>{!hasData ? <EmptyState title={t('report.empty')} compact /> : <>
<section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
<ReportKpi label={t('dashboard.received')} value={k.recues} />
<ReportKpi label={t('report.weekTreated')} value={k.traitees_semaine} />
<ReportKpi label={t('status.en_cours')} value={`${k.en_cours} (${k.pct_en_cours ?? '—'} %)`} />
<ReportKpi label={t('status.non_traite')} value={`${k.non_traite} (${k.pct_non_traite ?? '—'} %)`} />
<ReportKpi label={t('dashboard.treatmentRate')} value={k.taux_traitement === null ? '—' : `${(k.taux_traitement * 100).toFixed(1)} %`} />
<ReportKpi label={t('dashboard.avgDelay')} value={k.delai_moyen_jours ?? '—'} />
<ReportKpi label={t('report.openStock')} value={`${k.stock_fin} (${k.evolution_stock >= 0 ? '+' : ''}${k.evolution_stock})`} />
<ReportKpi label={t('dashboard.urgentOpen')} value={k.urgentes_ouvertes} />
</section>
<section className="mt-8 grid min-w-0 gap-4 sm:grid-cols-2">
<div className="h-[280px]">
<ResponsiveContainer width="100%" height="100%">
<PieChart>
<Pie data={pieData} dataKey="value" innerRadius={55} outerRadius={90}>{pieData.map((entry) => <Cell key={entry.key} fill={entry.color} />)}</Pie>
<ChartTooltip formatter={(value, name, item) => [value, t(`status.${item.payload.key}`)]} />
</PieChart>
</ResponsiveContainer>
</div>
<div className="h-[280px]">
<ResponsiveContainer width="100%" height="100%">
<BarChart data={report.groupes.domaine.slice(0, 8)} layout="vertical">
<CartesianGrid stroke="var(--border)" />
<XAxis type="number" />
<YAxis type="category" width={100} dataKey={lang === 'ar' ? 'label_ar' : 'label_fr'} tick={{ fontSize: 10 }} orientation={dir === 'rtl' ? 'right' : 'left'} />
<ChartTooltip />
<Bar dataKey="total" fill="var(--brand-600)" />
</BarChart>
</ResponsiveContainer>
</div>
</section>
<ReportTable title={t('dashboard.byCategory')} rows={report.groupes.domaine} lang={lang} t={t} />
<ReportTable title={t('dashboard.byType')} rows={report.groupes.type} lang={lang} t={t} />
<ReportTable title={t('dashboard.byDaira')} rows={report.groupes.daira} lang={lang} t={t} />
<ReportTable title={t('dashboard.byCommune')} rows={report.groupes.commune} lang={lang} t={t} />
<ReportTable title={t('dashboard.byEpic')} rows={report.groupes.epic} lang={lang} t={t} />
<ListSection title={t('report.openUrgent')} rows={report.listes.urgentes} />
<ListSection title={t('report.openLate', { days: report.meta.delai_retard_jours })} rows={report.listes.retard} />
{v && <section className="mt-8 break-before-auto">
<h2 className="mb-3 text-lg font-black">{t('report.veille.title')}</h2>
<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
<ReportKpi label={t('report.veille.collected')} value={v.totaux.collectes} />
<ReportKpi label={t('report.veille.relevant')} value={v.totaux.pertinents} />
<ReportKpi label={t('report.veille.retained')} value={v.totaux.retenus} />
<ReportKpi label={t('report.veille.converted')} value={v.totaux.convertis} />
<ReportKpi label={t('report.veille.reaction')} value={v.qualite.delai_median_heures === null ? '—' : `${v.qualite.delai_median_heures} h`} />
<ReportKpi label={t('report.veille.precision')} value={v.qualite.precision_estimee === null ? '—' : `${Math.round(v.qualite.precision_estimee * 1000) / 10} %`} />
<ReportKpi label={t('report.veille.recall')} value={v.qualite.rappel_estime === null ? '—' : `${Math.round(v.qualite.rappel_estime * 1000) / 10} %`} />
<ReportKpi label={t('report.veille.events')} value={v.evenements.length} />
</div>
<div className="mt-4 grid gap-4 sm:grid-cols-2">
<div>
<h3 className="mb-2 text-sm font-bold">{t('veille.dashboard.byGroup')}</h3>
{v.groupes.length ? <table className="w-full text-xs"><thead className="bg-surface2"><tr><th className="p-2 text-start">{t('veille.group')}</th><th>{t('common.total')}</th><th>{t('veille.dashboard.retained')}</th></tr></thead><tbody>{v.groupes.map((row) => <tr key={row.id} className="border-t border-border"><td className="p-2"><bdi>{lang === 'ar' ? row.name_ar || row.name_fr : row.name_fr}</bdi></td><td className="text-center">{row.total}</td><td className="text-center">{row.retenus}</td></tr>)}</tbody></table> : <p className="text-sm text-muted">—</p>}
</div>
<div>
<h3 className="mb-2 text-sm font-bold">{t('veille.dashboard.byCommune')}</h3>
{v.communes.length ? <table className="w-full text-xs"><thead className="bg-surface2"><tr><th className="p-2 text-start">{t('veille.commune')}</th><th>{t('common.total')}</th><th>{t('veille.dashboard.retained')}</th></tr></thead><tbody>{v.communes.map((row) => <tr key={row.id} className="border-t border-border"><td className="p-2"><bdi>{lang === 'ar' ? row.name_ar || row.name_fr : row.name_fr}</bdi></td><td className="text-center">{row.total}</td><td className="text-center">{row.retenus}</td></tr>)}</tbody></table> : <p className="text-sm text-muted">—</p>}
</div>
</div>
{v.evenements.length > 0 && <div className="mt-4"><h3 className="mb-2 text-sm font-bold">{t('veille.dashboard.events')}</h3><ul className="grid gap-2">{v.evenements.map((event) => <li key={event.id} className="flex flex-wrap justify-between gap-2 rounded-sm border border-border p-2 text-xs"><span><bdi>{lang === 'ar' ? event.groupe_ar || event.groupe_fr || '—' : event.groupe_fr || '—'}</bdi> · <bdi>{lang === 'ar' ? event.commune_ar || event.commune_fr || '—' : event.commune_fr || '—'}</bdi></span><span className="text-muted">{t('report.veille.eventLine', { elements: event.nb_elements, sources: event.nb_sources })}</span></li>)}</ul></div>}
</section>}
<footer className="mt-12 grid grid-cols-2 gap-12">
<div className="h-24 border-t border-border pt-2 text-xs text-muted">{t('report.signature')}</div>
<div className="h-24 border-t border-border pt-2 text-xs text-muted">{t('report.signature')}</div>
</footer>
</>}</article>
</div>;
}

function ReportKpi({ label, value }) { return <div className="rounded-md border border-border bg-surface2 p-3 text-center"><p className="text-xl font-black">{value}</p><p className="mt-1 text-[10px] font-semibold text-muted">{label}</p></div>; }
function ReportTable({ title, rows, lang, t }) { return <section className="mt-8 break-before-auto"><h2 className="mb-3 text-lg font-black">{title}</h2><div className="overflow-hidden rounded-sm border border-border"><table className="w-full text-xs"><thead className="bg-surface2"><tr><th className="p-2 text-start">{title}</th><th>{t('common.total')}</th><th>{t('status.non_traite')}</th><th>{t('status.en_cours')}</th><th>{t('status.traite')}</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t border-border"><td className="p-2"><bdi>{lang === 'ar' ? row.label_ar || row.label_fr : row.label_fr || row.label_ar}</bdi></td><td className="text-center">{row.total}</td><td className="text-center">{row.non_traite}</td><td className="text-center">{row.en_cours}</td><td className="text-center">{row.traite}</td></tr>)}</tbody></table></div></section>; }
function ListSection({ title, rows }) { return <section className="mt-8"><h2 className="mb-3 text-lg font-black">{title}</h2>{rows.length ? <ul className="grid gap-2 sm:grid-cols-2">{rows.map((row) => <li key={row.id} className="flex justify-between gap-2 rounded-sm border border-border p-2 text-xs"><bdi>{row.reference}</bdi><StatusBadge value={row.statut_au} /></li>)}</ul> : <p className="text-sm text-muted">—</p>}</section>; }
