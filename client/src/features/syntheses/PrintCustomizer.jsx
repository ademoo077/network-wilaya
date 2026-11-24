import { useEffect } from 'react';
import { Printer } from 'lucide-react';
import { formatDateShort, todayAlgiers, PRINT_FORMATS, formatDims, normalizeMargins, utileZone } from '@anm/shared';
import { Button, Dialog, Input, Select, Textarea } from '../../components/ui/index.js';

const FORMATS = [
  { value: 'a5', label: 'A5' },
  { value: 'a4', label: 'A4' },
  { value: 'a3', label: 'A3' },
  { value: 'letter', label: 'Lettre' },
  { value: 'custom', label: 'Personnalisé' },
];

export function createPrintSettings({ modele, periode, user, t }) {
  return {
    title: modele?.nom || t('report.title'),
    subtitle: t('synthese.print.defaultSubtitle'),
    organization: t('app.wilaya'),
    department: t('synthese.print.defaultDepartment'),
    reference: '',
    reportDate: periode?.fin || periode?.debut || todayAlgiers(),
    periodStart: periode?.debut || '',
    periodEnd: periode?.fin || '',
    preparedBy: user?.full_name || '',
    checkedBy: '',
    approvedBy: '',
    footerNote: t('synthese.print.defaultFooter'),
    orientation: 'portrait',
    format: 'a4',
    customW: 210,
    customH: 297,
    margins: { top: 10, right: 10, bottom: 10, left: 10, gutter: 0 },
  };
}

function PrintPreview({ settings, blocs = [], t, lang }) {
  const custom = { w: settings.customW, h: settings.customH };
  const dims = formatDims(settings.format, settings.orientation, custom);
  const m = normalizeMargins(settings.margins, settings.format);
  const u = utileZone(settings.format, settings.orientation, settings.margins, custom);
  const landscape = settings.orientation === 'landscape';
  const titles = blocs.map((bloc) => bloc.titre).filter(Boolean).slice(0, 4);
  const ratio = dims.w / dims.h;
  return <div className="mx-auto w-full overflow-hidden rounded-md border border-border bg-surface p-4 shadow-1 max-w-md" data-print-preview data-orientation={settings.orientation}>
    <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-muted">
      {t('synthese.print.preview')} · {PRINT_FORMATS[settings.format]?.label || 'A4'} · {t(landscape ? 'synthese.print.landscape' : 'synthese.print.portrait')}
    </p>
    <div className="rounded border border-border bg-surface2 p-2" style={{ aspectRatio: `${ratio}` }}>
      <div className="h-full w-full border border-dashed border-border bg-surface p-2" style={{ padding: `${Math.max(2, m.top / 2)}mm ${Math.max(2, m.right / 2)}mm ${Math.max(2, m.bottom / 2)}mm ${Math.max(2, m.left / 2)}mm` }}>
        <div className="border-b-2 border-brand-700 pb-1 text-center">
          <p className="truncate text-[9px] font-black text-ink"><bdi>{settings.organization || '—'}</bdi></p>
          <h3 className="mt-1 truncate text-[11px] font-black text-ink"><bdi>{settings.title || '—'}</bdi></h3>
        </div>
        <div className="mt-2 grid gap-1">
          {(titles.length ? titles : ['—', '—']).map((title, index) => <div key={`${title}-${index}`} className="truncate rounded border border-border bg-surface px-1 py-0.5 text-[8px] text-ink2"><bdi>{title}</bdi></div>)}
        </div>
        <p className="mt-2 text-[8px] text-muted">{Math.round(u.width)}×{Math.round(u.height)} mm utiles</p>
      </div>
    </div>
    <p className="mt-2 text-[10px] leading-snug text-muted">{t('synthese.print.previewHelp')}</p>
  </div>;
}

export function PrintCustomizer({ open, settings, onChange, onClose, onPrint, onReset, blocs, t, lang }) {
  const set = (key) => (event) => onChange({ ...settings, [key]: event.target.value });
  const setMargin = (key) => (event) => onChange({ ...settings, margins: { ...(settings.margins || {}), [key]: Number(event.target.value) } });
  const m = normalizeMargins(settings.margins, settings.format);
  const min = PRINT_FORMATS[settings.format]?.min ?? 6;
  const warnMargin = [m.top, m.right, m.bottom, m.left].some((v) => v < min);
  return <Dialog open={open} onClose={onClose} title={t('synthese.print.title')} size="xl" footer={<>
    <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
    <Button variant="ghost" onClick={onReset}>{t('synthese.print.reset')}</Button>
    <Button onClick={onPrint} disabled={!settings.title.trim()}><Printer className="h-4 w-4" aria-hidden="true" />{t('synthese.print.launch')}</Button>
  </>}>
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,.8fr)]">
      <div className="grid content-start gap-4">
        <p className="rounded-md border border-border bg-surface2 p-3 text-xs leading-relaxed text-muted">{t('synthese.print.help')}</p>
        <fieldset className="grid gap-3">
          <legend className="text-xs font-black uppercase tracking-wider text-muted">{t('synthese.print.identity')}</legend>
          <div className="grid gap-4 sm:grid-cols-2"><Input label={t('synthese.print.reportTitle')} required value={settings.title} onChange={set('title')} /><Input label={t('synthese.print.subtitle')} value={settings.subtitle} onChange={set('subtitle')} /></div>
          <div className="grid gap-4 sm:grid-cols-2"><Input label={t('synthese.print.organization')} value={settings.organization} onChange={set('organization')} /><Input label={t('synthese.print.department')} value={settings.department} onChange={set('department')} /></div>
          <Textarea label={t('synthese.print.footer')} rows={2} value={settings.footerNote} onChange={set('footerNote')} />
        </fieldset>
        <fieldset className="grid gap-3">
          <legend className="text-xs font-black uppercase tracking-wider text-muted">{t('synthese.print.periodBlock')}</legend>
          <div className="grid gap-4 sm:grid-cols-2"><Input label={t('synthese.print.reference')} value={settings.reference} onChange={set('reference')} /><Input type="date" label={t('synthese.print.reportDate')} value={settings.reportDate} onChange={set('reportDate')} /></div>
          <div className="grid gap-4 sm:grid-cols-2"><Input type="date" label={t('synthese.debut')} value={settings.periodStart} onChange={set('periodStart')} /><Input type="date" label={t('synthese.fin')} value={settings.periodEnd} onChange={set('periodEnd')} /></div>
        </fieldset>
        <fieldset className="grid gap-3">
          <legend className="text-xs font-black uppercase tracking-wider text-muted">{t('synthese.print.signatures')}</legend>
          <div className="grid gap-4 sm:grid-cols-3"><Input label={t('synthese.print.preparedBy')} value={settings.preparedBy} onChange={set('preparedBy')} /><Input label={t('synthese.print.checkedBy')} value={settings.checkedBy} onChange={set('checkedBy')} /><Input label={t('synthese.print.approvedBy')} value={settings.approvedBy} onChange={set('approvedBy')} /></div>
        </fieldset>
        <fieldset className="grid gap-3">
          <legend className="text-xs font-black uppercase tracking-wider text-muted">{t('synthese.print.layout')}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label={t('synthese.print.format', { defaultValue: 'Format' })} value={settings.format || 'a4'} onChange={(e) => { const f = e.target.value; const def = PRINT_FORMATS[f]?.margin ?? 8; onChange({ ...settings, format: f, margins: { top: def, right: def, bottom: def, left: def, gutter: settings.margins?.gutter || 0 } }); }} options={FORMATS} />
            <Select label={t('synthese.print.orientation')} value={settings.orientation} onChange={set('orientation')} options={[{ value: 'portrait', label: t('synthese.print.portrait') }, { value: 'landscape', label: t('synthese.print.landscape') }]} />
          </div>
          {settings.format === 'custom' && <div className="grid gap-4 sm:grid-cols-2">
            <Input type="number" min={100} step="1" label={t('synthese.print.customW', { defaultValue: 'Largeur (mm)' })} value={settings.customW || 210} onChange={(e) => onChange({ ...settings, customW: Number(e.target.value) })} />
            <Input type="number" min={100} step="1" label={t('synthese.print.customH', { defaultValue: 'Hauteur (mm)' })} value={settings.customH || 297} onChange={(e) => onChange({ ...settings, customH: Number(e.target.value) })} />
          </div>}
          <div className="grid gap-3 sm:grid-cols-5">
            <Input type="number" min={0} step="1" label={t('synthese.print.marginTop', { defaultValue: 'Haut (mm)' })} value={m.top} onChange={setMargin('top')} />
            <Input type="number" min={0} step="1" label={t('synthese.print.marginRight', { defaultValue: 'Droite (mm)' })} value={m.right} onChange={setMargin('right')} />
            <Input type="number" min={0} step="1" label={t('synthese.print.marginBottom', { defaultValue: 'Bas (mm)' })} value={m.bottom} onChange={setMargin('bottom')} />
            <Input type="number" min={0} step="1" label={t('synthese.print.marginLeft', { defaultValue: 'Gauche (mm)' })} value={m.left} onChange={setMargin('left')} />
            <Input type="number" min={0} step="1" label={t('synthese.print.gutter', { defaultValue: 'Reliure (mm)' })} value={m.gutter} onChange={setMargin('gutter')} />
          </div>
          {warnMargin && <p className="text-xs text-stcours" role="status">{t('synthese.print.marginWarn', { defaultValue: 'Marge sous le minimum : risque de coupure par l’imprimante.' })}</p>}
        </fieldset>
      </div>
      <div className="rounded-lg bg-surface2 p-4"><PrintPreview settings={settings} blocs={blocs} t={t} lang={lang} /></div>
    </div>
  </Dialog>;
}

export function OfficialPrintDocument({ settings, t, lang, children }) {
  const custom = { w: settings.customW, h: settings.customH };
  const dims = formatDims(settings.format || 'a4', settings.orientation || 'portrait', custom);
  const m = normalizeMargins(settings.margins, settings.format || 'a4');
  const u = utileZone(settings.format || 'a4', settings.orientation || 'portrait', settings.margins, custom);
  const format = `${dims.w}mm ${dims.h}mm`;
  const scale = Math.max(0.75, Math.min(1.15, u.width / 190));
  const small = u.width < 140;
  useEffect(() => {
    const id = 'print-page-size';
    let el = document.getElementById(id);
    if (!el) { el = document.createElement('style'); el.id = id; document.head.appendChild(el); }
    el.textContent = `@page { size: ${format}; margin: 0; }`;
    document.documentElement.style.setProperty('--page-w-mm', `${dims.w}mm`);
    document.documentElement.style.setProperty('--page-h-mm', `${dims.h}mm`);
    return () => { el.textContent = ''; };
  }, [format, dims.w, dims.h]);
  const style = {
    '--print-format': format,
    '--page-w-mm': `${dims.w}mm`,
    '--page-h-mm': `${dims.h}mm`,
    '--marge-mm': `${m.top}mm`,
    '--marge-top-mm': `${m.top}mm`,
    '--marge-right-mm': `${m.right}mm`,
    '--marge-bottom-mm': `${m.bottom}mm`,
    '--marge-left-mm': `${m.left + (m.gutter || 0)}mm`,
    '--print-font-scale': String(scale),
  };
  return <div data-print-document data-orientation={settings.orientation} data-format={settings.format || 'a4'} data-small={small ? '1' : '0'} style={style} className="report-paper mx-auto rounded-xl bg-surface shadow-2 print:rounded-none print:shadow-none">
    <div className="print-page">
      <header data-print-header className="official-print-header hidden border-b-2 border-brand-700 pb-4 text-center print:block">
        <p className="text-sm font-black"><bdi>{settings.organization}</bdi></p>
        <p className="text-xs text-muted"><bdi>{settings.department}</bdi></p>
        <h1 className="mt-3 text-2xl font-black"><bdi>{settings.title}</bdi></h1>
        {settings.subtitle && <p className="mt-1 text-sm"><bdi>{settings.subtitle}</bdi></p>}
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <span>{t('synthese.print.reference')} : <bdi>{settings.reference || '—'}</bdi></span>
          <span>{t('synthese.print.period')} : <bdi>{settings.periodStart ? `${formatDateShort(settings.periodStart, lang)} → ${formatDateShort(settings.periodEnd || settings.periodStart, lang)}` : '—'}</bdi></span>
          <span>{t('synthese.print.reportDate')} : <bdi>{settings.reportDate ? formatDateShort(settings.reportDate, lang) : '—'}</bdi></span>
        </div>
      </header>
      <div className="official-print-body print-body">{children}</div>
      <footer data-print-footer className="official-print-footer hidden break-inside-avoid border-t border-border pt-3 print:block">
        <div className="grid grid-cols-3 gap-6 text-center text-xs">
          <div className="h-16"><p>{t('synthese.print.preparedBy')}</p><bdi className="font-bold">{settings.preparedBy || '—'}</bdi></div>
          <div className="h-16"><p>{t('synthese.print.checkedBy')}</p><bdi className="font-bold">{settings.checkedBy || '—'}</bdi></div>
          <div className="h-16"><p>{t('synthese.print.approvedBy')}</p><bdi className="font-bold">{settings.approvedBy || '—'}</bdi></div>
        </div>
        {settings.footerNote && <p className="mt-2 text-center text-[10px] text-muted"><bdi>{settings.footerNote}</bdi></p>}
      </footer>
    </div>
  </div>;
}
