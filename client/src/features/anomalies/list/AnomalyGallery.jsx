import { Eye, MapPin } from 'lucide-react';
import { formatDate } from '@anm/shared';
import { Button, Checkbox, IconButton, PlatformBadge, PriorityBadge, StatusBadge } from '../../../components/ui/index.js';
import { anomalyLabel } from '../helpers.js';
import { useI18n } from '../../../i18n/index.jsx';

function Vignette({ id, role, t }) {
  if (!id) return <span className="grid h-14 w-full place-items-center rounded-sm bg-surface2 text-xs text-muted">—</span>;
  return <img src={`/api/photos/${id}/thumb`} width="112" height="84"
    alt={t(`photo.${role}`)} className="h-14 w-full rounded-sm object-cover" loading="lazy" />;
}

export default function AnomalyGallery({ rows, selected, onSelect, onPreview, writable, activeIndex = -1, onRowFocus }) {
  const { t, lang } = useI18n();
  return <div data-list-gallery className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
    {rows.map((row, index) => <article key={row.id} data-gallery-item={row.id} tabIndex={0}
      onFocus={() => onRowFocus?.(row, index)}
      className={`min-w-0 rounded-lg border border-border bg-surface p-3 shadow-1 ${activeIndex === index ? 'ring-2 ring-brand-500' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <Button variant="ghost" onClick={() => onPreview(row)} className="min-w-0 px-0">
          <bdi className="truncate font-black text-brand-700">{row.reference}</bdi>
        </Button>
        {writable && <Checkbox aria-label={row.reference} checked={selected.includes(row.id)}
          onChange={() => onSelect(selected.includes(row.id) ? selected.filter((id) => id !== row.id) : [...selected, row.id])} />}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1" data-gallery-photos>
        <Vignette id={row.photo_avant_id} role="avant" t={t} />
        <Vignette id={row.photo_apres_id} role="apres" t={t} />
      </div>
      <p className="mt-3 truncate text-sm font-bold"><bdi>{anomalyLabel(row, 'type', lang)}</bdi></p>
      <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted"><MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /><bdi>{anomalyLabel(row, 'commune', lang)}</bdi></p>
      <p className="mt-1 text-xs text-muted">{formatDate(row.date_signalement)}</p>
      <div className="mt-3 flex flex-wrap items-center gap-1"><StatusBadge value={row.statut} /><PriorityBadge value={row.priorite} /><PlatformBadge value={row.plateforme} /></div>
      <div className="mt-2 flex justify-end"><IconButton aria-label={t('anomalies.preview')} onClick={() => onPreview(row)}><Eye className="h-4 w-4" /></IconButton></div>
    </article>)}
  </div>;
}
