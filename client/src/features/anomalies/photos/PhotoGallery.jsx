import { useMemo, useState } from 'react';
import { Download, FileText, MoreVertical, Trash2 } from 'lucide-react';
import { formatDateTime } from '@anm/shared';
import { Button, Checkbox, Dialog } from '../../../components/ui/index.js';
import { useI18n } from '../../../i18n/index.jsx';
import PhotoImage from './PhotoImage.jsx';

const roleLabel = (role, t) => t(role === 'avant' ? 'photo.avant' : role === 'apres' ? 'photo.apres' : 'photo.autre');

function Tile({ piece, t, writable, selected, onSelect, onOpen, onPatch, onDelete }) {
  return <li data-piece-id={piece.id} className="min-w-0 overflow-hidden rounded-md border border-border bg-surface"
    draggable={writable} onDragStart={(event) => event.dataTransfer.setData('text/piece-id', String(piece.id))}>
    <PhotoImage piece={piece} src={piece.thumb_url || piece.url} alt={piece.nom_original} className="h-28 w-full" imageClassName="h-full w-full object-cover" onOpen={onOpen} />
    <div className="space-y-1 p-2 text-xs">
      <div className="flex items-start justify-between gap-1">
        <p className="truncate font-bold"><bdi>{piece.legende || piece.nom_original}</bdi></p>
        {writable && <Checkbox aria-label={t('photo.selectForZip', { name: piece.nom_original })} checked={selected} onChange={() => onSelect(piece.id)} />}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <span className="rounded-sm bg-brand-100 px-2 py-0.5 font-bold text-brand-800">{roleLabel(piece.role, t)}</span>
        {piece.principale && <span className="font-bold text-ink2">{t('photo.principale')}</span>}
        <details className="relative ms-auto">
          <summary className="inline-flex min-h-8 cursor-pointer items-center gap-1 px-2 text-brand-text-700" aria-label={t('photo.actions')}><MoreVertical className="h-4 w-4" aria-hidden="true" /></summary>
          <div className="absolute end-0 top-full z-20 w-44 space-y-1 rounded-md border border-border bg-surface p-1 shadow-3">
            {writable && !piece.principale && <Button size="sm" variant="ghost" className="w-full justify-start" onClick={() => onPatch(piece.id, { principale: true })}>{t('photo.principale')}</Button>}
            {writable && piece.role !== 'avant' && <Button size="sm" variant="ghost" className="w-full justify-start" onClick={() => onPatch(piece.id, { role: 'avant' })}>{t('photo.avant')}</Button>}
            {writable && piece.role !== 'apres' && <Button size="sm" variant="ghost" className="w-full justify-start" onClick={() => onPatch(piece.id, { role: 'apres' })}>{t('photo.apres')}</Button>}
            <a href={piece.url} download={piece.nom_original} className="inline-flex min-h-8 w-full items-center gap-1 px-2 text-sm text-brand-text-700"><Download className="h-3 w-3" aria-hidden="true" />{t('photo.download')}</a>
            {writable && <Button size="sm" variant="ghost" className="w-full justify-start text-danger" onClick={() => onDelete(piece)}><Trash2 className="h-3 w-3" aria-hidden="true" />{t('common.delete')}</Button>}
          </div>
        </details>
      </div>
      {piece.auteur && <p className="truncate text-muted"><bdi>{piece.auteur}</bdi></p>}
    </div>
  </li>;
}

function Documents({ pieces, t, writable, onDelete }) {
  if (!pieces.length) return null;
  return <div className="min-w-0 space-y-2">
    <h4 className="text-sm font-bold text-ink">{t('photo.documents')}</h4>
    <ul className="divide-y divide-border rounded-md border border-border">{pieces.map((piece) => <li key={piece.id} className="flex flex-wrap items-center gap-2 p-3 text-xs">
      <FileText className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
      <a href={piece.url} className="min-w-0 flex-1 truncate font-bold text-brand-700"><bdi>{piece.nom_original}</bdi></a>
      <span className="text-muted">{piece.mime} · {Math.round(piece.taille / 1024)} Ko</span>
      <span className="text-muted">{formatDateTime(piece.created_at)}</span>
      {piece.auteur && <span className="text-muted"><bdi>{piece.auteur}</bdi></span>}
      {writable && <Button size="sm" variant="ghost" onClick={() => onDelete(piece)}>{t('common.delete')}</Button>}
    </li>)}</ul>
  </div>;
}

export default function PhotoGallery({ pieces, writable, library, onOpen }) {
  const { t } = useI18n();
  const [sort, setSort] = useState('date');
  const [selected, setSelected] = useState([]);
  const [target, setTarget] = useState(null);
  const images = useMemo(() => {
    const list = pieces.filter((piece) => piece.mime.startsWith('image/'));
    return [...list].sort((a, b) => sort === 'role' ? a.role.localeCompare(b.role)
      : sort === 'name' ? (a.nom_original || '').localeCompare(b.nom_original || '')
        : (b.prise_le || b.created_at || '').localeCompare(a.prise_le || a.created_at || ''));
  }, [pieces, sort]);
  const documents = pieces.filter((piece) => !piece.mime.startsWith('image/'));
  const toggle = (id) => setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const groups = ['avant', 'apres', 'autre'];
  return <div className="min-w-0 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <label className="flex items-center gap-2 text-xs font-bold text-ink2">{t('photo.sort')}
        <select value={sort} onChange={(event) => setSort(event.target.value)} className="min-h-9 rounded-sm border border-border bg-surface px-2 text-sm text-ink">
          <option value="date">{t('photo.sortDate')}</option><option value="role">{t('photo.sortRole')}</option><option value="name">{t('photo.sortName')}</option>
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => setSelected(selected.length === images.length ? [] : images.map((piece) => piece.id))}>{selected.length === images.length ? t('photo.unselectAll') : t('photo.selectAll')}</Button>
        <Button size="sm" variant="secondary" disabled={!selected.length || library.busy} onClick={() => library.downloadZip(selected)}>{t('photo.zip')}</Button>
      </div>
    </div>
    {groups.map((role) => {
      const list = images.filter((piece) => (piece.role || 'autre') === role);
      if (!list.length) return null;
      return <section key={role} className="min-w-0" data-photo-group={role}>
        <h4 className="mb-2 text-sm font-bold text-ink">{roleLabel(role, t)}</h4>
        <ul className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{list.map((piece) => <Tile key={piece.id} piece={piece} t={t} writable={writable}
          selected={selected.includes(piece.id)} onSelect={toggle} onOpen={onOpen}
          onPatch={(id, body) => library.patch(id, body)} onDelete={setTarget} />)}</ul>
      </section>;
    })}
    {!images.length && <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted">{t('photo.noPhotos')}</p>}
    <Documents pieces={documents} t={t} writable={writable} onDelete={setTarget} />
    <Dialog open={Boolean(target)} onClose={() => setTarget(null)} title={t('common.delete')}
      footer={<><Button variant="ghost" onClick={() => setTarget(null)}>{t('common.cancel')}</Button>
        <Button variant="danger" onClick={async () => { const piece = target; setTarget(null); await library.remove(piece.id); }}>{t('common.delete')}</Button></>}>
      <p className="text-sm text-ink2">{t('photo.deleteQuestion', { name: target?.nom_original || '' })}</p>
    </Dialog>
  </div>;
}
