import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { formatDate, formatGps } from '@anm/shared';
import { api } from '../../../api/client.js';
import { Button, Drawer, PriorityBadge, StatusBadge } from '../../../components/ui/index.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import { useI18n } from '../../../i18n/index.jsx';
import { anomalyLabel } from '../helpers.js';
import PhotoComparator from '../photos/PhotoComparator.jsx';
import { photoModeKey } from '../photos/usePhotoLibrary.js';

function Field({ label, value }) {
  return <div><dt className="text-xs font-bold text-muted">{label}</dt><dd className="mt-1 text-sm font-semibold text-ink">{value || '—'}</dd></div>;
}

export default function AnomalyQuickView({ item, items, mode, onMode, onNavigate, onClose }) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [pieces, setPieces] = useState([]);
  useEffect(() => {
    if (!item) return undefined;
    const handler = (event) => {
      if (event.target.closest('input, select, textarea, [contenteditable="true"]')) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') { event.preventDefault(); onNavigate(1); }
      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') { event.preventDefault(); onNavigate(-1); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [item, onNavigate]);
  useEffect(() => {
    if (!item) { setPieces([]); return undefined; }
    let actif = true;
    api(`/anomalies/${item.id}/pieces`).then((result) => {
      if (actif) setPieces(Array.isArray(result.items) ? result.items : []);
    }).catch(() => { if (actif) setPieces([]); });
    return () => { actif = false; };
  }, [item?.id]);
  if (!item) return null;
  const index = Math.max(0, items.findIndex((row) => row.id === item.id));
  const setMode = (value) => {
    onMode(value);
    try { localStorage.setItem(photoModeKey(user?.id), value); } catch { /* stockage indisponible */ }
  };
  const imageParId = (id, role) => id
    ? [{ id, url: `/api/photos/${id}/thumb`, legende: '', nom_original: t(`photo.${role}`) }] : [];
  const enImage = (piece) => ({ ...piece, url: piece.thumb_url || piece.url || `/api/photos/${piece.id}/thumb` });
  // Les photos importées avant le pipeline n'ont pas de rôle : elles sont tout de même
  // proposées dans le comparateur (sans écrire en base) pour ne jamais laisser l'aperçu vide.
  const candidats = pieces.filter((piece) => ['avant', 'apres', 'autre'].includes(piece.role)).map(enImage);
  const avant = imageParId(item.photo_avant_id, 'avant').length
    ? imageParId(item.photo_avant_id, 'avant') : candidats.slice(0, 1);
  const reste = candidats.filter((piece) => piece.id !== avant[0]?.id);
  const apres = imageParId(item.photo_apres_id, 'apres').length
    ? imageParId(item.photo_apres_id, 'apres') : reste.slice(0, 1);
  return <Drawer open onClose={onClose} title={t('anomalies.preview')} width="max-w-3xl">
    <div data-quick-view className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2"><StatusBadge value={item.statut} /><PriorityBadge value={item.priorite} /></div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="secondary" aria-label={t('photo.previous')} onClick={() => onNavigate(-1)}><ChevronUp className="h-4 w-4" aria-hidden="true" />{t('common.previous')}</Button>
          <Button size="sm" variant="secondary" aria-label={t('photo.next')} onClick={() => onNavigate(1)}><ChevronDown className="h-4 w-4" aria-hidden="true" />{t('common.next')}</Button>
          <Button size="sm" as={Link} to={`/anomalies/${item.id}`}>{t('anomalies.openSheet')}</Button>
        </div>
      </div>
      <div>
        <h2 className="text-2xl font-black text-brand-700"><bdi>{item.reference}</bdi></h2>
        <p className="text-sm text-muted">{formatDate(item.date_signalement)} · {index + 1} / {items.length}</p>
        <p className="sr-only" data-quick-view-counter>{index + 1} / {items.length}</p>
      </div>
      <PhotoComparator avant={avant} apres={apres} mode={mode} onMode={setMode} />
      <dl className="grid gap-4 sm:grid-cols-2">
        <Field label={t('field.category')} value={anomalyLabel(item, 'domaine', lang)} />
        <Field label={t('field.type')} value={anomalyLabel(item, 'type', lang)} />
        <Field label={t('field.daira')} value={anomalyLabel(item, 'daira', lang)} />
        <Field label={t('field.commune')} value={anomalyLabel(item, 'commune', lang)} />
        <Field label={t('field.agent')} value={item.agent_name} />
        <Field label={t('field.epic')} value={item.epic_name || item.intervenant_autre} />
        <Field label={t('field.gps')} value={item.gps ? formatGps(item.gps.lat, item.gps.lng) : null} />
        <Field label={t('field.address')} value={item.adresse_texte} />
      </dl>
    </div>
  </Drawer>;
}
