import { Printer } from 'lucide-react';
import { formatDateShort, todayAlgiers } from '@anm/shared';
import { Button, Dialog, Input, Select, Textarea } from '../../components/ui/index.js';

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
  };
}

function PrintPreview({ settings, blocs = [], t, lang }) {
  const landscape = settings.orientation === 'landscape';
  const titles = blocs.map((bloc) => bloc.titre).filter(Boolean).slice(0, 4);
  return <div className={`mx-auto w-full overflow-hidden rounded-md border border-border bg-surface p-4 shadow-1 ${landscape ? 'max-w-2xl' : 'max-w-md'}`} data-print-preview data-orientation={settings.orientation}>
    <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-muted">
      {t('synthese.print.preview')} · {t(landscape ? 'synthese.print.landscape' : 'synthese.print.portrait')}
    </p>
    <div className={`rounded border border-border bg-surface2 p-3 ${landscape ? 'aspect-[297/210]' : 'aspect-[210/297]'}`}>
      <div className="border-b-2 border-brand-700 pb-2 text-center">
        <p className="truncate text-[10px] font-black text-ink"><bdi>{settings.organization || '—'}</bdi></p>
        <p className="truncate text-[9px] text-muted"><bdi>{settings.department || '—'}</bdi></p>
        <h3 className="mt-2 truncate text-sm font-black text-ink"><bdi>{settings.title || '—'}</bdi></h3>
        <p className="truncate text-[10px] text-ink2"><bdi>{settings.subtitle || '—'}</bdi></p>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1 text-[8px] text-muted">
        <span className="truncate">{t('synthese.print.reference')} : <bdi>{settings.reference || '—'}</bdi></span>
        <span className="truncate">{t('synthese.print.period')} : <bdi>{settings.periodStart ? `${formatDateShort(settings.periodStart, lang)} → ${formatDateShort(settings.periodEnd || settings.periodStart, lang)}` : '—'}</bdi></span>
        <span className="truncate">{t('synthese.print.reportDate')} : <bdi>{settings.reportDate ? formatDateShort(settings.reportDate, lang) : '—'}</bdi></span>
      </div>
      <p className="mt-3 text-[9px] font-black uppercase tracking-wider text-muted">{t('synthese.print.widgets')}</p>
      <div className="mt-1 grid gap-1">
        {(titles.length ? titles : ['—', '—', '—']).map((title, index) => <div key={`${title}-${index}`} className="truncate rounded border border-border bg-surface px-2 py-1 text-[9px] text-ink2"><bdi>{title}</bdi></div>)}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-2 text-center text-[8px] text-muted">
        <span className="truncate">{t('synthese.print.preparedBy')}<br /><bdi>{settings.preparedBy || '—'}</bdi></span>
        <span className="truncate">{t('synthese.print.checkedBy')}<br /><bdi>{settings.checkedBy || '—'}</bdi></span>
        <span className="truncate">{t('synthese.print.approvedBy')}<br /><bdi>{settings.approvedBy || '—'}</bdi></span>
      </div>
    </div>
    <p className="mt-2 text-[10px] leading-snug text-muted">{t('synthese.print.previewHelp')}</p>
  </div>;
}

export function PrintCustomizer({ open, settings, onChange, onClose, onPrint, onReset, blocs, t, lang }) {
  const set = (key) => (event) => onChange({ ...settings, [key]: event.target.value });
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
          <Select label={t('synthese.print.orientation')} value={settings.orientation} onChange={set('orientation')} options={[{ value: 'portrait', label: t('synthese.print.portrait') }, { value: 'landscape', label: t('synthese.print.landscape') }]} />
        </fieldset>
      </div>
      <div className="rounded-lg bg-surface2 p-4"><PrintPreview settings={settings} blocs={blocs} t={t} lang={lang} /></div>
    </div>
  </Dialog>;
}

export function OfficialPrintDocument({ settings, t, lang, children }) {
  return <div data-print-document data-orientation={settings.orientation} className={`report-paper mx-auto rounded-xl bg-surface p-4 shadow-2 sm:p-6 ${settings.orientation === 'landscape' ? 'print-landscape max-w-[1200px]' : 'print-portrait max-w-[900px]'}`}>
    <header data-print-header className="official-print-header hidden border-b-2 border-brand-700 pb-5 text-center print:block"><p className="text-sm font-black"><bdi>{settings.organization}</bdi></p><p className="text-xs text-muted"><bdi>{settings.department}</bdi></p><h1 className="mt-4 text-2xl font-black"><bdi>{settings.title}</bdi></h1>{settings.subtitle && <p className="mt-1 text-sm"><bdi>{settings.subtitle}</bdi></p>}<div className="mt-4 grid grid-cols-3 gap-3 text-xs"><span>{t('synthese.print.reference')} : <bdi>{settings.reference || '—'}</bdi></span><span>{t('synthese.print.period')} : <bdi>{settings.periodStart ? `${formatDateShort(settings.periodStart, lang)} → ${formatDateShort(settings.periodEnd || settings.periodStart, lang)}` : '—'}</bdi></span><span>{t('synthese.print.reportDate')} : <bdi>{settings.reportDate ? formatDateShort(settings.reportDate, lang) : '—'}</bdi></span></div></header>
    <div className="official-print-body">{children}</div>
    <footer data-print-footer className="official-print-footer hidden break-inside-avoid border-t border-border pt-4 print:block"><div className="grid grid-cols-3 gap-8 text-center text-xs"><div className="h-20"><p>{t('synthese.print.preparedBy')}</p><bdi className="font-bold">{settings.preparedBy || '—'}</bdi></div><div className="h-20"><p>{t('synthese.print.checkedBy')}</p><bdi className="font-bold">{settings.checkedBy || '—'}</bdi></div><div className="h-20"><p>{t('synthese.print.approvedBy')}</p><bdi className="font-bold">{settings.approvedBy || '—'}</bdi></div></div>{settings.footerNote && <p className="mt-3 text-center text-[10px] text-muted"><bdi>{settings.footerNote}</bdi></p>}</footer>
  </div>;
}
