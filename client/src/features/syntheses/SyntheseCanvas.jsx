import { useMemo, useState } from 'react';
import { convertirEnGrille } from '@anm/shared';
import { Clock, EyeOff, FileText, Plus, Printer, RotateCcw, RotateCw, Save } from 'lucide-react';
import { Alert, Button, Card, EmptyState, Skeleton } from '../../components/ui/index.js';
import { Chip } from '../../components/ui/Chip.jsx';
import StudioGrid from './StudioGrid.jsx';

export default function SyntheseCanvas({
  modele, mode, sourceId, alreadyFrozen, editor, blocs, activeBlocs, activeResults, maxWidgets,
  t, lang, dir, onAdd, onSave, onReset, onEdit, onOpenEditions, onPrint, onPreview, onVoirFiches, embedded = false,
}) {
  const [zoom, setZoom] = useState(100);
  const layout = useMemo(() => convertirEnGrille(editor.currentDefinition), [editor.currentDefinition]);
  return <>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 no-print">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        {embedded && <h2 className="truncate text-sm font-bold text-ink">{modele.nom}</h2>}
        {modele.cle_systeme
          ? <Chip variant="secondaire" data-system-label>{t('synthese.systemeUnique')}</Chip>
          : <Chip variant="primaire">{t(`synthese.portee.${modele.portee}`)}</Chip>}
        {alreadyFrozen && <Chip variant="secondaire">{t('synthese.feuilleFeigeeLabel')}</Chip>}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 no-print">
        {mode === 'personnaliser' && <>
          <Button size="sm" variant="ghost" onClick={onAdd} disabled={blocs.length >= maxWidgets}>
            <Plus className="h-4 w-4" aria-hidden="true" />{t('synthese.ajouterWidget')}
          </Button>
          <label className="flex items-center gap-1 text-xs text-muted">
            <span className="sr-only">{t('synthese.zoom')}</span>
            <select id="studio-zoom" className="rounded-md border border-border bg-surface px-1.5 py-1 text-xs" value={zoom} onChange={(event) => setZoom(Number(event.target.value))}>
              {[50, 75, 100, 125, 150].map((value) => <option key={value} value={value}>{value} %</option>)}
            </select>
          </label>
          <Button size="sm" variant="ghost" disabled={!editor.canUndo} onClick={editor.undo}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />{t('synthese.annuler')}
          </Button>
          <Button size="sm" variant="ghost" disabled={!editor.canRedo} onClick={editor.redo}>
            <RotateCw className="h-4 w-4" aria-hidden="true" />{t('synthese.refaire')}
          </Button>
          <Button size="sm" onClick={onSave} loading={editor.saving} disabled={!editor.dirty}>
            <Save className="h-4 w-4" aria-hidden="true" />{t('synthese.enregistrer')}
          </Button>
          {modele.portee !== 'systeme' && sourceId && <Button size="sm" variant="secondary" onClick={onReset}>
            <EyeOff className="h-4 w-4" aria-hidden="true" />{t('synthese.revenirStandard')}
          </Button>}
        </>}
        {mode === 'personnaliser' && onPreview && <Button size="sm" variant="secondary" onClick={onPreview} aria-label={t('synthese.previewA4')}>
          <FileText className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">{t('synthese.previewA4')}</span>
        </Button>}
        <Button size="sm" variant="secondary" onClick={onOpenEditions}>
          <Clock className="h-4 w-4" aria-hidden="true" />{t('synthese.editions')}
        </Button>
        <Button size="sm" variant="ghost" onClick={onPrint} aria-label={t('synthese.print.launch')}>
          <Printer className="h-4 w-4" aria-hidden="true" />{t('common.imprimer')}
        </Button>
      </div>
    </div>

    {editor.evaluationError && <Alert variant="danger" title={t('synthese.erreurCalcul')} className="mb-4">
      {editor.evaluationError.message || t('common.error')}
    </Alert>}
    {editor.saveError && <Alert variant="danger" title={t('synthese.erreurEnregistrement')} className="mb-4 no-print">
      {editor.saveError.message || t('common.error')}
    </Alert>}

    {editor.evaluating && <div className="mb-3" data-synthese-loading><Card className="p-8"><Skeleton className="h-24 w-full" /></Card></div>}
    {blocs.length === 0
      ? <EmptyState title={t('synthese.aucunWidget')} description={t('synthese.aucunWidgetHelp')} action={
        <Button size="sm" onClick={onAdd}><Plus className="h-4 w-4" aria-hidden="true" />{t('synthese.ajouterWidget')}</Button>
      } />
      : <StudioGrid
        layout={layout}
        blocs={activeBlocs}
        results={activeResults}
        mode={mode}
        t={t}
        lang={lang}
        dir={dir}
        zoom={zoom}
        onVoirFiches={onVoirFiches}
        onEdit={onEdit}
        onRemove={editor.removeBloc}
        onDuplicate={editor.dupliquerBloc}
        onMove={editor.moveWidget}
        onResize={editor.resizeWidget}
        onMoveBloc={editor.moveBloc}
        onUndo={editor.undo}
        onRedo={editor.redo}
      />}

    {mode === 'personnaliser' && <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted no-print">
      <div className="flex flex-wrap items-center gap-3"><span>{t('synthese.nbWidgets', { count: blocs.length, max: maxWidgets })}</span>{editor.lastSavedAt && !editor.dirty && <span role="status" className="text-muted">{t('synthese.enregistree')}</span>}</div>
      <Button size="sm" variant="ghost" disabled={!editor.dirty} onClick={onSave} loading={editor.saving}><Save className="h-3.5 w-3.5" aria-hidden="true" />{t('synthese.enregistrer')}</Button>
    </div>}
  </>;
}
