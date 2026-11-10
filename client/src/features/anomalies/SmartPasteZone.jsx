import { useEffect, useRef } from 'react';
import { Check, ClipboardPaste, X } from 'lucide-react';
import { formatDate, formatGps } from '@anm/shared';
import { Alert, Button, Checkbox, IconButton } from '../../components/ui/index.js';
import { useI18n } from '../../i18n/index.jsx';
import FormFeedback from './FormFeedback.jsx';
import TypeSuggestions from './TypeSuggestions.jsx';

function Chip({ children, onClick, onRemove, removeLabel }) {
  return <span className="inline-flex max-w-full items-center rounded-md border border-border bg-surface text-sm">
    <button type="button" className="flex min-h-11 min-w-0 items-center gap-2 break-words px-3 text-start hover:bg-surface2" onClick={onClick}><Check className="h-4 w-4 shrink-0" aria-hidden="true" />{children}</button>
    <IconButton aria-label={removeLabel} onClick={onRemove}><X className="h-4 w-4" /></IconButton></span>;
}
export default function SmartPasteZone({ model }) {
  const { t } = useI18n(); const ref = useRef(null); const { state, paste, ui, set, handleFiles } = model; const { result } = state;
  const desktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;
  useEffect(() => { if (ref.current) { ref.current.style.height = 'auto'; ref.current.style.height = `${Math.min(360, ref.current.scrollHeight)}px`; } }, [state.paste]);
  const focus = (id) => { document.getElementById(id)?.focus(); document.getElementById(id)?.scrollIntoView({ block: 'center' }); };
  const files = () => document.getElementById('attachments')?.click();
  const remove = (kind, index, field) => {
    if (field && state.meta[field]?.origin === 'auto') set(field, field === 'gps' ? null : '');
    ui({ result: { ...result, [kind]: result[kind].filter((_v, i) => i !== index) } });
  };
  const readClipboard = async () => { try { paste.analyze(await navigator.clipboard.readText()); } catch { ref.current?.focus(); ui({ feedback: { ...state.feedback, pending: false, gps: 'smart.ctrlV' } }); } };
  const socialWithoutGps = result?.urls.some((url) => url.type === 'social') && !state.values.gps;
  return <section className="mb-6 min-w-0 rounded-lg border border-dashed border-brand-600 bg-surface2 p-4 shadow-1"
    onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (event.dataTransfer.files.length) handleFiles([...event.dataTransfer.files]); else paste.analyze(event.dataTransfer.getData('text/plain')); }}>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="flex min-w-0 flex-1 items-start gap-3"><ClipboardPaste className="mt-0.5 h-6 w-6 shrink-0 text-brand-700" aria-hidden="true" />
        <div className="min-w-0"><h2 className="font-black">{t('smart.title')}</h2><p className="mt-1 text-sm text-ink2">{t('smart.placeholder')}</p></div></div>
      {window.isSecureContext && <Button variant="secondary" className="w-full sm:w-auto sm:shrink-0" onClick={readClipboard}><ClipboardPaste className="h-4 w-4" aria-hidden="true" />{t('smart.paste')}</Button>}</div>
    <textarea ref={ref} id="smart-paste" autoFocus={desktop} aria-label={t('smart.title')} placeholder={t(window.isSecureContext ? 'smart.placeholder' : 'smart.ctrlV')}
      className="mt-4 min-h-24 w-full resize-y rounded-md border border-border bg-surface p-3 text-sm text-ink placeholder:text-muted" value={state.paste}
      onChange={(event) => paste.input(event.target.value, 'smart-paste')} />
    {!window.isSecureContext && <p className="text-sm text-muted">{t('smart.ctrlV')}</p>}
    <div className="mt-2 flex flex-wrap gap-2"><Button variant="ghost" onClick={paste.clear} disabled={!state.paste}>{t('common.clear')}</Button><Button variant="secondary" onClick={files}>{t('smart.joinPhoto')}</Button></div>
    {result && <div className="mt-4" aria-live="polite"><h3 className="mb-2 text-sm font-bold">{t('smart.understood')}</h3>
      <div className="flex flex-wrap gap-2">
        {result.urls.map((url, index) => <Chip key={`${url.normalise}-${index}`} onClick={() => focus(url.type === 'carte' ? 'gps_text' : 'lien_url')} onRemove={() => remove('urls', index, 'lien_url')} removeLabel={t('paste.removeLink')}>
          {t('smart.link')} · {url.plateforme ? t(`platform.${url.plateforme}`) : t(url.type === 'carte' ? 'field.gps' : 'platform.autre')} {url.contenuType && `· ${t(`content.${url.contenuType}`)}`}</Chip>)}
        {result.coords.map((point, index) => <Chip key={`${point.lat}-${point.lng}`} onClick={() => paste.selectPoint(point)} onRemove={() => remove('coords', index, 'gps')} removeLabel={t('paste.removePosition')}>
          <span data-position-choice>{t('smart.position', { coords: formatGps(point.lat, point.lng) })}</span></Chip>)}
        {result.dates.map((date, index) => <Chip key={`${date.date}-${index}`} onClick={() => focus('date_publication')} onRemove={() => remove('dates', index, 'date_publication')} removeLabel={t('paste.removeDate')}>
          {t(date.estimee ? 'date.estimee' : 'paste.date', { date: formatDate(date.date) })}</Chip>)}
        {state.files.map((file) => <Chip key={file.name} onClick={files} onRemove={() => ui({ files: state.files.filter((f) => f !== file) })} removeLabel={t('paste.removePhoto')}>{file.name}</Chip>)}
      </div>
      {result.coords.length > 1 && <Alert variant="warning" className="mt-3">{t('smart.choosePosition')}</Alert>}
      {result.texteRestant.length >= 10 && <Checkbox className="mt-2" label={t('smart.addObservations')} checked={state.includeText} onChange={(event) => {
        const checked = event.target.checked; ui({ includeText: checked });
        if (checked) model.autofill([{ champ: 'observations', valeur: result.texteRestant }]);
        else if (state.meta.observations?.origin === 'auto') set('observations', state.undo.find((entry) => entry.id === state.group)?.champsModifies.observations || '');
      }} />}
      <TypeSuggestions model={model} />
      <FormFeedback model={model} />
      {socialWithoutGps && <div className="mt-3 flex flex-wrap gap-2"><Button variant="secondary" onClick={() => focus('gps_text')}>{t('smart.placeMap')}</Button>
        <Button variant="secondary" disabled={!window.isSecureContext} title={!window.isSecureContext ? t('gps.requiresHttps') : undefined} onClick={model.locateDevice}>{t('form.locationButton')}</Button><Button variant="secondary" onClick={files}>{t('smart.joinPhoto')}</Button></div>}
    </div>}
  </section>;
}
