import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { addDays, formatDateShort, todayAlgiers, PRINT_FORMATS, formatDims, normalizeMargins, utileZone, validerUrlSource } from '@anm/shared';
import { Button, Dialog, Input, Select, Textarea } from '../../components/ui/index.js';

const FORMATS = [
  { value: 'a5', label: 'A5' },
  { value: 'a4', label: 'A4' },
  { value: 'a3', label: 'A3' },
  { value: 'letter', label: 'Lettre' },
  { value: 'custom', label: 'Personnalisé' },
];

function referenceOfficielle(date) {
  const annee = String(date || todayAlgiers()).slice(0, 4);
  let sequence = 1;
  try {
    const cle = `anm.cw.sequence.${annee}`;
    sequence = Math.max(1, Number(localStorage.getItem(cle)) + 1 || 1);
    localStorage.setItem(cle, String(sequence));
  } catch { /* stockage indisponible : séquence locale non persistée */ }
  return `N° ${String(sequence).padStart(4, '0')}/CW/${annee}`;
}

export function createPrintSettings({ modele, periode, user, t }) {
  const fin = periode?.fin || todayAlgiers();
  const debut = periode?.debut || addDays(fin, -6);
  const reportDate = fin;
  return {
    title: modele?.nom || t('report.title'),
    subtitle: t('synthese.print.defaultSubtitle'),
    organization: t('app.wilaya'),
    department: '',
    reference: referenceOfficielle(reportDate),
    reportDate,
    periodStart: debut,
    periodEnd: fin,
    preparedBy: user?.full_name || '',
    checkedBy: '',
    approvedBy: '',
    footerNote: t('synthese.print.defaultFooter'),
    diffusion: t('v19.diffusionInterne'),
    statut: 'projet',
    rechercheEnLigne: false,
    sources: [],
    sourceTitre: '',
    sourceUrl: '',
    domaineAjout: '',
    orientation: 'portrait',
    format: 'a4',
    customW: 210,
    customH: 297,
    margins: { top: 10, right: 10, bottom: 10, left: 10, gutter: 0 },
    profile: { name: '', offsetX: 0, offsetY: 0, safe: 0 },
  };
}

function PrintPreview({ settings, blocs = [], t }) {
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

function PrintTestPage({ settings }) {
  const custom = { w: settings.customW, h: settings.customH };
  const dims = formatDims(settings.format || 'a4', settings.orientation || 'portrait', custom);
  const m = normalizeMargins(settings.margins, settings.format || 'a4');
  const style = { '--page-w-mm': `${dims.w}mm`, '--page-h-mm': `${dims.h}mm`, '--marge-top-mm': `${m.top}mm`, '--marge-right-mm': `${m.right}mm`, '--marge-bottom-mm': `${m.bottom}mm`, '--marge-left-mm': `${m.left + (m.gutter || 0)}mm` };
  return <div data-print-test style={style} className="mx-auto bg-surface border border-border" >
    <div style={{ width: `${dims.w}mm`, height: `${dims.h}mm`, padding: `${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left + (m.gutter||0)}mm`, boxSizing: 'border-box', position: 'relative', background: 'white', color: 'black' }}>
      <div style={{ position: 'absolute', inset: '5mm', border: '1px solid black' }} />
      <div style={{ position: 'absolute', inset: '10mm', border: '1px dashed gray' }} />
      {[[10,10],[dims.w-10,10],[10,dims.h-10],[dims.w-10,dims.h-10]].map(([x,y],i)=><div key={i} style={{ position:'absolute', left:`${x-3}mm`, top:`${y}mm`, width:'6mm', height:'1px', background:'black' }} />)}
      {[[10,10],[dims.w-10,10],[10,dims.h-10],[dims.w-10,dims.h-10]].map(([x,y],i)=><div key={`v${i}`} style={{ position:'absolute', left:`${x}mm`, top:`${y-3}mm`, width:'1px', height:'6mm', background:'black' }} />)}
      <div style={{ position:'absolute', left:'50%', top:'10mm', bottom:'10mm', width:'1px', background:'rgb(221 221 221)' }} />
      <div style={{ position:'absolute', top:'50%', left:'10mm', right:'10mm', height:'1px', background:'rgb(221 221 221)' }} />
      <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', fontSize:'10pt' }}>+ centre</div>
      <div style={{ position:'absolute', top:'15mm', left:'15mm', right:'15mm', fontSize:'10pt' }}>
        <strong>Page de test d’alignement</strong> — {PRINT_FORMATS[settings.format]?.label || settings.format} {settings.orientation}
        <div style={{ marginTop:'2mm' }}>Règle 10 cm : mesurez la barre ci-dessous.</div>
        <div style={{ marginTop:'2mm', width:'100mm', height:'5mm', border:'1px solid black', display:'flex' }}>{Array.from({length:10}).map((_,i)=><div key={i} style={{ flex:1, borderRight:i<9?'1px solid black':'none', fontSize:'7pt', textAlign:'center' }}>{i+1}</div>)}</div>
        <div style={{ marginTop:'2mm' }}>Cadres à 5 mm et 10 mm des bords. Flèche haut ↑</div>
      </div>
    </div>
  </div>;
}

export function PrintCustomizer({ open, settings, onChange, onClose, onPrint, onReset, blocs, t, lang, role = 'operateur', sourcesAutorisees = [], onAddDomaine }) {
  const validationSource = settings.sourceUrl ? validerUrlSource(settings.sourceUrl, sourcesAutorisees.map((source) => source.domaine)) : null;
  const [showTest, setShowTest] = useState(false);
  const set = (key) => (event) => onChange({ ...settings, [key]: event.target.value });
  const setMargin = (key) => (event) => onChange({ ...settings, margins: { ...(settings.margins || {}), [key]: Number(event.target.value) } });
  const setProfile = (key) => (event) => onChange({ ...settings, profile: { ...(settings.profile || {}), [key]: key === 'name' ? event.target.value : Number(event.target.value) } });
  const m = normalizeMargins(settings.margins, settings.format);
  const min = PRINT_FORMATS[settings.format]?.min ?? 6;
  const warnMargin = [m.top, m.right, m.bottom, m.left].some((v) => v < min);
  const profile = settings.profile || {};
  return <Dialog open={open} onClose={onClose} title={t('synthese.print.title')} size="xl" footer={<>
    <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
    <Button variant="ghost" onClick={() => setShowTest((v) => !v)}>{t('synthese.print.testPage', { defaultValue: 'Page de test' })}</Button>
    <Button variant="ghost" onClick={onReset}>{t('synthese.print.reset')}</Button>
    <Button onClick={onPrint} disabled={!settings.title.trim()}><Printer className="h-4 w-4" aria-hidden="true" />{t('synthese.print.launch')}</Button>
  </>}>
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,.8fr)]">
      <div className="grid content-start gap-4">
        <p className="rounded-md border border-border bg-surface2 p-3 text-xs leading-relaxed text-muted">{t('synthese.print.help')}</p>
        {showTest && <div className="overflow-auto rounded-md border border-border p-2 space-y-2">
          <div className="flex justify-end"><Button size="sm" variant="secondary" onClick={() => {
            const custom = { w: settings.customW, h: settings.customH };
            const dims = formatDims(settings.format || 'a4', settings.orientation || 'portrait', custom);
            const m = normalizeMargins(settings.margins, settings.format || 'a4');
            const w = dims.w, h = dims.h;
            const html = `<!doctype html><html><head><meta charset="utf-8"><title>Test impression</title><style>@page{size:${w}mm ${h}mm;margin:0}html,body{margin:0;padding:0;width:${w}mm;height:${h}mm;background:white;color:black;font:10pt Arial,sans-serif}*{box-sizing:border-box}.page{width:${w}mm;height:${h}mm;padding:${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left+(m.gutter||0)}mm;position:relative}.f5{position:absolute;inset:5mm;border:1px solid black}.f10{position:absolute;inset:10mm;border:1px dashed gray}.c{position:absolute;left:50%;top:10mm;bottom:10mm;width:1px;background:rgb(221 221 221)}.ch{position:absolute;top:50%;left:10mm;right:10mm;height:1px;background:rgb(221 221 221)}</style></head><body><div class="page"><div class="f5"></div><div class="f10"></div><div class="c"></div><div class="ch"></div><div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)">+ centre</div><div style="position:absolute;top:15mm;left:15mm;right:15mm"><strong>Page de test d'alignement</strong> — ${PRINT_FORMATS[settings.format]?.label||settings.format} ${settings.orientation}<div style="margin-top:2mm">Règle 10 cm :</div><div style="margin-top:2mm;width:100mm;height:5mm;border:1px solid black;display:flex">${Array.from({length:10}).map((_,i)=>`<div style="flex:1;border-right:${i<9?'1px solid black':'none'};font-size:7pt;text-align:center">${i+1}</div>`).join('')}</div><div style="margin-top:2mm">Cadres à 5 mm et 10 mm. Flèche haut ↑</div></div><div style="position:absolute;left:7mm;top:10mm;width:6mm;height:1px;background:black"></div><div style="position:absolute;left:10mm;top:7mm;width:1px;height:6mm;background:black"></div><div style="position:absolute;right:7mm;top:10mm;width:6mm;height:1px;background:black"></div><div style="position:absolute;right:10mm;top:7mm;width:1px;height:6mm;background:black"></div><div style="position:absolute;left:7mm;bottom:10mm;width:6mm;height:1px;background:black"></div><div style="position:absolute;left:10mm;bottom:7mm;width:1px;height:6mm;background:black"></div><div style="position:absolute;right:7mm;bottom:10mm;width:6mm;height:1px;background:black"></div><div style="position:absolute;right:10mm;bottom:7mm;width:1px;height:6mm;background:black"></div></div><script>window.onload=()=>{window.print();setTimeout(()=>window.close(),300)}</script></body></html>`;
            const win = window.open('', '_blank'); if (win) { win.document.write(html); win.document.close(); }
          }}>{t('synthese.print.printTest', { defaultValue: 'Imprimer la page de test' })}</Button></div>
          <PrintTestPage settings={settings} t={t} />
        </div>}
        <fieldset className="grid gap-3">
          <legend className="text-xs font-black uppercase tracking-wider text-muted">{t('synthese.print.identity')}</legend>
          <div className="grid gap-4 sm:grid-cols-2"><Input label={t('synthese.print.reportTitle')} required value={settings.title} onChange={set('title')} /><Input label={t('synthese.print.subtitle')} value={settings.subtitle} onChange={set('subtitle')} /></div>
          <div className="grid gap-4 sm:grid-cols-2"><Input label={t('synthese.print.organization')} value={settings.organization} onChange={set('organization')} /><Input label={t('v19.ministryLabel')} value={settings.department} onChange={set('department')} /></div>
          <div className="grid gap-4 sm:grid-cols-2"><Input type="date" label={t('v19.algerLe')} value={settings.reportDate} onChange={set('reportDate')} /><Input label={t('synthese.print.reference')} value={settings.reference} onChange={set('reference')} /></div>
          <Textarea label={t('synthese.print.footer')} rows={2} value={settings.footerNote} onChange={set('footerNote')} />
        </fieldset>
        <fieldset className="grid gap-3" data-print-period-block>
          <legend className="text-xs font-black uppercase tracking-wider text-muted">{t('synthese.print.periodBlock')}</legend>
          <p className="text-xs text-muted">{t('v19.singlePeriodHelp')}</p>
          <div className="grid gap-4 sm:grid-cols-2"><Input type="date" label={t('synthese.debut')} value={settings.periodStart} onChange={set('periodStart')} /><Input type="date" label={t('synthese.fin')} value={settings.periodEnd} onChange={set('periodEnd')} /></div>
        </fieldset>
        <fieldset className="grid gap-3" data-print-sources-block>
          <legend className="text-xs font-black uppercase tracking-wider text-muted">{t('v19.sources')}</legend>
          <label className="flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={false} disabled data-source-search />
            {t('v19.onlineSearch')}
          </label>
          <p className="text-[11px] text-muted">{t('v19.onlineSearchHelp')}</p>
          {role === 'admin' && <div className="flex flex-wrap items-end gap-2">
            <Input label={t('v19.whitelist')} value={settings.domaineAjout || ''} onChange={set('domaineAjout')} placeholder="exemple.dz" />
            <Button size="sm" variant="secondary" onClick={() => { if (settings.domaineAjout) { onAddDomaine?.(settings.domaineAjout); onChange({ ...settings, domaineAjout: '' }); } }}>{t('common.add')}</Button>
          </div>}
          {Boolean(sourcesAutorisees?.length) && <ul className="flex flex-wrap gap-2 text-[11px] text-muted">{sourcesAutorisees.map((source) => <li key={source.id} className="rounded-full border border-border px-2 py-0.5" data-whitelist-domain>{source.domaine}</li>)}</ul>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label={t('v19.sourceTitle')} value={settings.sourceTitre || ''} onChange={set('sourceTitre')} />
            <Input label={t('v19.sourceUrl')} value={settings.sourceUrl || ''} onChange={set('sourceUrl')} />
          </div>
          {settings.sourceUrl && validationSource && !validationSource.ok && <p className="text-[11px] text-danger" data-source-error>{t(`v19.source${validationSource.motif}`, { defaultValue: t('v19.sourceHorsListe') })}</p>}
          <Button size="sm" variant="secondary" disabled={!validationSource?.ok || !settings.sourceTitre?.trim()} onClick={() => {
            onChange({ ...settings, sources: [...(settings.sources || []), { titre: settings.sourceTitre.trim(), url: settings.sourceUrl.trim() }], sourceTitre: '', sourceUrl: '' });
          }}>{t('v19.sourceAdd')}</Button>
          {Boolean(settings.sources?.length) && <ul className="grid gap-1 text-xs" data-source-list>{settings.sources.map((source, index) => <li key={`${source.url}-${index}`} className="flex items-center justify-between gap-2"><bdi>{source.titre}</bdi><button type="button" className="text-muted" onClick={() => onChange({ ...settings, sources: settings.sources.filter((_, i) => i !== index) })}>{t('common.remove')}</button></li>)}</ul>}
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
        <fieldset className="grid gap-3">
          <legend className="text-xs font-black uppercase tracking-wider text-muted">{t('synthese.print.profile', { defaultValue: 'Profil d’imprimante' })}</legend>
          <div className="grid gap-3 sm:grid-cols-4">
            <Input label={t('synthese.print.profileName', { defaultValue: 'Nom' })} value={profile.name || ''} onChange={setProfile('name')} />
            <Input type="number" step="0.5" label={t('synthese.print.offsetX', { defaultValue: 'Décalage X (mm)' })} value={profile.offsetX || 0} onChange={setProfile('offsetX')} />
            <Input type="number" step="0.5" label={t('synthese.print.offsetY', { defaultValue: 'Décalage Y (mm)' })} value={profile.offsetY || 0} onChange={setProfile('offsetY')} />
            <Input type="number" min={0} step="0.5" label={t('synthese.print.safeMargin', { defaultValue: 'Marge sécurité (mm)' })} value={profile.safe || 0} onChange={setProfile('safe')} />
          </div>
        </fieldset>
        <div className="rounded-md border border-border bg-surface2 p-3 text-xs text-muted">
          <p className="font-bold text-ink2">{t('synthese.print.recommended', { defaultValue: 'Réglages recommandés' })}</p>
          <ul className="mt-1 list-disc ps-4 space-y-0.5">
            <li>{t('synthese.print.recScale', { defaultValue: 'Échelle 100 % (taille réelle), sans « Ajuster à la page ».' })}</li>
            <li>{t('synthese.print.recHeaders', { defaultValue: 'En-têtes et pieds de page du navigateur désactivés.' })}</li>
            <li>{t('synthese.print.recPaper', { defaultValue: 'Papier = format choisi.' })}</li>
          </ul>
        </div>
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
  const profile = settings.profile || {};
  const offX = Number(profile.offsetX) || 0;
  const offY = Number(profile.offsetY) || 0;
  const safe = Math.max(0, Number(profile.safe) || 0);
  const style = {
    '--print-format': format,
    '--page-w-mm': `${dims.w}mm`,
    '--page-h-mm': `${dims.h}mm`,
    '--marge-mm': `${m.top}mm`,
    '--marge-top-mm': `${m.top + safe}mm`,
    '--marge-right-mm': `${m.right + safe}mm`,
    '--marge-bottom-mm': `${m.bottom + safe}mm`,
    '--marge-left-mm': `${m.left + (m.gutter || 0) + safe}mm`,
    '--print-font-scale': String(scale),
    '--print-offset-x': `${offX}mm`,
    '--print-offset-y': `${offY}mm`,
  };
  const orientClass = settings.orientation === 'landscape' ? 'print-landscape' : 'print-portrait';
  return <div data-print-document data-orientation={settings.orientation} data-format={settings.format || 'a4'} data-small={small ? '1' : '0'} data-statut={settings.statut || 'projet'} style={style} className={`report-paper mx-auto rounded-xl bg-surface shadow-2 print:rounded-none print:shadow-none ${orientClass}`}>
    <div className="print-page">
      <header data-print-header className="official-print-header hidden border-b-2 border-brand-700 pb-4 text-center print:block">
        <p className="text-[11px] font-bold uppercase tracking-wide">
          <bdi lang="fr">{t('v19.republicFr')}</bdi>
          <span aria-hidden="true"> · </span>
          <bdi lang="ar" dir="rtl">{t('v19.republicAr')}</bdi>
        </p>
        <p className="text-sm font-black"><bdi>{settings.organization}</bdi></p>
        {settings.department && <p className="text-xs text-muted"><bdi>{settings.department}</bdi></p>}
        <p className="text-xs font-bold">{t('v19.cabinet')}</p>
        <h1 className="mt-3 text-2xl font-black"><bdi>{settings.title}</bdi></h1>
        {settings.subtitle && <p className="mt-1 text-sm"><bdi>{settings.subtitle}</bdi></p>}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-0 whitespace-nowrap text-xs" data-print-meta>
          <span>{t('v19.algerLe')} <bdi>{settings.reportDate ? formatDateShort(settings.reportDate, lang) : '—'}</bdi></span>
          <span>{t('synthese.print.reference')} : <bdi>{settings.reference || '—'}</bdi></span>
          <span>{t('synthese.print.period')} : <bdi>{settings.periodStart ? `${formatDateShort(settings.periodStart, lang)} → ${formatDateShort(settings.periodEnd || settings.periodStart, lang)}` : '—'}</bdi></span>
        </div>
      </header>
      <div className="official-print-body print-body">{children}</div>
      <footer data-print-footer className="official-print-footer hidden break-inside-avoid border-t border-border pt-3 print:block">
        <div className="grid grid-cols-3 gap-6 text-center text-xs">
          <div className="h-16"><p>{t('synthese.print.preparedBy')}</p><bdi className="font-bold">{settings.preparedBy || '—'}</bdi></div>
          <div className="h-16"><p>{t('synthese.print.checkedBy')}</p><bdi className="font-bold">{settings.checkedBy || '—'}</bdi></div>
          <div className="h-16"><p>{t('synthese.print.approvedBy')}</p><bdi className="font-bold">{settings.approvedBy || '—'}</bdi></div>
        </div>
        <p className="mt-2 flex flex-wrap items-center justify-center gap-x-4 text-center text-[10px] text-muted" data-print-foot-meta data-page-label={t('v19.pageOf', { page: 1, total: 1 })}>
          <span>{settings.reference || '—'}</span>
          <span>{settings.diffusion || t('v19.diffusionInterne')}</span>
        </p>
        {settings.footerNote && <p className="mt-1 text-center text-[10px] text-muted"><bdi>{settings.footerNote}</bdi></p>}
        {Boolean(settings.sources?.length) && <ul className="mt-1 grid gap-0.5 text-[10px] text-muted" data-print-sources>
          {settings.sources.map((source, index) => <li key={`${source.url}-${index}`}><bdi>{source.titre}</bdi> — <bdi dir="ltr">{source.url}</bdi></li>)}
        </ul>}
      </footer>
    </div>
  </div>;
}
