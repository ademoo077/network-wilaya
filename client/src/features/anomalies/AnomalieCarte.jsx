import { useState, useEffect } from 'react';
import { Eye, MapPin } from 'lucide-react';
import { addDays, formatDate, todayAlgiers } from '@anm/shared';
import { Checkbox, IconButton, PlatformBadge, PriorityBadge, StatusBadge } from '../../components/ui/index.js';
import { anomalyLabel } from './helpers.js';
import { useI18n } from '../../i18n/index.jsx';

export default function AnomalieCarte({
  row, selected = [], onSelect, onPreview, writable = false,
  active = false, index = -1, onRowFocus, lang = 'fr',
}) {
  const { t } = useI18n();
  const [hover, setHover] = useState(false);
  const [showApres, setShowApres] = useState(false);
  const {
    id, reference, statut, priorite, plateforme, date_signalement,
    commune_fr, commune_ar, daira_fr, daira_ar,
    agent_nom, photos,
  } = row;

  const avant = photos?.avant || null;
  const apres = photos?.apres || null;
  const mainSrc = avant?.url || apres?.url || null;
  const nPlus = Math.max(0, (photos?.n || 0) - (avant ? 1 : 0) - (apres ? 1 : 0));
  const commune = commune_fr || commune_ar || '—';
  const daira = daira_fr || daira_ar || '—';
  const desc = row.description?.trim();
  const today = todayAlgiers();
  const displayDate = (statut === 'traite' && row.date_traitement) ? row.date_traitement : date_signalement;
  const dayLabel = displayDate === today ? t('anomalies.fil.aujourdHui') : displayDate === addDays(today, -1) ? t('common.yesterday') : formatDate(displayDate);
  const treatedAt = row.date_traitement ? formatDate(row.date_traitement) : null;
  const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (!hover || !apres || reduceMotion) { setShowApres(false); return; }
    setShowApres(true);
    const timer = setInterval(() => setShowApres((v) => !v), 1200);
    return () => clearInterval(timer);
  }, [hover, apres, reduceMotion]);

  const checked = selected.includes(id);
  const toggle = () => onSelect(checked ? selected.filter((i) => i !== id) : [...selected, id]);
  const overlay = 'absolute z-20 inline-flex min-h-6 items-center rounded-md bg-ink/70 px-2 py-0.5 text-[11px] font-bold text-surface';

  const accent = statut === 'traite' ? 'border-s-straite' : statut === 'en_cours' ? 'border-s-stcours' : 'border-s-stnon';

  return <article data-anomalie-card={id} data-card-active={active ? 'true' : 'false'}
    tabIndex={0} role="listitem"
    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onPreview?.(row); } }}
    onFocus={() => onRowFocus?.(row, index)}
    onMouseEnter={() => setHover(true)} onMouseLeave={() => { setHover(false); setShowApres(false); }}
    className={`group flex min-w-0 flex-col overflow-hidden rounded-xl border border-border ${accent} border-s-4 bg-surface shadow-sm focus-within:ring-2 focus-within:ring-brand-500 focus-within:outline-none`}>
    <div className="relative aspect-video overflow-hidden bg-surface2">
      {mainSrc ? (
        <>
          <img src={avant?.url || apres?.url} width="800" height="450" alt={t('anomalies.photoAvant', { defaultValue: 'Photo avant' })}
            className={`h-full w-full object-cover transition-opacity duration-500 ${showApres && apres ? 'opacity-0' : 'opacity-100'}`} loading="lazy" />
          {apres && <img src={apres.url} width="800" height="450" alt={t('anomalies.photoApres', { defaultValue: 'Photo après' })}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${showApres ? 'opacity-100' : 'opacity-0'}`} loading="lazy" />}
        </>
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-surface2">
          <MapPin className="h-10 w-10 text-muted" aria-hidden="true" />
        </div>
      )}
      <span className={`${overlay} bottom-2 right-2`}><StatusBadge value={statut} /></span>
      {priorite === 'urgente' && <span className={`${overlay} left-2 top-2`}>{t('priority.urgente')}</span>}
      {nPlus > 0 && <span className={`${overlay} right-2 top-2`}>+{nPlus}</span>}
      {apres && avant && <span className="absolute bottom-2 left-2 z-20 overflow-hidden rounded-md border border-surface bg-surface">
        <img src={apres.url} alt="" className="h-10 w-14 object-cover" loading="lazy" width="56" height="40" />
        <span className="absolute inset-x-0 bottom-0 bg-ink/70 text-center text-[10px] font-bold text-surface">{t('anomalies.apres', { defaultValue: 'Après' })}</span>
      </span>}
      {writable && <span className="absolute left-2 top-2 z-30" style={{ display: priorite === 'urgente' ? 'none' : undefined }}>
        <Checkbox aria-label={t('common.select')} checked={checked} onChange={toggle} onClick={(e) => e.stopPropagation()} />
      </span>}
      {writable && priorite === 'urgente' && <span className="absolute left-2 top-10 z-30">
        <Checkbox aria-label={t('common.select')} checked={checked} onChange={toggle} onClick={(e) => e.stopPropagation()} />
      </span>}
    </div>

    <div className="flex flex-1 flex-col p-4">
      <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted">
        <span className="truncate font-medium"><bdi>{commune}</bdi> <span className="text-border">•</span> <bdi>{daira}</bdi></span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 font-semibold ${displayDate === today ? 'bg-brand-100 text-brand-800' : 'bg-surface2 text-ink2'}`}>{dayLabel}</span>
      </div>
      <h3 className="line-clamp-2 text-[15px] font-bold leading-snug text-ink" dir="auto" title={anomalyLabel(row, 'type', lang)}>
        <button type="button" onClick={() => onPreview?.(row)} className="text-start hover:text-brand-700 hover:underline"><bdi>{anomalyLabel(row, 'type', lang)}</bdi></button>
      </h3>
      {desc && <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink2" dir="auto">{desc}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
        <span className="font-semibold text-brand-700"><bdi>{reference}</bdi></span>
        <span aria-hidden="true">·</span>
        <span>{t('field.signalementDate', { defaultValue: 'Signalé' })} {formatDate(date_signalement)}</span>
        {treatedAt && <><span aria-hidden="true">·</span><span className="font-semibold text-straite">{t('status.traite')} {treatedAt}</span></>}</div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {priorite !== 'normale' && <PriorityBadge value={priorite} />}
        <PlatformBadge value={plateforme} />
        {row.epic_nom && <span className="rounded-full bg-surface2 px-2 py-0.5 text-[11px] font-semibold text-ink2"><bdi>{row.epic_nom}</bdi></span>}
        {row.source_nom && <span className="rounded-full bg-surface2 px-2 py-0.5 text-[11px] font-semibold text-ink2"><bdi>{row.source_nom}</bdi></span>}
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 pt-4 border-t border-border">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-ink2">{agent_nom ? <bdi>{agent_nom}</bdi> : t('list.nonAffectees')}</p>
          <p className="text-[11px] text-muted">{statut === 'traite' ? t('detail.treatedLocked') : t(`status.${statut}`)}</p>
        </div>
        <IconButton size="sm" aria-label={t('anomalies.preview')} onClick={() => onPreview?.(row)}><Eye className="h-4 w-4" /></IconButton>
      </div>
    </div>
  </article>;
}
