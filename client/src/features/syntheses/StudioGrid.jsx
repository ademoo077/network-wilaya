import { useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Copy, Edit, GripVertical, Trash2 } from 'lucide-react';
import { decouperEnPages, GRILLE_COLONNES, GRILLE_ECART, GRILLE_HAUTEUR } from '@anm/shared';
import { Button } from '../../components/ui/index.js';
import WidgetCard from './WidgetCard.jsx';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export default function StudioGrid({
  layout, blocs, results, mode, t, lang, dir, zoom = 100,
  onVoirFiches, onEdit, onRemove, onDuplicate, onMove, onResize, onMoveBloc,
  onUndo, onRedo,
}) {
  const gridRef = useRef(null);
  const [drag, setDrag] = useState(null);
  const [preview, setPreview] = useState(null);
  const byId = useMemo(() => new Map(blocs.map((bloc) => [bloc.id, bloc])), [blocs]);
  const positions = useMemo(() => new Map(layout.widgets.map((widget) => [widget.id, widget])), [layout]);
  const pageStarts = useMemo(() => {
    const { pages } = decouperEnPages(layout);
    const starts = new Map();
    for (const page of pages) {
      const first = page.widgets[0];
      if (first && page.index > 1) starts.set(first.id, page.index);
    }
    return starts;
  }, [layout]);

  const lire = (id) => {
    if (preview?.id === id) return { ...positions.get(id), ...preview.rect };
    return positions.get(id) || { x: 0, y: 0, w: 6, h: 4 };
  };

  const demarrer = (event, widget, kind) => {
    if (mode !== 'personnaliser') return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const grid = gridRef.current?.getBoundingClientRect();
    const colonne = ((grid?.width || 0) - (GRILLE_COLONNES - 1) * GRILLE_ECART) / GRILLE_COLONNES;
    setDrag({
      id: widget.id, kind, startX: event.clientX, startY: event.clientY,
      rect: { x: widget.x, y: widget.y, w: widget.w, h: widget.h }, colonne,
    });
    setPreview({ id: widget.id, rect: { x: widget.x, y: widget.y, w: widget.w, h: widget.h } });
  };

  const deplacer = (event) => {
    if (!drag) return;
    const dx = Math.round((event.clientX - drag.startX) / Math.max(1, drag.colonne));
    const dy = Math.round((event.clientY - drag.startY) / (GRILLE_HAUTEUR + GRILLE_ECART));
    if (drag.kind === 'resize') {
      setPreview({
        id: drag.id,
        rect: {
          ...drag.rect,
          w: clamp(drag.rect.w + dx, 1, GRILLE_COLONNES - drag.rect.x),
          h: clamp(drag.rect.h + dy, 1, 40),
        },
      });
    } else {
      setPreview({
        id: drag.id,
        rect: {
          ...drag.rect,
          x: clamp(drag.rect.x + dx, 0, GRILLE_COLONNES - drag.rect.w),
          y: Math.max(0, drag.rect.y + dy),
        },
      });
    }
  };

  const terminer = (event) => {
    if (!drag) return;
    const dx = Math.round((event.clientX - drag.startX) / Math.max(1, drag.colonne));
    const dy = Math.round((event.clientY - drag.startY) / (GRILLE_HAUTEUR + GRILLE_ECART));
    if (drag.kind === 'resize') {
      if (dx || dy) onResize(drag.id, dx, dy);
    } else if (dx || dy) {
      onMove(drag.id, dx, dy);
    }
    setDrag(null);
    setPreview(null);
  };

  const coinRedimensionnement = (event, widget) => {
    if (mode !== 'personnaliser') return;
    const rect = event.currentTarget.getBoundingClientRect();
    const coin = 24;
    if (event.clientX < rect.right - coin || event.clientY < rect.bottom - coin) return;
    const interactif = event.target.closest?.('button, a, input, select, textarea');
    if (interactif && interactif.getAttribute('aria-label') !== t('synthese.redimensionner')) return;
    demarrer(event, widget, 'resize');
  };

  const clavier = (event, widget) => {
    if (mode !== 'personnaliser') return;
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === 'z') {
      event.preventDefault();
      if (event.shiftKey) onRedo?.(); else onUndo?.();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && key === 'd') {
      event.preventDefault();
      onDuplicate(widget.id);
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      onRemove(widget.id);
      return;
    }
    const moves = {
      ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
    };
    if (!moves[event.key]) return;
    event.preventDefault();
    const [dx, dy] = moves[event.key];
    if (event.shiftKey) onResize(widget.id, dx, dy);
    else onMove(widget.id, dx, dy);
  };

  const widgets = [...layout.widgets].sort((a, b) => a.y - b.y || a.x - b.x);
  return <div
    ref={gridRef}
    className="synthese-free-grid relative grid grid-cols-12 gap-1"
    data-synthese-grid
    data-zoom={zoom}
    style={{ gridAutoRows: `${GRILLE_HAUTEUR}px`, zoom: zoom / 100 }}
    onKeyDown={(event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        onRedo?.();
      }
    }}
  >
    {widgets.map((widget) => {
      const bloc = byId.get(widget.id);
      if (!bloc) return null;
      const position = lire(widget.id);
      const largeur = bloc.options?.largeur || (position.w >= 10 ? 'pleine' : position.w >= 7 ? 'double' : 'simple');
      return <section
        key={widget.id}
        data-widget-id={widget.id}
        data-x={position.x}
        data-y={position.y}
        data-w={position.w}
        data-h={position.h}
        data-largeur={largeur}
        data-bloc-type={bloc.type}
        data-drag={drag?.id === widget.id ? drag.kind : undefined}
        data-preview-w={preview?.id === widget.id ? preview.rect.w : undefined}
        data-page-start={pageStarts.has(widget.id) ? pageStarts.get(widget.id) : undefined}
        role="group"
        tabIndex={0}
        aria-label={bloc.titre || bloc.type}
        className={`group relative min-w-0 break-inside-avoid rounded-lg ${mode === 'personnaliser' ? 'outline outline-1 outline-transparent focus:outline-brand-500' : ''} ${drag?.id === widget.id ? 'z-20 ring-2 ring-brand-500' : ''}`}
        style={{ gridColumn: `${position.x + 1} / span ${position.w}`, gridRow: `${position.y + 1} / span ${position.h}`, breakBefore: pageStarts.has(widget.id) ? 'page' : undefined }}
        onKeyDown={(event) => clavier(event, widget)}
        onPointerDown={mode === 'personnaliser' ? (event) => coinRedimensionnement(event, position) : undefined}
        onPointerMove={mode === 'personnaliser' ? deplacer : undefined}
        onPointerUp={mode === 'personnaliser' ? terminer : undefined}
        onPointerCancel={mode === 'personnaliser' ? terminer : undefined}
      >
        {mode === 'personnaliser' && <>
          <button
            type="button"
            className="absolute start-1 top-1 z-20 flex h-6 w-6 cursor-move items-center justify-center rounded-md border border-border bg-surface text-muted shadow-1 no-print"
            aria-label={t('synthese.deplacer')}
            title={t('synthese.deplacer')}
            onPointerDown={(event) => demarrer(event, position, 'move')}
            onPointerMove={deplacer}
            onPointerUp={terminer}
            onPointerCancel={terminer}
          ><GripVertical className="h-3.5 w-3.5" aria-hidden="true" /></button>
          <div className="pointer-events-none absolute -top-3 end-2 z-20 flex items-center gap-1 rounded-md border border-border bg-surface p-1 opacity-0 shadow-1 transition group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 no-print">
            <Button size="sm" variant="ghost" onClick={() => onMoveBloc(widget.id, -1)} title={t('synthese.monter')} aria-label={t('synthese.monter')}><ChevronUp className="h-3.5 w-3.5" aria-hidden="true" /></Button>
            <Button size="sm" variant="ghost" onClick={() => onMoveBloc(widget.id, 1)} title={t('synthese.descendre')} aria-label={t('synthese.descendre')}><ChevronDown className="h-3.5 w-3.5" aria-hidden="true" /></Button>
            <Button size="sm" variant="ghost" onClick={() => onDuplicate(widget.id)} title={t('synthese.dupliquer')} aria-label={t('synthese.dupliquer')}><Copy className="h-3.5 w-3.5" aria-hidden="true" /></Button>
            <Button size="sm" variant="ghost" onClick={() => onEdit(bloc)} title={t('synthese.editer')} aria-label={t('synthese.editer')}><Edit className="h-3.5 w-3.5" aria-hidden="true" /></Button>
            <Button size="sm" variant="ghost" onClick={() => onRemove(widget.id)} title={t('synthese.supprimer')} aria-label={t('synthese.supprimer')}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" /></Button>
          </div>
        </>}
        <div className="min-w-0">
          <WidgetCard bloc={bloc} result={results[bloc.id]} t={t} lang={lang} dir={dir} onVoirFiches={onVoirFiches} />
        </div>
        {mode === 'personnaliser' && <button
          type="button"
          className="absolute bottom-0 end-0 z-30 h-5 w-5 cursor-nwse-resize rounded-ss-md border-s border-t border-border bg-surface no-print"
          aria-label={t('synthese.redimensionner')}
          title={t('synthese.redimensionner')}
        />}
        {mode === 'personnaliser' && <div className="pointer-events-none mt-2 text-center text-xs text-muted no-print">{bloc.type} · {position.w} × {position.h}</div>}
      </section>;
    })}
    {preview && <div className="pointer-events-none absolute inset-y-0 w-px bg-brand-500" data-guide style={{ insetInlineStart: `${(preview.rect.x / GRILLE_COLONNES) * 100}%` }} />}
  </div>;
}
