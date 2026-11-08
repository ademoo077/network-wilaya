import { Copy, ExternalLink, Eye, MapPin } from 'lucide-react';
import { formatDate, formatGps, STATUTS } from '@anm/shared';
import { DataTable, IconButton, PlatformBadge, PriorityBadge, Select, StatusBadge, VerificationBadge } from '../../components/ui/index.js';
import { anomalyLabel } from './helpers.js';
import { useI18n } from '../../i18n/index.jsx';

export default function AnomalyTable({ rows, selected, onSelect, sort, dir, onSort, onPreview, onStatus, writable }) {
  const { t, lang } = useI18n();
  const copyGps = async (row) => { if (row.gps) await navigator.clipboard.writeText(formatGps(row.gps.lat, row.gps.lng)); };
  const columns = [
    { key: 'reference', label: t('field.reference'), sortable: true, render: (row) => <bdi className="font-bold text-brand-700">{row.reference}</bdi> },
    { key: 'date_signalement', label: t('field.date'), sortable: true, render: (row) => formatDate(row.date_signalement) },
    { key: 'plateforme', label: t('field.platform'), render: (row) => <PlatformBadge value={row.plateforme} /> },
    { key: 'statut', label: t('field.status'), sortable: true, render: (row) => writable ? <div onClick={(event) => event.stopPropagation()}><Select aria-label={t('field.status')} value={row.statut} options={STATUTS.map((value) => ({ value, label: t(`status.${value}`) }))} onChange={(event) => onStatus(row, event.target.value)} /></div> : <StatusBadge value={row.statut} /> },
    { key: 'domaine', label: t('field.category'), sortable: true, render: (row) => <bdi>{anomalyLabel(row, 'domaine', lang)}</bdi> },
    { key: 'type', label: t('field.type'), sortable: true, render: (row) => <bdi>{anomalyLabel(row, 'type', lang)}</bdi> },
    { key: 'daira', label: t('field.daira'), sortable: true, render: (row) => <span><bdi>{anomalyLabel(row, 'daira', lang)}</bdi><span className="block text-xs text-muted"><bdi>{anomalyLabel(row, 'commune', lang)}</bdi></span></span> },
    { key: 'epic', label: t('field.epic'), sortable: true, render: (row) => <bdi>{row.epic_name || row.intervenant_autre || '—'}</bdi> },
    { key: 'verification', label: t('field.verification'), sortable: true, render: (row) => <VerificationBadge value={row.verification} /> },
    { key: 'priorite', label: t('field.priority'), sortable: true, render: (row) => <PriorityBadge value={row.priorite} /> },
    { key: 'link', label: t('field.link'), render: (row) => <a aria-label={t('field.link')} href={row.lien_url_sur} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()} className="inline-grid h-10 w-10 place-items-center rounded-sm text-brand-700 hover:bg-brand-100"><ExternalLink className="h-4 w-4" /></a> },
    { key: 'gps', label: t('field.gps'), render: (row) => row.gps ? <IconButton aria-label={t('anomalies.copyGps')} onClick={(event) => { event.stopPropagation(); copyGps(row); }}><Copy className="h-4 w-4" /></IconButton> : '—' },
    { key: 'actions', label: t('common.actions'), render: (row) => <IconButton aria-label={t('anomalies.preview')} onClick={(event) => { event.stopPropagation(); onPreview(row); }}><Eye className="h-4 w-4" /></IconButton> },
  ];
  return <><div className="hidden md:block"><DataTable columns={columns} rows={rows} selected={selected} onSelect={onSelect} sort={sort} dir={dir} onSort={onSort} onRowClick={onPreview} /></div><div className="grid gap-3 md:hidden">{rows.map((row) => <article key={row.id} className="rounded-lg border border-border bg-surface p-4 shadow-1" onClick={() => onPreview(row)}><div className="flex items-start justify-between gap-3"><div><bdi className="font-black text-brand-700">{row.reference}</bdi><p className="mt-1 text-xs text-muted">{formatDate(row.date_signalement)}</p></div><StatusBadge value={row.statut} /></div><p className="mt-3 font-semibold"><bdi>{anomalyLabel(row, 'type', lang)}</bdi></p><p className="mt-1 flex items-center gap-1 text-sm text-muted"><MapPin className="h-4 w-4" /><bdi>{anomalyLabel(row, 'commune', lang)}</bdi></p><div className="mt-3 flex flex-wrap gap-2"><VerificationBadge value={row.verification} /><PriorityBadge value={row.priorite} /></div></article>)}</div></>;
}
