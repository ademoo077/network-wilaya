import { useMemo, useState } from 'react';
import { Download, ImagePlus } from 'lucide-react';
import { formatDate } from '@anm/shared';
import { api } from '../../api/client.js';
import { Button, Card, CardHeader, Dialog, useToast } from '../../components/ui/index.js';
import { useI18n } from '../../i18n/index.jsx';

const principalOf = (list) => list.find((piece) => piece.principale) || list[0] || null;

function PhotoTile({ piece, t, onMarkAfter, onPrincipal, onFullscreen, writable }) {
  const src = piece.thumb_url || piece.url;
  return <li data-piece-id={piece.id} className="min-w-0 overflow-hidden rounded-md border border-border bg-surface">
    <button type="button" className="block w-full" onClick={() => onFullscreen(piece)} aria-label={t('photo.fullscreen')}>
      <img src={src} alt={piece.legende || piece.nom_original} className="h-36 w-full bg-surface2 object-contain" loading="lazy" />
    </button>
    <div className="space-y-1 p-2 text-xs">
      <p className="truncate font-bold"><bdi>{piece.legende || piece.nom_original}</bdi></p>
      {piece.prise_le && <p className="text-muted"><bdi>{t('photo.takenOn', { date: formatDate(piece.prise_le) })}</bdi></p>}
      <div className="flex flex-wrap items-center gap-1">
        {piece.principale && <span className="rounded-sm bg-brand-100 px-2 py-0.5 font-bold text-brand-800">{t('photo.principale')}</span>}
        <a href={piece.url} download={piece.nom_original} className="inline-flex min-h-8 items-center gap-1 rounded-sm px-2 text-brand-text-700 hover:bg-brand-50">
          <Download className="h-3 w-3" aria-hidden="true" />{t('photo.download')}
        </a>
        {writable && piece.role === 'avant' && <Button size="sm" variant="ghost" onClick={() => onMarkAfter(piece)}>{t('photo.markApres')}</Button>}
        {writable && !piece.principale && <Button size="sm" variant="ghost" onClick={() => onPrincipal(piece)}>{t('photo.principale')}</Button>}
      </div>
    </div>
  </li>;
}

function Group({ role, pieces, t, emptyLabel, ...actions }) {
  return <div className="min-w-0">
    <h4 className="mb-2 text-sm font-bold text-ink">{t(role === 'avant' ? 'photo.avant' : 'photo.apres')}</h4>
    {pieces.length === 0 ? <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted">{t(emptyLabel)}</p>
      : <ul data-photo-group={role} className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-3">{pieces.map((piece) => <PhotoTile key={piece.id} piece={piece} t={t} {...actions} />)}</ul>}
  </div>;
}

export default function PhotoComparison({ anomalieId, pieces, sansPhotoMotif, writable, onReload }) {
  const { t } = useI18n(); const { push } = useToast();
  const [position, setPosition] = useState(50);
  const [fullscreen, setFullscreen] = useState(null);
  const [busy, setBusy] = useState(false);
  const avant = useMemo(() => pieces.filter((piece) => piece.role === 'avant'), [pieces]);
  const apres = useMemo(() => pieces.filter((piece) => piece.role === 'apres'), [pieces]);
  const before = principalOf(avant);
  const after = principalOf(apres);
  const patch = async (id, body) => {
    setBusy(true);
    try { await api(`/pieces/${id}`, { method: 'PATCH', body }); await onReload(); }
    catch (error) { push(error.message, 'danger'); }
    finally { setBusy(false); }
  };
  const upload = (role) => async (event) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    const body = new FormData(); body.append('file', file); body.append('role', role); body.append('principale', '1');
    setBusy(true);
    try { await api(`/anomalies/${anomalieId}/pieces`, { method: 'POST', body }); await onReload(); }
    catch (error) { push(error.message, 'danger'); }
    finally { setBusy(false); }
  };
  const actions = {
    writable,
    onMarkAfter: (piece) => patch(piece.id, { role: 'apres' }),
    onPrincipal: (piece) => patch(piece.id, { principale: true }),
    onFullscreen: setFullscreen,
  };
  return <Card className="min-w-0" data-photo-comparison="true">
    <CardHeader title={t('photo.compare')} action={writable && <div className="flex flex-wrap gap-2">
      {[['avant', 'photo.addAvant'], ['apres', 'photo.addApres']].map(([role, label]) => <label key={role} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md bg-brand-700 px-4 text-sm font-bold text-brand-50">
        <ImagePlus className="h-4 w-4" aria-hidden="true" />{t(label)}
        <input type="file" className="sr-only" accept="image/png,image/jpeg,image/webp" data-photo-upload={role} onChange={upload(role)} />
      </label>)}
    </div>} />
    <div className="min-w-0 space-y-4 p-5">
      {(before || after) && <div className="min-w-0 overflow-hidden rounded-md border border-border" data-photo-comparator="true">
        <div className="relative h-64 bg-surface2">
          {before && <img src={before.url} alt={t('photo.avant')} className="absolute inset-0 h-full w-full object-contain" />}
          {after && <img src={after.url} alt={t('photo.apres')} className="absolute inset-0 h-full w-full object-contain" style={{ clipPath: `inset(0 0 0 ${position}%)` }} />}
        </div>
        {before && after && <label className="flex items-center gap-3 border-t border-border px-3 py-2 text-xs font-bold text-ink2">
          {t('photo.avant')}
          <input type="range" min="0" max="100" value={position} onChange={(event) => setPosition(Number(event.target.value))}
            aria-label={t('photo.compare')} className="min-w-0 flex-1" data-photo-slider="true" />
          {t('photo.apres')}
        </label>}
      </div>}
      {sansPhotoMotif && <p data-sans-photo-motif className="rounded-md border border-border bg-surface2 p-3 text-sm text-ink2">
        <bdi><strong>{t('photo.withoutReason')} : </strong>{sansPhotoMotif}</bdi>
      </p>}
      <div className="grid min-w-0 gap-5 lg:grid-cols-2">
        <Group role="avant" pieces={avant} t={t} emptyLabel="photo.noBefore" {...actions} />
        <Group role="apres" pieces={apres} t={t} emptyLabel="photo.noAfter" {...actions} />
      </div>
      {busy && <p className="text-sm text-muted" aria-live="polite">…</p>}
    </div>
    <Dialog open={Boolean(fullscreen)} onClose={() => setFullscreen(null)} title={fullscreen?.legende || fullscreen?.nom_original || ''}>
      {fullscreen && <img src={fullscreen.url} alt={fullscreen.legende || fullscreen.nom_original} className="max-h-[70vh] w-full bg-surface2 object-contain" />}
    </Dialog>
  </Card>;
}
