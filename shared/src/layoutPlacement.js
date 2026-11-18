/** Placement déterministe des rectangles de la grille du Studio. */

export function widgetsSeChevauchent(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w
    && a.y < b.y + b.h && b.y < a.y + a.h;
}

function ordre(a, b) {
  return a.y - b.y || a.x - b.x || a._ordre - b._ordre;
}

function pousserSousLesObstacles(widget, places) {
  let collision = true;
  while (collision) {
    const obstacles = places.filter((autre) => widgetsSeChevauchent(widget, autre));
    if (!obstacles.length) break;
    widget.y = Math.max(...obstacles.map((autre) => autre.y + autre.h));
    collision = true;
  }
  return widget;
}

function compacterUn(widget, widgets) {
  const depart = widget.y;
  for (let y = 0; y < depart; y += 1) {
    const candidate = { ...widget, y };
    if (widgets.every((autre) => autre === widget || !widgetsSeChevauchent(candidate, autre))) {
      widget.y = y;
      return;
    }
  }
}

/**
 * Place d'abord le widget prioritaire (celui manipulé), puis pousse tous les
 * rectangles qui le rencontrent. Le second passage remonte chaque voisin au
 * premier emplacement libre afin de fermer les trous sans déplacer la cible.
 */
export function resoudrePlacement(rawWidgets, { compactage = true, prioritaire = null } = {}) {
  const widgets = rawWidgets.map((widget, index) => ({ ...widget, _ordre: index }));
  const cible = prioritaire ? widgets.find((widget) => widget.id === prioritaire) : null;
  const aPlacer = widgets.filter((widget) => widget !== cible).sort(ordre);
  const places = cible ? [cible] : [];
  for (const widget of aPlacer) {
    pousserSousLesObstacles(widget, places);
    places.push(widget);
  }
  if (compactage) {
    for (const widget of [...places].sort(ordre)) {
      if (widget !== cible) compacterUn(widget, places);
    }
  }
  return places.sort(ordre).map(({ _ordre, ...widget }) => widget);
}

export function layoutSansChevauchement(layout) {
  const widgets = layout?.widgets || [];
  return widgets.every((widget, index) => (
    widgets.slice(index + 1).every((autre) => !widgetsSeChevauchent(widget, autre))
  ));
}
