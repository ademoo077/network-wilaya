import { useRef } from 'react';
import WidgetCard from './WidgetCard.jsx';
import { useWidgetHeight } from './useWidgetHeight.js';

function numeric(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) ? number : fallback;
}

export default function StudioWidget({
  widget, position, bloc, result, mode, t, lang, dir, pageStart, dragging,
  onVoirFiches, onEdit, onRemove, onDuplicate, onTogglePrint, onMoveBloc,
  onKeyDown, onPointerMove, onPointerUp,
  onMovePointerDown, onMeasure, role = 'operateur',
}) {
  const contentRef = useRef(null);
  const min = numeric(bloc.options?.hauteur_min, 1);
  const max = numeric(bloc.options?.hauteur_max, 40);
  const overflow = useWidgetHeight({ contentRef, id: widget.id, position, auto: true, min, max, onMeasure });
  const largeur = bloc.options?.largeur || (position.w >= 10 ? 'pleine' : position.w >= 7 ? 'double' : 'simple');
  const editor = mode === 'personnaliser';
  const poignees = editor ? {
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
  } : {};

  return <section
    data-widget-id={widget.id}
    data-x={position.x}
    data-y={position.y}
    data-w={position.w}
    data-h={position.h}
    data-colonnes={position.w}
    data-height-mode="auto"
    data-overflow={overflow || undefined}
    data-largeur={largeur}
    data-bloc-type={bloc.type}
    data-drag={dragging || undefined}
    data-page-start={pageStart || undefined}
    role="group"
    tabIndex={0}
    aria-label={bloc.titre || bloc.type}
    className={`group relative min-w-[240px] max-w-full break-inside-avoid rounded-lg ${editor ? 'outline outline-1 outline-transparent focus:outline-brand-500' : ''} ${dragging ? 'z-20 ring-2 ring-brand-500' : ''} ${bloc.options?.masquer_impression ? 'print:hidden' : ''}`}
    style={{ gridColumn: `${position.x + 1} / span ${position.w}`, gridRow: `${position.y + 1} / span ${position.h}`, breakBefore: pageStart ? 'page' : undefined }}
    onKeyDown={(event) => onKeyDown(event, widget)}
  >
    <div ref={contentRef} data-widget-content className="min-w-0">
      <WidgetCard
        bloc={bloc} result={result} t={t} lang={lang} dir={dir} onVoirFiches={onVoirFiches} role={role}
        editorActions={editor ? {
          onMoveUp: () => onMoveBloc(widget.id, -1),
          onMoveDown: () => onMoveBloc(widget.id, 1),
          onDuplicate: () => onDuplicate(widget.id),
          onEdit: () => onEdit(bloc),
          onTogglePrint: () => onTogglePrint(bloc),
          onRemove: () => onRemove(widget.id),
        } : null}
      />
    </div>
    {editor && <>
      <div
        data-widget-handle="deplacement"
        role="button"
        tabIndex={-1}
        aria-label={t('synthese.deplacer')}
        title={t('synthese.deplacer')}
        className="absolute inset-x-3 top-0 z-20 h-3 cursor-grab rounded-t-lg hover:bg-brand-100 active:cursor-grabbing"
        onPointerDown={(event) => onMovePointerDown(event, position, 'move')}
        {...poignees}
      />
      <div
        data-widget-handle="largeur"
        role="button"
        tabIndex={-1}
        aria-label={t('synthese.redimensionner')}
        title={t('synthese.redimensionner')}
        className="absolute inset-y-3 end-0 z-20 w-3 cursor-ew-resize rounded-e-lg hover:bg-brand-100"
        onPointerDown={(event) => onMovePointerDown(event, position, 'resize')}
        {...poignees}
      />
    </>}
  </section>;
}
