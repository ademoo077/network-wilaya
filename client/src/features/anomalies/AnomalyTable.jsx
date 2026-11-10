import { memo } from 'react';
import { Copy, ExternalLink, Eye, MapPin } from 'lucide-react';
import { anomalyAction, formatDate, formatGps, STATUTS, VERIFICATIONS } from '@anm/shared';
import { Button, Checkbox, DataTable, IconButton, PlatformBadge, PriorityBadge, Select, StatusBadge, VerificationBadge, useToast } from '../../components/ui/index.js';
import { anomalyLabel } from './helpers.js';
import { useI18n } from '../../i18n/index.jsx';

function AnomalyTable({ rows, selected, onSelect, sort, dir, onSort, onPreview, onAction, pending, writable }) {
  const { t, lang } = useI18n(); const { push } = useToast();
  const copyGps = async (row) => { try { await navigator.clipboard.writeText(formatGps(row.gps.lat, row.gps.lng)); push(t('common.copied')); } catch (error) { push(error.message, 'danger'); } };
  const stateSelect = (row, field, values, prefix) => <div onClick={(event) => event.stopPropagation()}>
    <Select aria-label={`${t(field === 'statut' ? 'field.status' : 'field.verification')} ${row.reference}`} value={row[field]} disabled={pending.includes(row.id)}
      options={values.map((value) => { const blocked = anomalyAction(row, field, value).blocked; return { value, disabled: Boolean(blocked),
        label: `${t(`${prefix}.${value}`)}${blocked ? ` — ${t(`action.${blocked}`)}` : ''}` }; })}
      onChange={(event) => onAction(row, field, event.target.value)} />
  </div>;
  const columns = [
    { key: 'reference', label: t('field.reference'), sortable: true, render: (row) => <bdi className="font-bold text-brand-700">{row.reference}</bdi> },
    { key: 'date_signalement', label: t('field.date'), sortable: true, render: (row) => formatDate(row.date_signalement) },
    { key: 'plateforme', label: t('field.platform'), render: (row) => <PlatformBadge value={row.plateforme} /> },
    { key: 'statut', label: t('field.status'), sortable: true, render: (row) => writable ? stateSelect(row, 'statut', STATUTS, 'status') : <StatusBadge value={row.statut} /> },
    { key: 'domaine', label: t('field.category'), sortable: true, render: (row) => <bdi>{anomalyLabel(row, 'domaine', lang)}</bdi> },
    { key: 'type', label: t('field.type'), sortable: true, render: (row) => <bdi>{anomalyLabel(row, 'type', lang)}</bdi> },
    { key: 'daira', label: t('field.daira'), sortable: true, render: (row) => <span><bdi>{anomalyLabel(row, 'daira', lang)}</bdi><span className="block text-xs text-muted"><bdi>{anomalyLabel(row, 'commune', lang)}</bdi></span></span> },
    { key: 'epic', label: t('field.epic'), sortable: true, render: (row) => <bdi>{row.epic_name || row.intervenant_autre || '—'}</bdi> },
    { key: 'verification', label: t('field.verification'), sortable: true, render: (row) => writable ? stateSelect(row, 'verification', VERIFICATIONS, 'verification') : <VerificationBadge value={row.verification} /> },
    { key: 'priorite', label: t('field.priority'), sortable: true, render: (row) => <PriorityBadge value={row.priorite} /> },
    { key: 'link', label: t('field.link'), render: (row) => <a aria-label={t('field.link')} href={row.lien_url_sur} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()} className="inline-grid h-11 w-11 place-items-center rounded-sm text-brand-700 hover:bg-brand-100"><ExternalLink className="h-4 w-4" /></a> },
    { key: 'gps', label: t('field.gps'), render: (row) => row.gps ? <IconButton aria-label={t('anomalies.copyGps')} onClick={(event) => { event.stopPropagation(); copyGps(row); }}><Copy className="h-4 w-4" /></IconButton> : '—' },
    { key: 'actions', label: t('common.actions'), render: (row) => <IconButton aria-label={t('anomalies.preview')} onClick={(event) => { event.stopPropagation(); onPreview(row); }}><Eye className="h-4 w-4" /></IconButton> },
  ];
  return <><div className="hidden md:block"><DataTable columns={columns} rows={rows} selected={selected} onSelect={writable ? onSelect : undefined} sort={sort} dir={dir} onSort={onSort} onRowClick={onPreview} /></div>
    <div className="grid gap-3 p-3 md:hidden">{rows.map((row) => <article key={row.id} className="rounded-lg border border-border bg-surface p-4 shadow-1">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><Button variant="ghost" onClick={() => onPreview(row)}><bdi className="font-black text-brand-700">{row.reference}</bdi></Button>
        <p className="text-xs text-muted">{formatDate(row.date_signalement)}</p></div>{writable && <Checkbox aria-label={row.reference} checked={selected.includes(row.id)} onChange={() => onSelect(selected.includes(row.id) ? selected.filter((id) => id !== row.id) : [...selected, row.id])} />}</div>
      <p className="mt-3 font-semibold"><bdi>{anomalyLabel(row, 'type', lang)}</bdi></p><p className="mt-1 flex items-center gap-1 text-sm text-muted"><MapPin className="h-4 w-4" /><bdi>{anomalyLabel(row, 'commune', lang)}</bdi></p>
      <div className="mt-3 grid gap-2">{writable ? <>{stateSelect(row, 'statut', STATUTS, 'status')}{stateSelect(row, 'verification', VERIFICATIONS, 'verification')}</> : <><StatusBadge value={row.statut} /><VerificationBadge value={row.verification} /></>}<PriorityBadge value={row.priorite} /></div>
    </article>)}</div></>;
}
export default memo(AnomalyTable);
