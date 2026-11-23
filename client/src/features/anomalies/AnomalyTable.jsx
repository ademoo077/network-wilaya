import { memo } from 'react';
import { Copy, ExternalLink, Eye, MapPin } from 'lucide-react';
import { anomalyAction, formatDate, formatGps, STATUTS } from '@anm/shared';
import { Button, Checkbox, DataTable, IconButton, PlatformBadge, PriorityBadge, Select, StatusBadge, useToast } from '../../components/ui/index.js';
import { anomalyLabel } from './helpers.js';
import { COLUMN_LABELS, STANDARD_COLUMNS } from './list/useListPreferences.js';
import { useI18n } from '../../i18n/index.jsx';

function AnomalyTable({ rows, selected, onSelect, sort, dir, onSort, onPreview, onAction, pending, writable,
  columns = STANDARD_COLUMNS, mode = 'standard', density = 'comfortable', activeIndex = -1, onRowFocus,
  widths = {}, onResizeColumn }) {
  const { t, lang } = useI18n(); const { push } = useToast();
  const compact = density === 'compact';
  const resizeStart = (event, key) => {
    if (!onResizeColumn) return;
    event.preventDefault(); event.stopPropagation();
    const handle = event.currentTarget;
    const depart = handle.parentElement.getBoundingClientRect().width;
    const x = event.clientX;
    handle.setPointerCapture?.(event.pointerId);
    const move = (moveEvent) => onResizeColumn(key, depart + moveEvent.clientX - x);
    const end = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  };
  const copyGps = async (row) => {
    try { await navigator.clipboard.writeText(formatGps(row.gps.lat, row.gps.lng)); push(t('common.copied')); }
    catch (error) { push(error.message, 'danger'); }
  };
  const stateSelect = (row) => <div onClick={(event) => event.stopPropagation()}>
    <Select aria-label={`${t('field.status')} ${row.reference}`} value={row.statut} disabled={pending.includes(row.id)}
      options={STATUTS.map((value) => { const blocked = anomalyAction(row, 'statut', value).blocked; return { value, disabled: Boolean(blocked),
        label: `${t(`status.${value}`)}${blocked ? ` — ${t(`action.${blocked}`)}` : ''}` }; })}
      onChange={(event) => onAction(row, 'statut', event.target.value)} />
  </div>;
  const thumb = (id, role) => id
    ? <img src={`/api/photos/${id}/thumb`} alt={t(`photo.${role}`)} className="h-12 w-12 shrink-0 rounded-sm object-cover" loading="lazy" />
    : <span className="grid h-12 w-12 shrink-0 place-items-center rounded-sm bg-surface2 text-xs text-muted">—</span>;
  const renderers = {
    reference: (row) => <bdi title={row.reference} className={`block whitespace-nowrap font-bold text-brand-700 ${compact ? 'text-xs' : 'text-sm'}`}>{row.reference}</bdi>,
    date_signalement: (row) => <span className="whitespace-nowrap text-xs">{formatDate(row.date_signalement)}</span>,
    statut: (row) => writable ? stateSelect(row) : <StatusBadge value={row.statut} />,
    photos: (row) => <span className="inline-flex items-center gap-1" data-photo-cell>
      {thumb(row.photo_avant_id, 'avant')}{thumb(row.photo_apres_id, 'apres')}
      <span className="text-xs font-bold text-ink2">+{(row.photos_avant_count || 0) + (row.photos_apres_count || 0)}</span>
      {row.statut === 'traite' && !row.photos_apres_count && <span role="img" aria-label={t('photo.required')} className="text-danger">⚠</span>}
    </span>,
    categorie: (row) => <span className="block max-w-56 truncate text-xs"><bdi>{anomalyLabel(row, 'domaine', lang)}</bdi> <span className="text-muted">›</span> <bdi>{anomalyLabel(row, 'type', lang)}</bdi></span>,
    commune: (row) => <span className="block max-w-40 truncate text-xs"><bdi>{anomalyLabel(row, 'commune', lang)}</bdi><span className="block text-muted"><bdi>{anomalyLabel(row, 'daira', lang)}</bdi></span></span>,
    agent: (row) => row.agent_name
      ? <bdi className="block max-w-32 truncate text-xs">{row.agent_name}</bdi>
      : <span className="inline-flex rounded-full bg-surface2 px-2 py-0.5 text-xs font-semibold text-muted">{t('list.nonAffectees')}</span>,
    epic: (row) => <bdi className="block max-w-32 truncate text-xs">{row.epic_name || row.intervenant_autre || '—'}</bdi>,
    priorite: (row) => <PriorityBadge value={row.priorite} />,
    source: (row) => <PlatformBadge value={row.plateforme} />,
    actions: (row) => <span className="inline-flex items-center gap-0.5">
      <IconButton aria-label={t('anomalies.preview')} onClick={(event) => { event.stopPropagation(); onPreview(row); }}><Eye className="h-4 w-4" /></IconButton>
      {row.lien_url_sur && <a aria-label={t('field.link')} href={row.lien_url_sur} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()} className="inline-grid h-11 w-11 place-items-center rounded-sm text-brand-700 hover:bg-brand-100"><ExternalLink className="h-4 w-4" /></a>}
      {row.gps && <IconButton aria-label={t('anomalies.copyGps')} onClick={(event) => { event.stopPropagation(); copyGps(row); }}><Copy className="h-4 w-4" /></IconButton>}
    </span>,
    plateforme: (row) => <PlatformBadge value={row.plateforme} />,
    domaine: (row) => <bdi className="text-xs">{anomalyLabel(row, 'domaine', lang)}</bdi>,
    type: (row) => <bdi className="text-xs">{anomalyLabel(row, 'type', lang)}</bdi>,
    daira: (row) => <bdi className="text-xs">{anomalyLabel(row, 'daira', lang)}</bdi>,
    link: (row) => row.lien_url_sur ? <a aria-label={t('field.link')} href={row.lien_url_sur} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()} className="inline-grid h-11 w-11 place-items-center rounded-sm text-brand-700 hover:bg-brand-100"><ExternalLink className="h-4 w-4" /></a> : '—',
    gps: (row) => row.gps ? <IconButton aria-label={t('anomalies.copyGps')} onClick={(event) => { event.stopPropagation(); copyGps(row); }}><Copy className="h-4 w-4" /></IconButton> : '—',
  };
  const tableColumns = columns.map((key) => ({ key, label: t(COLUMN_LABELS[key]), className: 'min-w-0',
    cellClassName: 'min-w-0 overflow-hidden',
    width: widths[key],
    sortable: ['reference', 'date_signalement', 'statut', 'domaine', 'type', 'daira', 'epic', 'priorite'].includes(key), render: renderers[key] }));
  return <><div className="hidden md:block"><DataTable columns={tableColumns} rows={rows} selected={selected} onSelect={writable ? onSelect : undefined}
    sort={sort} dir={dir} onSort={onSort} onRowClick={onPreview} fixed={mode !== 'complet'} density={density}
    zebra={!compact} activeIndex={activeIndex} onRowFocus={onRowFocus}
    onResizeColumn={onResizeColumn ? resizeStart : undefined} /></div>
    <div className={`grid gap-3 md:hidden ${compact ? 'p-2' : 'p-3'}`}>{rows.map((row, index) => <article key={row.id} data-row-index={index}
      className={`rounded-lg border border-border bg-surface shadow-1 ${compact ? 'p-2' : 'p-4'} ${activeIndex === index ? 'ring-2 ring-brand-500' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><Button variant="ghost" onClick={() => onPreview(row)}><bdi className="font-black text-brand-700">{row.reference}</bdi></Button>
        <p className="text-xs text-muted">{formatDate(row.date_signalement)}</p></div>{writable && <Checkbox aria-label={row.reference} checked={selected.includes(row.id)} onChange={() => onSelect(selected.includes(row.id) ? selected.filter((id) => id !== row.id) : [...selected, row.id])} />}</div>
      <p className="mt-3 font-semibold"><bdi>{anomalyLabel(row, 'type', lang)}</bdi></p><p className="mt-1 flex items-center gap-1 text-sm text-muted"><MapPin className="h-4 w-4" /><bdi>{anomalyLabel(row, 'commune', lang)}</bdi></p>
      <div className="mt-3 grid gap-2">{writable ? stateSelect(row) : <StatusBadge value={row.statut} />}<PriorityBadge value={row.priorite} /></div>
      <p className="mt-2 text-xs text-muted"><bdi>{t('photo.avant')} {row.photos_avant_count || 0} · {t('photo.apres')} {row.photos_apres_count || 0}</bdi>{row.statut === 'traite' && !row.photos_apres_count && <span role="img" aria-label={t('photo.required')} className="text-danger"> ⚠</span>}</p>
    </article>)}</div></>;
}
export default memo(AnomalyTable);
