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
