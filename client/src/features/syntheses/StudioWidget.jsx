import { useRef } from 'react';
import { GRILLE_ECART, GRILLE_HAUTEUR } from '@anm/shared';
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
  const auto = bloc.options?.hauteur_mode !== 'fixe';
  const min = numeric(bloc.options?.hauteur_min, 1);
  const max = numeric(bloc.options?.hauteur_max, 40);
  const overflow = useWidgetHeight({ contentRef, id: widget.id, position, auto, min, max, onMeasure });
  const largeur = bloc.options?.largeur || (position.w >= 10 ? 'pleine' : position.w >= 7 ? 'double' : 'simple');
  const baseHauteur = position.h * (GRILLE_HAUTEUR + GRILLE_ECART) - GRILLE_ECART;
  const editor = mode === 'personnaliser';

  return <section
    data-widget-id={widget.id}
    data-x={position.x}
    data-y={position.y}
    data-w={position.w}
    data-h={position.h}
    data-height-mode={auto ? 'auto' : 'fixed'}
    data-overflow={overflow || undefined}
    data-largeur={largeur}
    data-bloc-type={bloc.type}
    data-drag={dragging || undefined}
    data-page-start={pageStart || undefined}
    role="group"
    tabIndex={0}
    aria-label={bloc.titre || bloc.type}
    className={`group relative min-w-0 break-inside-avoid rounded-lg ${editor ? 'outline outline-1 outline-transparent focus:outline-brand-500' : ''} ${dragging ? 'z-20 ring-2 ring-brand-500' : ''} ${bloc.options?.masquer_impression ? 'print:hidden' : ''}`}
    style={{ gridColumn: `${position.x + 1} / span ${position.w}`, gridRow: `${position.y + 1} / span ${position.h}`, breakBefore: pageStart ? 'page' : undefined }}
    onKeyDown={(event) => onKeyDown(event, widget)}
  >
    <div ref={contentRef} data-widget-content className="min-w-0" style={!auto ? { height: `${baseHauteur}px`, overflow: 'hidden' } : undefined}>
      <WidgetCard
        bloc={bloc} result={result} t={t} lang={lang} dir={dir} onVoirFiches={onVoirFiches} role={role}
        editorActions={editor ? {
          onMoveStart: (event) => onMovePointerDown(event, position, 'move'),
          onResizeStart: (event) => onMovePointerDown(event, position, 'resize'),
          onPointerMove,
          onPointerUp,
          onMoveUp: () => onMoveBloc(widget.id, -1),
          onMoveDown: () => onMoveBloc(widget.id, 1),
          onDuplicate: () => onDuplicate(widget.id),
          onEdit: () => onEdit(bloc),
          onTogglePrint: () => onTogglePrint(bloc),
          onRemove: () => onRemove(widget.id),
        } : null}
      />
    </div>
    {overflow && <div className="absolute bottom-1 start-1 z-30 rounded-md border border-warning bg-surface px-2 py-1 text-center text-xs font-bold text-warning no-print" role="status">{t('synthese.contenuMasque')}</div>}
  </section>;
}
