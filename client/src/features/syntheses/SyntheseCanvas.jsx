import { useMemo, useState } from 'react';
import { convertirEnGrille } from '@anm/shared';
import { Clock, EyeOff, FileText, Plus, Printer, RotateCcw, RotateCw, Save, ShieldAlert, SlidersHorizontal } from 'lucide-react';
import { Alert, Button, Card, EmptyState, Skeleton } from '../../components/ui/index.js';
import { Chip } from '../../components/ui/Chip.jsx';
import StudioGrid from './StudioGrid.jsx';

export default function SyntheseCanvas({
  modele, mode, sourceId, alreadyFrozen, editor, blocs, activeBlocs, activeResults, maxWidgets,
  t, lang, dir, onAdd, onSave, onReset, onEdit, onOpenEditions, onPrint, onPreview, onVoirFiches,
  onPersonnaliser, onFiger, canPersonnaliser, peutFiger, editionBusy = false,
  displayWidth = 'large', onDisplayWidth, embedded = false, role = 'operateur',
  charte = null, onToggleCharte = null,
}) {
  const [zoom, setZoom] = useState(100);
  const [affichage, setAffichage] = useState(false);
  const layout = useMemo(() => convertirEnGrille(editor.currentDefinition), [editor.currentDefinition]);
  const largeur = displayWidth || 'large';
  const changerLargeur = (valeur) => {
    setAffichage(false);
    onDisplayWidth?.(valeur);
  };

  return <>
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface2 px-3 py-2 no-print" data-synthese-toolbar>
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted">
        {embedded && <h2 className="truncate text-sm font-bold text-ink">{modele.nom}</h2>}
        {modele.cle_systeme
          ? <Chip variant="secondaire" data-system-label>{t('synthese.systemeUnique')}</Chip>
          : <Chip variant="primaire">{t(`synthese.portee.${modele.portee}`)}</Chip>}
        {alreadyFrozen && <Chip variant="secondaire">{t('synthese.feuilleFeigeeLabel')}</Chip>}
        {editor.lastSavedAt && !editor.dirty && <span role="status" className="whitespace-nowrap text-xs text-muted">{t('synthese.enregistree')}</span>}
      </div>
      <div className="relative ms-auto flex flex-wrap items-center justify-end gap-1">
        <Button size="sm" variant="ghost" className="px-2 text-xs" aria-label={t('synthese.affichage')} aria-expanded={affichage} onClick={() => setAffichage((value) => !value)}>
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /><span>{t('synthese.affichage')}</span>
        </Button>
        {affichage && <div className="absolute end-0 top-full z-40 mt-1 w-64 rounded-md border border-border bg-surface p-3 shadow-1" role="menu" data-synthese-affichage>
          <label className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold text-ink">
            <span>{t('synthese.zoom')}</span>
            <select aria-label={t('synthese.zoom')} className="rounded-md border border-border bg-surface px-1.5 py-1 text-xs" value={zoom} onChange={(event) => setZoom(Number(event.target.value))}>
              {[50, 75, 100, 125, 150].map((value) => <option key={value} value={value}>{value} %</option>)}
            </select>
          </label>
          <label className="flex items-center justify-between gap-2 text-xs font-semibold text-ink">
            <span>{t('report.studio.displayWidth')}</span>
            <select aria-label={t('report.studio.displayWidth')} className="rounded-md border border-border bg-surface px-1.5 py-1 text-xs" value={largeur} onChange={(event) => changerLargeur(event.target.value)}>
              <option value="large">{t('report.studio.widthLarge')}</option>
              <option value="print">{t('report.studio.widthPrint')}</option>
              <option value="max">{t('report.studio.widthMax')}</option>
            </select>
          </label>
          {mode === 'personnaliser' && modele.portee !== 'systeme' && sourceId && <Button size="sm" variant="ghost" className="mt-2 w-full justify-start" onClick={() => { setAffichage(false); onReset?.(); }}>
            <EyeOff className="h-4 w-4" aria-hidden="true" />{t('synthese.revenirStandard')}
          </Button>}
        </div>}
        {canPersonnaliser && <Button size="sm" className="px-2 text-xs" aria-label={mode === 'personnaliser' ? (alreadyFrozen ? t('synthese.modeLecture') : t('synthese.quitterPersonnalisation')) : t('synthese.personnaliser')} disabled={editionBusy || editor.saving} onClick={onPersonnaliser}>
          <SlidersHorizontal className="h-4 w-4 lg:hidden" aria-hidden="true" /><span className="hidden lg:inline">{mode === 'personnaliser' ? (alreadyFrozen ? t('synthese.modeLecture') : t('synthese.quitterPersonnalisation')) : t('synthese.personnaliser')}</span>
        </Button>}
        {peutFiger && !alreadyFrozen && <Button size="sm" variant="secondary" className="px-2 text-xs" aria-label={t('synthese.figerFeuille')} disabled={editionBusy || editor.saving || editor.evaluating} onClick={onFiger}>
          <ShieldAlert className="h-4 w-4" aria-hidden="true" /><span className="hidden lg:inline">{t('synthese.figer')}</span>
        </Button>}
        {mode === 'personnaliser' && <>
          <Button size="sm" variant="ghost" onClick={onAdd} disabled={blocs.length >= maxWidgets}>
            <Plus className="h-4 w-4" aria-hidden="true" />{t('synthese.ajouterWidget')}
          </Button>
          <Button size="sm" variant="ghost" disabled={!editor.canUndo} onClick={editor.undo} aria-label={t('synthese.annuler')}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" /><span className="hidden xl:inline">{t('synthese.annuler')}</span>
          </Button>
          <Button size="sm" variant="ghost" disabled={!editor.canRedo} onClick={editor.redo} aria-label={t('synthese.refaire')}>
            <RotateCw className="h-4 w-4" aria-hidden="true" /><span className="hidden xl:inline">{t('synthese.refaire')}</span>
          </Button>
          <Button size="sm" onClick={onSave} loading={editor.saving} disabled={!editor.dirty}>
            <Save className="h-4 w-4" aria-hidden="true" />{t('synthese.enregistrer')}
          </Button>
          <Button size="sm" variant="secondary" onClick={onPreview} aria-label={t('synthese.previewA4')}>
            <FileText className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">{t('synthese.previewA4')}</span>
          </Button>
        </>}
        <Button size="sm" variant="secondary" onClick={onOpenEditions}>
          <Clock className="h-4 w-4" aria-hidden="true" />{t('synthese.editions')}
        </Button>
        {role === 'admin' && onToggleCharte && <Button size="sm" variant="ghost" onClick={onToggleCharte} aria-label={charte?.verrouille ? t('v19.charteUnlock') : t('v19.charteLock')}>
          <ShieldAlert className="h-4 w-4" aria-hidden="true" /><span className="hidden xl:inline">{charte?.verrouille ? t('v19.charteUnlock') : t('v19.charteLock')}</span>
        </Button>}
        <Button size="sm" variant="ghost" onClick={onPrint} aria-label={`${t('common.imprimer')} — ${t('synthese.print.launch')}`}>
          <Printer className="h-4 w-4" aria-hidden="true" />{t('common.imprimer')}
        </Button>
      </div>
    </div>

    {editor.evaluationError && <Alert variant="danger" title={t('synthese.erreurCalcul')} className="mb-4">
      {editor.evaluationError.message || t('common.error')}
    </Alert>}
    {editor.saveError && <Alert variant="danger" title={t('synthese.erreurEnregistrement')} className="mb-4 no-print">
      <p>{t('synthese.erreurEnregistrementAide')}</p>
      {editor.saveError.code && editor.saveError.code !== 'VALIDATION' && <p className="mt-1 text-xs"><bdi>{editor.saveError.message}</bdi></p>}
      <Button size="sm" variant="secondary" className="mt-3" onClick={onSave} loading={editor.saving}>{t('synthese.reessayerEnregistrement')}</Button>
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
        role={role}
        onVoirFiches={onVoirFiches}
        onEdit={onEdit}
        onRemove={editor.removeBloc}
        onDuplicate={editor.dupliquerBloc}
        onTogglePrint={(bloc) => editor.setBloc(bloc.id, { options: { ...bloc.options, masquer_impression: !bloc.options?.masquer_impression } })}
        onMove={editor.moveWidget}
        onResize={editor.resizeWidget}
        onAutoResize={editor.resizeWidgetsToContent}
        onMoveBloc={editor.moveBloc}
        onUndo={editor.undo}
        onRedo={editor.redo}
      />}
  </>;
}
