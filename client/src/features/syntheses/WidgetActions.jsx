import { useState } from 'react';
import {
  ArrowDown, ArrowUp, Copy, Download, Edit, EyeOff, FileJson, FileText,
  GripVertical, Info, Maximize2, MoreHorizontal, Scaling, Table2, Trash2, X,
} from 'lucide-react';
import { formatValue } from '@anm/shared';
import { Button, Card, Dialog } from '../../components/ui/index.js';
import {
  dimensionLabel, dimsOf, downloadWidgetCsv, measureLabel, mesuresOf,
  rowDimensionLabel, rowsOf,
} from './widgetData.js';
import { downloadWidgetJson, downloadWidgetPng } from './widgetExport.js';

function IconAction({ label, children, ...props }) {
  return <button type="button" className="inline-grid h-8 w-8 shrink-0 place-items-center rounded-sm border border-transparent text-ink hover:border-border hover:bg-surface2 disabled:opacity-50" aria-label={label} title={label} {...props}>{children}</button>;
}

function MenuAction({ icon: Icon, children, ...props }) {
  return <button type="button" className="flex min-h-9 w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-xs font-semibold text-ink hover:bg-surface2 disabled:opacity-50" {...props}><Icon className="h-4 w-4 shrink-0" aria-hidden="true" /><span>{children}</span></button>;
}

export function WidgetActionBar({ result, bloc, title, lang, t, onDialog, onVoirFiches, editorActions }) {
  const [more, setMore] = useState(false);
  const run = (action) => () => { setMore(false); action?.(); };
  return <div className="flex max-w-full flex-wrap items-center justify-end gap-0.5 no-print" data-widget-actions>
    {editorActions?.onMoveStart && <IconAction label={t('synthese.deplacer')} onPointerDown={editorActions.onMoveStart} onPointerMove={editorActions.onPointerMove} onPointerUp={editorActions.onPointerUp} onPointerCancel={editorActions.onPointerUp}><GripVertical className="h-4 w-4" aria-hidden="true" /></IconAction>}
    {editorActions?.onResizeStart && <IconAction label={t('synthese.redimensionner')} onPointerDown={editorActions.onResizeStart} onPointerMove={editorActions.onPointerMove} onPointerUp={editorActions.onPointerUp} onPointerCancel={editorActions.onPointerUp}><Scaling className="h-4 w-4" aria-hidden="true" /></IconAction>}
    <IconAction label={t('synthese.action.info')} onClick={() => onDialog('info')}><Info className="h-4 w-4" aria-hidden="true" /></IconAction>
    <IconAction label={t('synthese.action.fullscreen')} disabled={!result} onClick={() => onDialog('full')}><Maximize2 className="h-4 w-4" aria-hidden="true" /></IconAction>
    <IconAction label={t('synthese.exporterCsv')} disabled={!result} onClick={() => downloadWidgetCsv(result, title, lang)}><Download className="h-4 w-4" aria-hidden="true" /></IconAction>
    <IconAction label={t('synthese.action.more')} aria-expanded={more} onClick={() => setMore((value) => !value)}><MoreHorizontal className="h-4 w-4" aria-hidden="true" /></IconAction>
    {more && <div className="basis-full rounded-md border border-border bg-surface p-1 shadow-1" role="menu" data-widget-menu>
      <MenuAction icon={Table2} disabled={!result} onClick={run(() => onDialog('data'))}>{t('synthese.action.data')}</MenuAction>
      {onVoirFiches && <MenuAction icon={FileText} disabled={!result} onClick={run(onVoirFiches)}>{t('synthese.voirFiches')}</MenuAction>}
      {editorActions?.onMoveUp && <MenuAction icon={ArrowUp} onClick={run(editorActions.onMoveUp)}>{t('synthese.monter')}</MenuAction>}
      {editorActions?.onMoveDown && <MenuAction icon={ArrowDown} onClick={run(editorActions.onMoveDown)}>{t('synthese.descendre')}</MenuAction>}
      {editorActions?.onDuplicate && <MenuAction icon={Copy} onClick={run(editorActions.onDuplicate)}>{t('synthese.dupliquer')}</MenuAction>}
      {editorActions?.onEdit && <MenuAction icon={Edit} onClick={run(editorActions.onEdit)}>{t('synthese.editer')}</MenuAction>}
      <MenuAction icon={Download} disabled={!result} onClick={run(() => downloadWidgetCsv(result, title, lang))}>{t('synthese.exporterCsv')}</MenuAction>
      <MenuAction icon={Download} disabled={!result} onClick={run(() => downloadWidgetPng({ title, result, lang }))}>{t('synthese.action.png')}</MenuAction>
      <MenuAction icon={FileJson} disabled={!result} onClick={run(() => downloadWidgetJson({ title, bloc, result }))}>{t('synthese.action.json')}</MenuAction>
      {editorActions?.onTogglePrint && <MenuAction icon={EyeOff} onClick={run(editorActions.onTogglePrint)}>{bloc.options?.masquer_impression ? t('synthese.widget.printVisible') : t('synthese.widget.printHidden')}</MenuAction>}
      {editorActions?.onRemove && <MenuAction icon={Trash2} onClick={run(editorActions.onRemove)}>{t('synthese.supprimer')}</MenuAction>}
    </div>}
  </div>;
}

function InfoContent({ result, t, lang }) {
  const meta = result?.meta || {};
  const definitions = meta.definitions || [];
  const filtres = meta.filtres_resumes || [];
  return <div className="grid gap-3 text-sm text-ink2">
    {meta.periode && <p><bdi>{t('synthese.info.periode')}</bdi> : {lang === 'ar' ? meta.periode.fin : `${meta.periode.debut} → ${meta.periode.fin}`}</p>}
    {meta.base_temps && <p><bdi>{t('synthese.info.base')}</bdi> : <bdi>{meta.base_temps}</bdi></p>}
    {filtres.length > 0 && <div><p className="font-bold">{t('synthese.info.filtres')}</p><ul className="list-disc ps-5">{filtres.map((item, index) => <li key={index}><bdi>{typeof item === 'string' ? item : item.label || JSON.stringify(item)}</bdi></li>)}</ul></div>}
    {definitions.length > 0 && <div><p className="font-bold">{t('synthese.info.definitions')}</p><ul className="list-disc ps-5">{definitions.map((item, index) => <li key={index}><bdi>{typeof item === 'string' ? item : item.description || item.label || JSON.stringify(item)}</bdi></li>)}</ul></div>}
    {!meta.periode && !definitions.length && !filtres.length && <p>{t('synthese.info.empty')}</p>}
  </div>;
}

function DataTable({ result, lang, t }) {
  const dimensions = dimsOf(result);
  const measures = mesuresOf(result);
  const rows = rowsOf(result).slice(0, 40);
  return <div className="max-h-[60vh] overflow-auto rounded-md border border-border"><table className="w-full text-sm"><thead className="sticky top-0 bg-surface2"><tr>
    {dimensions.map((dimension, index) => <th key={index} className="border-b border-border px-3 py-2 text-start text-xs font-bold text-ink2">{dimensionLabel(dimension.champ, lang)}</th>)}
    {measures.map((measure) => <th key={measure.id} className="border-b border-border px-3 py-2 text-end text-xs font-bold text-ink2">{measureLabel(measure.id, lang)}</th>)}
  </tr></thead><tbody>
    {rows.map((row, index) => <tr key={index} className="border-b border-border last:border-0">{dimensions.map((dimension, dimensionIndex) => <td key={dimensionIndex} className="px-3 py-2 text-start"><bdi>{rowDimensionLabel(row, dimension, dimensionIndex, lang)}</bdi></td>)}{measures.map((measure) => <td key={measure.id} className="px-3 py-2 text-end"><bdi dir="ltr">{formatValue(row.valeurs?.[measure.id], measure.format, lang)}</bdi></td>)}</tr>)}
    {rows.length === 0 && <tr><td colSpan={Math.max(1, dimensions.length + measures.length)} className="px-4 py-5 text-center text-muted">{t('synthese.aucuneLigne')}</td></tr>}
  </tbody></table></div>;
}

export function WidgetDialogs({ dialog, onClose, title, result, lang, t, fullBody }) {
  return <>
    {dialog === 'info' && <Dialog open onClose={onClose} title={`${t('synthese.action.info')} — ${title}`} size="lg"><InfoContent result={result} t={t} lang={lang} /></Dialog>}
    {dialog === 'data' && <Dialog open onClose={onClose} title={`${t('synthese.action.data')} — ${title}`} size="xl"><DataTable result={result} lang={lang} t={t} /></Dialog>}
    {dialog === 'full' && <div className="fixed inset-0 z-[80] overflow-auto bg-surface p-4" role="dialog" aria-modal="true" aria-label={title} data-widget-fullscreen><div className="mb-3 flex justify-end"><Button size="sm" variant="secondary" onClick={onClose} aria-label={t('synthese.action.close')}><X className="h-4 w-4" aria-hidden="true" />{t('synthese.action.close')}</Button></div><Card className="mx-auto max-w-[1280px] p-4">{fullBody}</Card></div>}
  </>;
}
