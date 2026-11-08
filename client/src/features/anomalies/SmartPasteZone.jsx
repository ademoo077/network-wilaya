import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Check, ClipboardPaste, Globe, ImagePlus, MapPinned, MousePointer2, X } from 'lucide-react';
import { formatDate, formatGps, haversineMeters, parseSmartPaste } from '@anm/shared';
import { api } from '../../api/client.js';
import { Alert, Button, Checkbox, IconButton, useToast } from '../../components/ui/index.js';
import { useI18n } from '../../i18n/index.jsx';

function Chip({ children, onRemove, action = null }) {
  return <span className="inline-flex min-h-9 items-center gap-1 rounded-full border border-border bg-surface px-3 text-xs font-bold text-ink">{children}{action}<IconButton className="ms-1 h-6 w-6" aria-label="×" onClick={onRemove}><X className="h-3 w-3" /></IconButton></span>;
}

const SmartPasteZone = forwardRef(function SmartPasteZone({ bbox, enrichissement = false, onApply, onFiles, onPlaceMap, onRemove }, ref) {
  const { t } = useI18n();
  const { push } = useToast();
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [includeText, setIncludeText] = useState(true);
  const [resolving, setResolving] = useState(null);
  const analyze = (value) => {
    const parsed = parseSmartPaste(value, { bbox });
    setText(value);
    setResult(parsed);
    const hasUsefulText = parsed.texteRestant.length >= 10;
    setIncludeText(hasUsefulText);
    const distinct = parsed.coords.length > 1 && parsed.coords.some((coord) => haversineMeters(parsed.coords[0], coord) > 100);
    if (!distinct) onApply?.(parsed, parsed.coords[0] || null, hasUsefulText);
    if (enrichissement) {
      parsed.urls.forEach((url, index) => {
        if (url.type === 'carte' && !url.coords) {
          resolveUrl(url, index, parsed);
        }
      });
    }
    return parsed;
  };
  useImperativeHandle(ref, () => ({ analyze, focus: () => inputRef.current?.focus(), chooseFiles: () => fileRef.current?.click() }));
  const remove = (kind, index) => setResult((current) => {
    onRemove?.(kind, current[kind][index]);
    return { ...current, [kind]: current[kind].filter((_item, itemIndex) => itemIndex !== index) };
  });
  const resolveUrl = async (url, index, includeOverride) => {
    const include = includeOverride !== undefined ? includeOverride : includeText;
    setResolving(index);
    try {
      const response = await api('/tools/resolve-link', { method: 'POST', body: { url: url.brut || url.normalise } });
      if (!response?.disponible) {
        push(response?.raison === 'ENRICHISSEMENT_DESACTIVE' ? t('smart.resolveDisabled') : (response?.message || t('smart.resolveFailed')), 'warning');
        return;
      }
      if (response.coords?.lat != null && response.coords?.lng != null) {
        const coord = { lat: response.coords.lat, lng: response.coords.lng, source: 'lien_court', precision_m: response.coords.precision_m ?? null };
        setResult((current) => {
          if (!current) return current;
          const nextUrls = current.urls.map((item, itemIndex) => (itemIndex === index ? { ...item, coords: response.coords, normalise: response.url_finale || item.normalise } : item));
          const next = { ...current, urls: nextUrls, coords: [...current.coords, coord] };
          onApply?.(next, coord, include);
          return next;
        });
        push(t('smart.applied'), 'success');
      } else {
        push(response?.message || t('smart.resolveFailed'), 'warning');
      }
    } catch (error) {
      push(error.message || t('smart.resolveFailed'), 'danger');
    } finally {
      setResolving(null);
    }
  };
  const handleFiles = (files) => { const list = [...files].slice(0, 5); if (list.length) onFiles?.(list); };
  const drop = (event) => {
    event.preventDefault();
    if (event.dataTransfer.files?.length) handleFiles(event.dataTransfer.files);
    else { const value = event.dataTransfer.getData('text/plain'); if (value) analyze(value); }
  };
  const readClipboard = async () => { try { analyze(await navigator.clipboard.readText()); } catch { inputRef.current?.focus(); } };
  const socialWithoutGps = Boolean(result?.urls?.some((url) => url.type === 'social')) && !result?.coords?.length;
  const coords = result?.coords || [];
  const needsChoice = coords.length > 1 && coords.some((coord) => haversineMeters(coords[0], coord) > 100);
  const understood = result && (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink2">{t('smart.understood')}</p>
      <div className="flex flex-wrap gap-2">
        {result.urls.map((url, index) => (
          <Chip key={`${url.normalise}-${index}`} onRemove={() => remove('urls', index)} action={url.type === 'carte' && !url.coords ? (
            <button type="button" className="ms-1 inline-flex items-center gap-1 rounded-sm text-brand-700 hover:underline disabled:opacity-50" disabled={resolving === index} onClick={() => resolveUrl(url, index)} title={t('smart.resolve')}>
              <Globe className="h-3.5 w-3.5" />{resolving === index ? t('smart.resolving') : t('smart.resolve')}
            </button>
          ) : null}>
            <Check className="h-3.5 w-3.5" />{t('smart.link')} · {url.plateforme ? t(`platform.${url.plateforme}`) : url.type} · {url.contenuType ? t(`content.${url.contenuType}`) : '—'}
          </Chip>
        ))}
        {coords.map((coord, index) => (
          <button key={`${coord.lat}-${coord.lng}-${index}`} type="button" className="inline-flex min-h-9 items-center gap-1 rounded-full border border-border bg-surface px-3 text-xs font-bold text-ink hover:border-brand-600" onClick={() => onApply?.(result, coord, includeText)}>
            <MapPinned className="h-3.5 w-3.5" />{t('smart.position', { coords: formatGps(coord.lat, coord.lng) })}
            {coords.length > 1 && <MousePointer2 className="h-3.5 w-3.5" aria-hidden="true" />}
          </button>
        ))}
        {result.dates.map((date, index) => (
          <Chip key={`${date.date}-${index}`} onRemove={() => remove('dates', index)}>
            {date.estimee ? t('smart.estimatedDate', { date: formatDate(date.date) }) : formatDate(date.date)}
          </Chip>
        ))}
      </div>
      {needsChoice && <Alert variant="warning" className="mt-3">{t('smart.choosePosition')}</Alert>}
      {result.texteRestant.length >= 10 && (
        <Checkbox className="mt-2" label={t('smart.addObservations')} checked={includeText} onChange={(event) => setIncludeText(event.target.checked)} />
      )}
    </div>
  );
  const socialAlert = socialWithoutGps ? (
    <Alert variant="info" className="mt-3">
      {t('smart.noPosition')}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => inputRef.current?.focus()}>{t('smart.pasteLocation')}</Button>
        <Button size="sm" variant="secondary" onClick={onPlaceMap}>{t('smart.placeMap')}</Button>
        <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>{t('smart.joinPhoto')}</Button>
      </div>
    </Alert>
  ) : null;
  return (
    <section className="mb-5 rounded-lg border border-dashed border-brand-600 bg-surface2 p-4 shadow-1" onDragOver={(event) => event.preventDefault()} onDrop={drop}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-brand-100 text-brand-800"><ClipboardPaste className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1"><h2 className="font-black text-ink">{t('smart.title')}</h2><p className="mt-1 text-xs text-ink2">{t('smart.placeholder')}</p></div>
        {window.isSecureContext && <Button size="sm" variant="secondary" onClick={readClipboard}><ClipboardPaste className="h-4 w-4" />{t('smart.paste')}</Button>}
      </div>
      <textarea ref={inputRef} id="smart-paste" aria-label={t('smart.title')} className="mt-4 min-h-24 w-full resize-y rounded-md border border-border bg-surface p-3 text-sm text-ink placeholder:text-muted" placeholder={window.isSecureContext ? t('smart.placeholder') : t('smart.ctrlV')} value={text} onChange={(event) => setText(event.target.value)} onPaste={(event) => { const value = event.clipboardData.getData('text/plain'); if (value) { event.preventDefault(); analyze(value); } }} />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => analyze(text)} disabled={!text.trim()}>{t('setup.preview')}</Button>
        <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()}><ImagePlus className="h-4 w-4" />{t('smart.joinPhoto')}</Button>
        <input ref={fileRef} className="sr-only" type="file" accept="image/*" multiple onChange={(event) => handleFiles(event.target.files)} />
      </div>
      {result && (
        <div className="mt-4">
          {understood}
          {socialAlert}
        </div>
      )}
    </section>
  );
});

export default SmartPasteZone;
