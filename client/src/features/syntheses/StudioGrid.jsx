import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ajusterHauteursWidgets, decouperEnPages, GRILLE_COLONNES, GRILLE_ECART,
  GRILLE_HAUTEUR,
} from '@anm/shared';
import StudioWidget from './StudioWidget.jsx';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export default function StudioGrid({
  layout, blocs, results, mode, t, lang, dir, zoom = 100,
  onVoirFiches, onEdit, onRemove, onDuplicate, onTogglePrint, onMove, onResize, onMoveBloc,
  onAutoResize, onUndo, onRedo,
}) {
  const gridRef = useRef(null);
  const pendingMeasures = useRef(new Map());
  const measureFrame = useRef(null);
  const autoResizeRef = useRef(onAutoResize);
  const [drag, setDrag] = useState(null);
  const [preview, setPreview] = useState(null);
  const [measuredHeights, setMeasuredHeights] = useState({});
  autoResizeRef.current = onAutoResize;
  const byId = useMemo(() => new Map(blocs.map((bloc) => [bloc.id, bloc])), [blocs]);
  const displayLayout = useMemo(() => ajusterHauteursWidgets(layout, Object.entries(measuredHeights)
    .filter(([id]) => byId.get(id)?.options?.hauteur_mode !== 'fixe')
    .map(([id, value]) => ({ id, ...value }))), [layout, measuredHeights, byId]);
  const positions = useMemo(() => new Map(displayLayout.widgets.map((widget) => [widget.id, widget])), [displayLayout]);
  const pageStarts = useMemo(() => {
    const { pages } = decouperEnPages(displayLayout);
    const starts = new Map();
    for (const page of pages) {
      const first = page.widgets[0];
      if (first && page.index > 1) starts.set(first.id, page.index);
    }
    return starts;
  }, [displayLayout]);

  useEffect(() => () => {
    if (measureFrame.current) cancelAnimationFrame(measureFrame.current);
  }, []);

  const mesurer = useCallback((id, h, min, max) => {
    setMeasuredHeights((current) => {
      const previous = current[id];
      if (previous?.h === h && previous?.min === min && previous?.max === max) return current;
      return { ...current, [id]: { h, min, max } };
    });
    if (mode !== 'personnaliser' || !onAutoResize) return;
    pendingMeasures.current.set(id, { id, h, min, max });
    if (measureFrame.current) cancelAnimationFrame(measureFrame.current);
    measureFrame.current = requestAnimationFrame(() => {
      measureFrame.current = null;
      const changes = [...pendingMeasures.current.values()];
      pendingMeasures.current.clear();
      autoResizeRef.current?.(changes);
    });
  }, [mode, onAutoResize]);

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

  const widgets = [...displayLayout.widgets].sort((a, b) => a.y - b.y || a.x - b.x);
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
      return <StudioWidget
        key={widget.id}
        widget={widget} position={position} bloc={bloc} result={results[bloc.id]}
        mode={mode} t={t} lang={lang} dir={dir}
        pageStart={pageStarts.get(widget.id)} dragging={drag?.id === widget.id ? drag.kind : null}
        onVoirFiches={onVoirFiches} onEdit={onEdit} onRemove={onRemove}
        onDuplicate={onDuplicate} onTogglePrint={onTogglePrint} onMoveBloc={onMoveBloc} onKeyDown={clavier}
        onPointerMove={deplacer} onPointerUp={terminer}
        onMovePointerDown={(event, rect, kind = 'move') => demarrer(event, rect, kind)}
        onMeasure={mesurer}
      />;
    })}
    {preview && <div className="pointer-events-none absolute inset-y-0 w-px bg-brand-500" data-guide style={{ insetInlineStart: `${(preview.rect.x / GRILLE_COLONNES) * 100}%` }} />}
  </div>;
}
