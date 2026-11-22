import { useEffect, useState } from 'react';
import { ImagePlus, Upload } from 'lucide-react';
import { Input } from '../../../components/ui/index.js';
import { useI18n } from '../../../i18n/index.jsx';

export default function PhotoUploader({ onUpload, busy, progress, writable }) {
  const { t } = useI18n();
  const [role, setRole] = useState('avant');
  const [legende, setLegende] = useState('');
  const [previews, setPreviews] = useState([]);
  useEffect(() => () => previews.forEach((item) => URL.revokeObjectURL(item.url)), [previews]);
  const send = async (files, forcedRole) => {
    const list = Array.from(files || []).filter((file) => file.type.startsWith('image/'));
    if (!list.length) return;
    setPreviews(list.map((file) => ({ id: `${file.name}-${file.size}`, name: file.name, url: URL.createObjectURL(file) })));
    await onUpload(list, forcedRole || role, legende);
    setLegende('');
  };
  useEffect(() => {
    const onPaste = (event) => {
      const files = Array.from(event.clipboardData?.items || []).map((item) => item.getAsFile()).filter(Boolean);
      if (files.some((file) => file.type.startsWith('image/'))) { event.preventDefault(); send(files); }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  });
  if (!writable) return null;
  return <div className="space-y-3 rounded-md border border-dashed border-border bg-surface2 p-3"
    data-photo-dropzone onDragOver={(event) => event.preventDefault()}
    onDrop={(event) => { event.preventDefault(); send(event.dataTransfer.files); }}>
    <div className="flex flex-wrap items-end gap-2">
      <label className="min-w-0 flex-1">
        <span className="text-xs font-bold text-ink2">{t('photo.role')}</span>
        <select value={role} onChange={(event) => setRole(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink">
          <option value="avant">{t('photo.avant')}</option><option value="apres">{t('photo.apres')}</option><option value="autre">{t('photo.autre')}</option>
        </select>
      </label>
      <Input label={t('photo.caption')} value={legende} maxLength={200} onChange={(event) => setLegende(event.target.value)} className="min-w-0 flex-1" />
    </div>
    <div className="flex flex-wrap gap-2">
      {[['avant', 'photo.addAvant'], ['apres', 'photo.addApres']].map(([value, label]) => <label key={value} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md bg-brand-700 px-4 text-sm font-bold text-brand-50">
        <ImagePlus className="h-4 w-4" aria-hidden="true" />{t(label)}
        <input type="file" className="sr-only" accept="image/png,image/jpeg,image/webp,image/heic,image/heif,.heic,.heif" multiple data-photo-upload={value}
          onChange={(event) => send(event.target.files, value)} />
      </label>)}
      <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-border px-4 text-sm font-bold text-brand-text-700">
        <Upload className="h-4 w-4" aria-hidden="true" />{t('common.add')}
        <input type="file" className="sr-only" accept="image/*" capture="environment" data-photo-capture onChange={(event) => send(event.target.files)} />
      </label>
    </div>
    <p className="text-xs text-muted">{t('photo.dropHelp')}</p>
    {busy && <div role="progressbar" aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100" className="h-2 overflow-hidden rounded-sm bg-brand-100">
      <div className="h-full bg-brand-600 transition-[width]" style={{ width: `${progress}%` }} />
    </div>}
    {previews.length > 0 && <ul className="flex flex-wrap gap-2">{previews.map((item) => <li key={item.id} className="w-20 overflow-hidden rounded-sm border border-border">
      <img src={item.url} alt={item.name} className="h-16 w-full bg-surface2 object-cover" />
      <p className="truncate px-1 text-[10px] text-muted"><bdi>{item.name}</bdi></p>
    </li>)}</ul>}
    <span className="sr-only">{t('photo.dropHelp')}</span>
  </div>;
}
