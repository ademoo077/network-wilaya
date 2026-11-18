import { useEffect, useRef, useState } from 'react';
import { GRILLE_ECART, GRILLE_HAUTEUR } from '@anm/shared';

function rowsForHeight(height) {
  return Math.max(1, Math.ceil((height + GRILLE_ECART) / (GRILLE_HAUTEUR + GRILLE_ECART)));
}

/** Mesure le contenu réel sans déduire sa hauteur de son type de widget. */
export function useWidgetHeight({ contentRef, id, position, auto, min = 1, max = 40, onMeasure }) {
  const callbackRef = useRef(onMeasure);
  const frameRef = useRef(null);
  const [overflow, setOverflow] = useState(false);
  callbackRef.current = onMeasure;

  useEffect(() => {
    const node = contentRef.current;
    if (!node) return undefined;
    const measure = () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        const needed = rowsForHeight(Math.max(node.scrollHeight, node.getBoundingClientRect().height));
        const bounded = Math.min(max, Math.max(min, needed));
        setOverflow(needed > position.h && (!auto || needed > max));
        if (auto && bounded !== position.h) callbackRef.current?.(id, bounded, min, max);
      });
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(node);
    window.addEventListener('resize', measure);
    measure();
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [contentRef, id, position.h, auto, min, max]);

  return overflow;
}
