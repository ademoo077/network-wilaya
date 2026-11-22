import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Pause, Play, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';
import { Button, Dialog, Textarea, useToast } from '../../../components/ui/index.js';
import { useI18n } from '../../../i18n/index.jsx';

const ROLE_ORDER = { avant: 0, apres: 1, autre: 2 };

export default function PhotoLightbox({ piece, pieces, library, onClose }) {
  const { t } = useI18n();
  const { push } = useToast();
  const list = useMemo(() => pieces.filter((item) => item.mime.startsWith('image/'))
    .sort((a, b) => (ROLE_ORDER[a.role] ?? 2) - (ROLE_ORDER[b.role] ?? 2) || a.id - b.id), [pieces]);
  const [index, setIndex] = useState(() => Math.max(0, list.findIndex((item) => item.id === piece?.id)));
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [caption, setCaption] = useState(piece?.legende || '');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const found = Math.max(0, list.findIndex((item) => item.id === piece?.id));
    setIndex(found); setZoom(1); setRotation(0); setCaption(piece?.legende || ''); setFailed(false);
  }, [piece?.id, piece?.legende, list]);
  useEffect(() => {
    if (!playing || list.length < 2) return undefined;
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % list.length), 2500);
    return () => window.clearInterval(timer);
  }, [playing, list.length]);
  useEffect(() => {
    const handler = (event) => {
      if (event.key === 'ArrowLeft') setIndex((value) => (value - 1 + list.length) % list.length);
      if (event.key === 'ArrowRight') setIndex((value) => (value + 1) % list.length);
      if (event.key === '+' || event.key === '=') setZoom((value) => Math.min(3, value + 0.25));
      if (event.key === '-') setZoom((value) => Math.max(0.5, value - 0.25));
    };
    if (piece) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [piece, list.length]);
  if (!piece || !list.length) return null;
  const current = list[index] || list[0];
  const move = (delta) => { setFailed(false); setIndex((value) => (value + delta + list.length) % list.length); };
  const saveCaption = async () => {
    if (caption === (current.legende || '')) return;
    const result = await library.patch(current.id, { legende: caption });
    if (result) push(t('common.success'));
  };
  return <Dialog open onClose={onClose} size="xl" title={current.nom_original}
    footer={<><Button variant="ghost" onClick={onClose}>{t('common.close')}</Button>
      <a href={current.url} download={current.nom_original} className="inline-flex min-h-11 items-center gap-2 rounded-md px-4 text-sm font-bold text-brand-text-700"><Download className="h-4 w-4" aria-hidden="true" />{t('photo.download')}</a></>}>
    <div className="space-y-3">
      <div className="grid min-h-[45vh] place-items-center overflow-hidden rounded-md bg-surface2" data-photo-lightbox>
        {failed ? <Button variant="secondary" onClick={() => setFailed(false)}>{t('photo.retry')}</Button>
          : <img src={current.url} alt={current.legende || current.nom_original}
            className="max-h-[60vh] max-w-full object-contain transition-transform"
            style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
            onError={() => setFailed(true)} />}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" aria-label={t('photo.previous')} onClick={() => move(-1)}><ChevronLeft className="h-4 w-4" aria-hidden="true" />{t('photo.previous')}</Button>
          <Button size="sm" variant="secondary" aria-label={t('photo.next')} onClick={() => move(1)}>{t('photo.next')}<ChevronRight className="h-4 w-4" aria-hidden="true" /></Button>
          <Button size="sm" variant="ghost" aria-label={t('photo.zoomIn')} onClick={() => setZoom((value) => Math.min(3, value + 0.25))}><ZoomIn className="h-4 w-4" aria-hidden="true" /></Button>
          <Button size="sm" variant="ghost" aria-label={t('photo.zoomOut')} onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))}><ZoomOut className="h-4 w-4" aria-hidden="true" /></Button>
          <Button size="sm" variant="ghost" aria-label={t('photo.rotate')} onClick={() => setRotation((value) => (value + 90) % 360)}><RotateCw className="h-4 w-4" aria-hidden="true" /></Button>
          <Button size="sm" variant="ghost" aria-label={t('photo.slideshow')} onClick={() => setPlaying((value) => !value)}>
            {playing ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}{t('photo.slideshow')}
          </Button>
        </div>
        <p className="text-xs font-bold text-muted" data-photo-counter>{index + 1} / {list.length}</p>
      </div>
      <Textarea label={t('photo.caption')} value={caption} maxLength={200} onChange={(event) => setCaption(event.target.value)} onBlur={saveCaption} />
    </div>
  </Dialog>;
}
