import { useState, useEffect, useRef } from 'react';
import { Eye, MapPin, Share2, Upload } from 'lucide-react';
import { formatDate } from '@anm/shared';
import { Button, Checkbox, IconButton, PlatformBadge, PriorityBadge, StatusBadge } from '../../components/ui/index.js';
import { anomalyLabel } from './helpers.js';
import { useI18n } from '../../i18n/index.jsx';

export default function AnomalieCarte({
  row, selected = [], onSelect, onPreview, writable = false,
  active = false, index = -1, onRowFocus, lang = 'fr',
}) {
  const { t } = useI18n();
  const [hover, setHover] = useState(false);
  const timerRef = useRef(null);
  const {
    id, reference, statut, priorite, plateforme, date_signalement,
    // _commune_id, _daira_id, _type_id, _type_fr, _type_ar,
    // _commune_fr, _commune_ar, _daira_fr, _daira_ar,
    // _agent_nom, _pieces_count, photos, _statut_libelle,
  } = row;

  const avant = photos?.avant || null;
  const apres = photos?.apres || null;
  const sourceUrl = avant?.url || (apres?.url);
  const nPlus = Math.max(0, (photos?.n || 0) - (avant ? 1 : 0) - (apres ? 1 : 0));
  const showAvant = useRef(true);

  useEffect(() => {
    if (!hover || !apres || typeof matchMedia !== 'function' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    timerRef.current = setInterval(() => { showAvant.current = !showAvant.current; }, 1200);
    return () => clearInterval(timerRef.current);
  }, [hover, apres]);

  return <article data-anomalie-card={id} data-card-active={active ? 'true' : 'false'}
    tabIndex={0} role="listitem"
    onFocus={() => onRowFocus?.(row, index)}
    onMouseEnter={() => setHover(true)}
    onMouseLeave={() => setHover(false)}
    className="min-w-0 flex flex-col rounded-xl border border-border bg-surface shadow-sm group focus-within:ring-2 ring-brand-500 focus-within:outline-none p-3 sm:p-4 lg:p-6">
    {/* En-tête carte */}
    <div className="flex items-start justify-between gap-2 mb-1">
      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onPreview?.(row); }}
        className="min-w-0 p-0 text-xs font-bold text-brand-700 truncate">
        <bdi>{reference}</bdi>
      </Button>
      {writable && <Checkbox aria-label={t('common.select')} checked={selected.includes(id)}
        onChange={() => onSelect(selected.includes(id) ? selected.filter((i) => i !== id) : [...selected, id])} />}
    </div>
    {/* Miniature YouTube 16:9 */}
    <div className="relative aspect-video overflow-hidden rounded-lg bg-surface2 mb-2">
      {sourceUrl ? <img src={sourceUrl} width="800" height="450" alt={t('anomalies.photoAvant')}
        className={`w-full h-full object-cover ${hover && apres ? 'group-hover/opacity-0 transition-opacity duration-1000' : ''}`} loading="lazy"
        style={{ display: hover && apres ? 'none' : 'block' }} /> : <div className="w-full h-full flex items-center justify-center rounded-lg bg-gradient-to-b from-surface2 to-surface3">
        <MapPin className="h-8 w-8 text-muted" aria-hidden="true" />
      </div>}
      {avant?.flou && <div className="absolute inset-0 w-full h-full z-10" style={{ filter: `blur(40px) brightness(0.9)`, backgroundImage: `url('${avant.flou}')`, backgroundSize: 'cover', opacity: hover && apres ? 0 : 1 }} />}
      {apres && <img src={apres.url} width="800" height="450" alt={t('anomalies.photoApres')}
        className={`w-full h-full object-cover absolute inset-0 ${hover ? 'opacity-100 z-20' : 'opacity-0 z-10'} transition-opacity duration-1000`} loading="lazy" />}
      {/* Surcouches */}
      <span className="absolute top-2 left-2 z-20 inline-flex min-h-6 items-center rounded-md border border-white bg-black/60 px-2 py-0.5 text-xs font-bold text-white">
        {priorite === 'urgente' ? t('anomalies.urgente') : t('common.statut', { statut: statut_libelle || t(`status.${statut}`) })}
      </span>
      {(nPlus > 0 || (avant && apres)) && <span className="absolute bottom-2 right-2 z-20 inline-flex min-h-6 items-center rounded-md border border-white bg-black/60 px-2 py-0.5 text-xs font-bold text-white">
        {nPlus > 0 ? `+${nPlus}` : t('anomalies.apres')}
      </span>}
      {apres && <span className="absolute bottom-2 left-2 z-20 inline-flex min-h-6 items-center rounded-md border border-white bg-black/60 px-2 py-0.5 text-xs text-white">
        {t('anomalies.apres')}
      </span>}
    </div>
    {/* Métadonnées */}
    <div className="flex items-center gap-1 text-xs text-muted mb-1">
      <span className="font-medium">{agent_nom ? <bdi>{agent_nom}</bdi> : <span className="bg-surface2 rounded px-1">—</span>}</span>
      <span className="text-muted">·</span>
      <bdi>{commune_fr || commune_ar}</bdi> <span className="text-muted">·</span> <bdi>{daira_fr || daira_ar}</bdi>
    </div>
    <h3 className="line-clamp-2 text-sm font-bold leading-snug" dir="auto" title={anomalyLabel(row, 'type', lang)}>
      <bdi>{anomalyLabel(row, 'type', lang)}</bdi>
    </h3>
    <p className="mt-1 text-xs text-muted">{formatDate(date_signalement)}</p>
    <div className="mt-2 flex flex-wrap items-center gap-1">
      <StatusBadge value={statut} /><PriorityBadge value={priorite} /><PlatformBadge value={plateforme} />
    </div>
    <div className="mt-auto pt-3 flex items-center justify-between gap-2">
      <div className="flex items-center gap-1 text-xs text-muted">
        {row.source_nom && <span><bdi>{row.source_nom}</bdi> <span className="text-muted">·</span> {row.source_plateforme}</span>}
      </div>
      <div className="flex items-center gap-1">
        <IconButton size="sm" aria-label={t('anomalies.preview')} onClick={() => onPreview?.(row)}><Eye className="h-3.5 w-3.5" /></IconButton>
        {writable && <IconButton size="sm" aria-label={t('anomalies.addPhoto')} onClick={(e) => { e.stopPropagation(); }}><Upload className="h-3.5 w-3.5" /></IconButton>}
        <IconButton size="sm" aria-label={t('common.more')} onClick={(e) => { e.stopPropagation(); }}><Share2 className="h-3.5 w-3.5" /></IconButton>
      </div>
    </div>
  </article>;
}
