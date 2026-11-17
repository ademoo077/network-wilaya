import { ChevronDown, ChevronUp, Clock, Edit, EyeOff, FileText, Plus, Printer, RotateCcw, RotateCw, Save, Trash2 } from 'lucide-react';
import { Alert, Button, Card, EmptyState, Skeleton } from '../../components/ui/index.js';
import { Chip } from '../../components/ui/Chip.jsx';
import WidgetCard from './WidgetCard.jsx';

// Grille réelle à 12 colonnes (SPEC V8 § 2) : simple = 4, double = 8, pleine = 12.
// En dessous de 768 px chaque bloc occupe toute la ligne pour rester lisible.
const WIDTH_CLASSES = {
  simple: 'col-span-12 md:col-span-4',
  double: 'col-span-12 md:col-span-8',
  pleine: 'col-span-12',
};

export default function SyntheseCanvas({
  modele, mode, sourceId, alreadyFrozen, editor, blocs, activeBlocs, activeResults, maxWidgets,
  t, lang, dir, typeLabel, onAdd, onSave, onReset, onEdit, onOpenEditions, onPrint, onPreview, onVoirFiches, embedded = false,
}) {
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

    <div className="grid grid-cols-12 gap-4" data-synthese-grid>
      {editor.evaluating && <div className="col-span-full"><Card className="p-8"><Skeleton className="h-24 w-full" /></Card></div>}
      {activeBlocs.map((bloc) => {
        const index = blocs.findIndex((item) => item.id === bloc.id);
        const width = WIDTH_CLASSES[bloc.options?.largeur] || '';
        const printVisibility = bloc.options?.masquer_impression ? 'print:hidden' : '';
        return <section key={bloc.id} data-largeur={bloc.options?.largeur || 'simple'} data-bloc-type={bloc.type} className={`group relative min-w-0 break-inside-avoid ${width} ${printVisibility}`}>
          {mode === 'personnaliser' && <div className="absolute -top-3 end-2 z-10 flex items-center gap-1 rounded-md border border-border bg-surface p-1 opacity-0 shadow-1 transition group-hover:opacity-100 group-focus-within:opacity-100 no-print">
            <Button size="sm" variant="ghost" onClick={() => editor.moveBloc(bloc.id, -1)} disabled={index <= 0} title={t('synthese.monter')} aria-label={t('synthese.monter')}><ChevronUp className="h-3.5 w-3.5" aria-hidden="true" /></Button>
            <Button size="sm" variant="ghost" onClick={() => editor.moveBloc(bloc.id, 1)} disabled={index >= blocs.length - 1} title={t('synthese.descendre')} aria-label={t('synthese.descendre')}><ChevronDown className="h-3.5 w-3.5" aria-hidden="true" /></Button>
            <Button size="sm" variant="ghost" onClick={() => editor.removeBloc(bloc.id)} title={t('synthese.supprimer')} aria-label={t('synthese.supprimer')}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" /></Button>
            <Button size="sm" variant="ghost" onClick={() => onEdit(bloc)} title={t('synthese.editer')} aria-label={t('synthese.editer')}><Edit className="h-3.5 w-3.5" aria-hidden="true" /></Button>
          </div>}
          <WidgetCard bloc={bloc} result={activeResults[bloc.id]} t={t} lang={lang} dir={dir} onVoirFiches={onVoirFiches} />
          {mode === 'personnaliser' && <div className="mt-2 text-center text-xs text-muted">{typeLabel(bloc.type, lang)} · {bloc.requete ? t('synthese.donneesVives') : t('synthese.miseEnPage')}</div>}
        </section>;
      })}
      {blocs.length === 0 && <div className="col-span-full"><EmptyState title={t('synthese.aucunWidget')} description={t('synthese.aucunWidgetHelp')} action={
        <Button size="sm" onClick={onAdd}><Plus className="h-4 w-4" aria-hidden="true" />{t('synthese.ajouterWidget')}</Button>
      } /></div>}
    </div>

    {mode === 'personnaliser' && <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted no-print">
      <div className="flex flex-wrap items-center gap-3"><span>{t('synthese.nbWidgets', { count: blocs.length, max: maxWidgets })}</span>{editor.lastSavedAt && !editor.dirty && <span role="status" className="text-muted">{t('synthese.enregistree')}</span>}</div>
      <Button size="sm" variant="ghost" disabled={!editor.dirty} onClick={onSave} loading={editor.saving}><Save className="h-3.5 w-3.5" aria-hidden="true" />{t('synthese.enregistrer')}</Button>
    </div>}
  </>;
}
