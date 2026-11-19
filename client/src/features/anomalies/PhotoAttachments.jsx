import { useEffect, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { Alert, IconButton } from '../../components/ui/index.js';
import { useI18n } from '../../i18n/index.jsx';

function Photo({ file, onRemove }) {
  const { t } = useI18n(); const [url, setUrl] = useState(null);
  useEffect(() => { const value = URL.createObjectURL(file); setUrl(value); return () => URL.revokeObjectURL(value); }, [file]);
  return <li className="min-w-0 overflow-hidden rounded-md border border-border bg-surface">
    {url && <img src={url} alt={t('attachments.preview', { name: file.name })} className="h-32 w-full bg-surface2 object-contain" />}
    <div className="flex items-start gap-1 p-2"><span className="min-w-0 flex-1 text-xs"><bdi className="block break-all font-semibold">{file.name}</bdi><span className="text-muted">{Math.max(1, Math.round(file.size / 1024))} {t('attachments.kb')}</span></span>
      <IconButton aria-label={t('attachments.remove', { name: file.name })} onClick={onRemove}><X className="h-4 w-4" /></IconButton></div>
  </li>;
}
export default function PhotoAttachments({ model }) {
  const { t } = useI18n(); const { state, ui, handleFiles } = model;
  return <div data-photo-role="avant" className="min-w-0 space-y-3 sm:col-span-2">
    <div>
      <p className="text-sm font-bold text-ink">{t('photo.avant')}</p>
      <p className="text-xs text-muted">{t('photo.helpAvant')}</p>
    </div>
    <label htmlFor="attachments" className="grid min-h-28 cursor-pointer place-items-center gap-2 rounded-md border border-dashed border-border bg-surface2 p-4 text-center text-sm text-ink2 transition hover:border-brand-600 focus-within:ring-2 focus-within:ring-brand-600"
      onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); handleFiles([...event.dataTransfer.files]); }}>
      <ImagePlus className="h-6 w-6 text-brand-700" aria-hidden="true" /><span>{t('form.dropFiles')}</span>
      <span className="text-xs text-muted">{t('attachments.help')}</span>
      <input id="attachments" className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(event) => { handleFiles([...event.target.files]); event.target.value = ''; }} />
    </label>
    <p className="text-xs text-muted" aria-live="polite">{t('attachments.count', { count: state.files.length + (state.piecesCount || 0) })}</p>
    {state.piecesCount > 0 && <p className="text-xs text-muted">{t('attachments.existing', { count: state.piecesCount })}</p>}
    {state.fileFeedback.length > 0 && <Alert variant="warning"><ul>{state.fileFeedback.map((item, index) => <li key={index}><bdi>{item.name}</bdi> — {t(item.code)}</li>)}</ul></Alert>}
    {state.files.length > 0 && <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{state.files.map((file) => <Photo key={`${file.name}-${file.size}-${file.lastModified}`} file={file} onRemove={() => ui({ files: state.files.filter((item) => item !== file) })} />)}</ul>}
    {state.tasks.exif.status !== 'idle' && <p data-feedback className="text-sm text-ink2" aria-live="polite">{t(state.tasks.exif.status === 'loading' ? 'exif.loading' : state.tasks.exif.data?.ok ? 'exif.ok' : 'exif.aucune')}</p>}
  </div>;
}
