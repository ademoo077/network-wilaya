import { useState } from 'react';
import { formatDateTime, formatGps } from '@anm/shared';
import { useI18n } from '../../../i18n/index.jsx';
import PhotoImage from './PhotoImage.jsx';

function Meta({ piece, role, t }) {
  return <figcaption className="space-y-0.5 p-2 text-xs">
    <div className="flex flex-wrap items-center gap-2">
      <span className="rounded-sm bg-brand-100 px-2 py-0.5 font-bold text-brand-800">{t(role === 'avant' ? 'photo.avant' : 'photo.apres')}</span>
      {piece.principale && <span className="font-bold text-ink2">{t('photo.principale')}</span>}
    </div>
    {piece.prise_le && <p className="text-muted"><bdi>{t('photo.takenOn', { date: formatDateTime(piece.prise_le) })}</bdi></p>}
    {piece.legende && <p className="font-semibold"><bdi>{piece.legende}</bdi></p>}
    {piece.auteur && <p className="text-muted"><bdi>{piece.auteur}</bdi></p>}
    {(piece.gps_lat != null && piece.gps_lng != null) && <p className="text-muted"><bdi>{formatGps(piece.gps_lat, piece.gps_lng)}</bdi></p>}
  </figcaption>;
}

function DropZone({ role, t, children, onDropRole }) {
  const enabled = typeof onDropRole === 'function';
  return <div className="min-w-0" onDragOver={enabled ? (event) => event.preventDefault() : undefined}
    onDrop={enabled ? (event) => { event.preventDefault(); const raw = event.dataTransfer.getData('text/piece-id'); if (raw) onDropRole(Number(raw), role); } : undefined}>
    {children}
    {enabled && <p className="mt-1 text-center text-[11px] text-muted">{t('photo.dropRole')}</p>}
  </div>;
}

export default function PhotoComparator({ avant, apres, mode, onMode, onOpen, onDropRole }) {
  const { t } = useI18n();
  const [position, setPosition] = useState(50);
  const before = avant[0] || null;
  const after = apres[0] || null;
  const modes = [['side', 'photo.modeSide'], ['slider', 'photo.modeSlider'], ['fade', 'photo.modeFade']];
  if (!before && !after) return null;
  return <div data-photo-comparator className="min-w-0 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div role="group" aria-label={t('photo.viewMode')} className="flex flex-wrap gap-1">
        {modes.map(([value, label]) => <button key={value} type="button" data-photo-mode={value}
          aria-pressed={mode === value} onClick={() => onMode(value)}
          className={`min-h-9 rounded-sm border px-3 text-xs font-bold ${mode === value ? 'border-brand-600 bg-brand-100 text-brand-800' : 'border-border bg-surface text-ink2'}`}>
          {t(label)}
        </button>)}
      </div>
    </div>
    <div className={`grid min-w-0 gap-2 ${mode === 'side' ? 'sm:grid-cols-2' : 'grid-cols-1'}`}>
      <DropZone role="avant" t={t} onDropRole={onDropRole}>
        <figure className="m-0 min-w-0 overflow-hidden rounded-md border border-border">
          {before ? <PhotoImage piece={before} src={before.url} alt={t('photo.avant')} className="aspect-[4/3] w-full" imageClassName="h-full w-full object-contain" onOpen={onOpen} />
            : <div className="aspect-[4/3] bg-surface2" />}
          {before && <Meta piece={before} role="avant" t={t} />}
        </figure>
      </DropZone>
      <DropZone role="apres" t={t} onDropRole={onDropRole}>
        <figure className="m-0 min-w-0 overflow-hidden rounded-md border border-border">
          {mode === 'slider' && after ? <div className="relative aspect-[4/3] w-full">
            {before && <PhotoImage piece={before} src={before.url} alt={t('photo.avant')} className="absolute inset-0 h-full w-full" imageClassName="h-full w-full object-contain" />}
            <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${position}%)` }}>
              <PhotoImage piece={after} src={after.url} alt={t('photo.apres')} className="h-full w-full" imageClassName="h-full w-full object-contain" />
            </div>
          </div> : mode === 'fade' && after ? <div className="relative aspect-[4/3] w-full">
            {before && <PhotoImage piece={before} src={before.url} alt={t('photo.avant')} className="absolute inset-0 h-full w-full" imageClassName="h-full w-full object-contain" />}
            <div className="absolute inset-0" style={{ opacity: position / 100 }}>
              <PhotoImage piece={after} src={after.url} alt={t('photo.apres')} className="h-full w-full" imageClassName="h-full w-full object-contain" />
            </div>
          </div> : after ? <PhotoImage piece={after} src={after.url} alt={t('photo.apres')} className="aspect-[4/3] w-full" imageClassName="h-full w-full object-contain" onOpen={onOpen} />
            : <div className="aspect-[4/3] bg-surface2" />}
          {after && <Meta piece={after} role="apres" t={t} />}
        </figure>
      </DropZone>
    </div>
    {before && after && mode !== 'side' && <label className="flex items-center gap-3 border-t border-border px-2 py-2 text-xs font-bold text-ink2">
      {t('photo.avant')}
      <input type="range" min="0" max="100" value={position} data-photo-slider role="slider"
        aria-label={t('photo.compare')} aria-valuenow={position}
        onChange={(event) => setPosition(Number(event.target.value))} className="min-w-0 flex-1" />
      {t('photo.apres')}
    </label>}
  </div>;
}
