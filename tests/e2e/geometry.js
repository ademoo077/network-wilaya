import { expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

export async function expectNoOverflow(page) {
  expect(await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth })))
    .toEqual(expect.objectContaining({ scroll: expect.any(Number) }));
  const excess = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(excess, 'Défilement horizontal de page').toBeLessThanOrEqual(0);
}
export async function expectCompactCards(page) {
  const stretched = await page.locator('[data-card], section.rounded-lg').evaluateAll((cards) => cards.flatMap((card) => {
    const rect = card.getBoundingClientRect();
    const children = [...card.children].filter((child) => child.getBoundingClientRect().height > 0);
    const bottom = Math.max(rect.top, ...children.map((child) => child.getBoundingClientRect().bottom));
    return rect.bottom - bottom > 120 ? [{ text: card.textContent.slice(0, 80), gap: rect.bottom - bottom }] : [];
  }));
  expect(stretched, 'Cartes étirées').toEqual([]);
}
export async function expectAccessible(page) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(result.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) }))).toEqual([]);
}
export async function expectActionBarClear(page) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const collisions = await page.evaluate(() => {
    const bar = document.querySelector('[data-action-bar]');
    if (!bar) return ['Barre absente'];
    const a = bar.getBoundingClientRect();
    return [...document.querySelectorAll('main input, main select, main textarea, main button')].filter((el) => {
      if (bar.contains(el)) return false;
      const b = el.getBoundingClientRect();
      return b.width > 0 && b.height > 0 && b.bottom > 0 && b.top < innerHeight && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    }).map((el) => el.id || el.textContent);
  });
  expect(collisions).toEqual([]);
}

export async function expectNoWidgetIntersections(page) {
  const collisions = await page.locator('[data-widget-id]').evaluateAll((items) => {
    const visible = items.filter((item) => item.getClientRects().length > 0);
    return visible.flatMap((item, index) => {
      const a = item.getBoundingClientRect();
      return visible.slice(index + 1).flatMap((other) => {
        const b = other.getBoundingClientRect();
        const intersects = a.left < b.right - 1 && b.left < a.right - 1
          && a.top < b.bottom - 1 && b.top < a.bottom - 1;
        return intersects ? [[item.dataset.widgetId, other.dataset.widgetId]] : [];
      });
    });
  });
  expect(collisions, 'Widgets qui se recouvrent').toEqual([]);
}

export async function expectNoWidgetClipping(page) {
  const clipped = await page.locator('[data-widget-id][data-height-mode="auto"]').evaluateAll((widgets) => widgets.flatMap((widget) => {
    const content = widget.querySelector('[data-widget-content]');
    if (!content) return [];
    const outer = widget.getBoundingClientRect();
    const inner = content.getBoundingClientRect();
    const vertical = inner.bottom > outer.bottom + 1 || content.scrollHeight > widget.clientHeight + 1;
    const horizontal = inner.left < outer.left - 1 || inner.right > outer.right + 1;
    return vertical || horizontal ? [{ id: widget.dataset.widgetId, outer: outer.height, content: content.scrollHeight, width: [outer.width, inner.width] }] : [];
  }));
  expect(clipped, 'Contenu de widget rogné').toEqual([]);
}

export async function expectCompactWidgetActions(page) {
  const failures = await page.locator('[data-widget-actions]').evaluateAll((bars) => bars.flatMap((bar) => {
    const buttons = [...bar.querySelectorAll(':scope > button')].filter((button) => button.getClientRects().length > 0);
    const card = bar.closest('[data-widget-card]');
    const content = card?.querySelector('[data-chart], .kpi-grid, [data-widget-table]');
    const a = bar.getBoundingClientRect();
    const b = content?.getBoundingClientRect();
    const overlap = b && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
    const textButton = buttons.find((button) => button.textContent.trim());
    return overlap || textButton ? [{ overlap: Boolean(overlap), text: textButton?.textContent || '' }] : [];
  }));
  expect(failures, 'Barre d’actions non compacte ou superposée').toEqual([]);
}
