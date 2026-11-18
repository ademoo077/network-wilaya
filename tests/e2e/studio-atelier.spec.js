import { test, expect } from './fixture.js';
import { authenticate, collectErrors } from './helpers.js';
import { expectAccessible, expectNoOverflow } from './geometry.js';

async function ouvrirCopie(page) {
  await page.goto('/#/syntheses');
  const card = page.locator('[data-testid^="modele-"]').filter({
    has: page.getByRole('heading', { name: 'Synthèse hebdomadaire standard' }),
  });
  await card.getByRole('button', { name: /Personnaliser/ }).click();
  await expect(page.getByRole('heading', { name: 'Ma synthèse hebdomadaire' })).toBeVisible({ timeout: 20_000 });
  await page.locator('[data-widget-id="anneau-statuts"]').waitFor({ state: 'visible', timeout: 30_000 });
}

test('130 — grille libre : souris, clavier, annulation, RTL et rechargement', async ({ page, baseURL }) => {
  await authenticate(page, baseURL, 'operateur');
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await ouvrirCopie(page);

  const widget = page.locator('[data-widget-id="anneau-statuts"]');
  const grid = page.locator('[data-synthese-grid]');
  await expect(grid).toHaveAttribute('data-zoom', '100');
  const initial = await widget.evaluate((element) => ({
    x: Number(element.dataset.x), y: Number(element.dataset.y), w: Number(element.dataset.w), h: Number(element.dataset.h),
  }));
  await widget.focus();
  await page.keyboard.press('ArrowRight');
  await expect(widget).toHaveAttribute('data-x', String(initial.x + 1));
  await page.keyboard.press('Shift+ArrowDown');
  await expect(widget).toHaveAttribute('data-h', String(initial.h + 1));
  await page.keyboard.press('Control+z');
  await expect(widget).toHaveAttribute('data-h', String(initial.h));
  await page.keyboard.press('Control+y');
  await expect(widget).toHaveAttribute('data-h', String(initial.h + 1));

  const cell = await grid.evaluate((element) => {
    const style = getComputedStyle(element);
    const gap = parseFloat(style.columnGap || '4');
    return (element.getBoundingClientRect().width - gap * 11) / 12;
  });
  const handle = widget.getByRole('button', { name: 'Déplacer le widget' });
  const start = await handle.boundingBox();
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2 + cell * 2, start.y + start.height / 2);
  await page.mouse.up();
  await expect(widget).toHaveAttribute('data-x', String(initial.x + 3));

  const resize = widget.getByRole('button', { name: 'Redimensionner le widget' });
  await resize.scrollIntoViewIfNeeded();
  const resizeStart = await resize.boundingBox();
  await page.mouse.move(resizeStart.x + 2, resizeStart.y + 2);
  await page.mouse.down();
  await page.mouse.move(resizeStart.x + 2 + cell, resizeStart.y + 2 + 44);
  await page.mouse.up();
  const apres = await widget.evaluate((element) => ({
    x: Number(element.dataset.x), y: Number(element.dataset.y), w: Number(element.dataset.w), h: Number(element.dataset.h),
  }));
  expect(apres.w).toBeGreaterThan(initial.w);
  expect(apres.h).toBeGreaterThanOrEqual(initial.h + 1);

  await page.getByRole('button', { name: /Enregistrer/ }).first().click();
  await expect(page.getByText(/enregistrée/i)).toBeVisible({ timeout: 15_000 });
  await page.reload();
  await page.locator('[data-widget-id="anneau-statuts"]').waitFor({ state: 'visible', timeout: 30_000 });
  await expect(page.locator('[data-widget-id="anneau-statuts"]')).toHaveAttribute('data-x', String(apres.x));
  await expect(page.locator('[data-widget-id="anneau-statuts"]')).toHaveAttribute('data-y', String(apres.y));
  await expect(page.locator('[data-widget-id="anneau-statuts"]')).toHaveAttribute('data-w', String(apres.w));

  const overlaps = await page.locator('[data-widget-id]').evaluateAll((items) => {
    const boxes = items.map((item) => item.getBoundingClientRect());
    return boxes.some((a, i) => boxes.some((b, j) => i < j
      && a.left < b.right - 1 && b.left < a.right - 1
      && a.top < b.bottom - 1 && b.top < a.bottom - 1));
  });
  expect(overlaps, 'Deux widgets se chevauchent').toBe(false);

  await page.addInitScript(() => localStorage.setItem('anm-language', 'ar'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('[data-synthese-grid]')).toHaveCSS('direction', 'rtl');
  await expectNoOverflow(page);
  await expectAccessible(page);
  expect(errors.snapshot().pageError).toEqual([]);
  expect(errors.snapshot().consoleError).toEqual([]);
});

test('139 — pagination d’impression : grille visible, widgets non coupés, sauts de page', async ({ page, baseURL }) => {
  await authenticate(page, baseURL, 'operateur');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#/rapport?semaine=2026-11-15');
  await expect(page.locator('[data-kpi-value]').first()).toBeVisible({ timeout: 20_000 });
  await page.emulateMedia({ media: 'print' });
  const grid = page.locator('[data-synthese-grid]');
  await expect(grid).toBeVisible();
  expect(await grid.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(0);
  const widgets = await page.locator('[data-widget-id]').evaluateAll((items) => items.map((item) => ({
    id: item.dataset.widgetId,
    breakInside: getComputedStyle(item).breakInside,
    breakBefore: getComputedStyle(item).breakBefore,
    pageStart: item.dataset.pageStart || null,
    width: item.getBoundingClientRect().width,
  })));
  expect(widgets.length).toBeGreaterThan(0);
  expect(widgets.every((widget) => widget.breakInside === 'avoid'), 'Un widget peut être coupé').toBe(true);
  expect(widgets.every((widget) => widget.width > 0)).toBe(true);
  const pageStarts = widgets.filter((widget) => widget.pageStart);
  expect(pageStarts.every((widget) => widget.breakBefore === 'page'), 'Un saut de page manque').toBe(true);
  await page.emulateMedia({ media: 'screen' });
});

test('140 — migration sections → grille : mêmes blocs et largeurs pour les modèles système', async ({ page, baseURL }) => {
  await authenticate(page, baseURL, 'operateur');
  await page.goto('/#/rapport?semaine=2026-11-15');
  await expect(page.locator('[data-kpi-value]').first()).toBeVisible({ timeout: 20_000 });
  const modeles = await page.evaluate(async () => {
    const response = await fetch('/api/syntheses/modeles');
    return (await response.json()).items;
  });
  const systemes = modeles.filter((modele) => modele.cle_systeme);
  expect(systemes.length).toBeGreaterThanOrEqual(8);
  for (const modele of systemes) {
    const blocs = modele.definition.sections.flatMap((section) => section.colonnes.flat());
    expect(modele.definition.layout?.widgets?.length, modele.nom).toBe(blocs.length);
    expect(new Set(modele.definition.layout.widgets.map((widget) => widget.id))).toEqual(new Set(blocs.map((bloc) => bloc.id)));
  }
  const hebdo = systemes.find((modele) => modele.cle_systeme === 'hebdomadaire');
  expect(hebdo.definition.layout.widgets.map((widget) => widget.w)).toEqual([12, 4, 8]);
  const widths = await page.locator('[data-synthese-grid] > section').evaluateAll((items) => items.map((item) => item.getBoundingClientRect().width));
  const gridWidth = await page.locator('[data-synthese-grid]').evaluate((element) => element.getBoundingClientRect().width);
  expect(widths[0]).toBeGreaterThan(gridWidth * 0.95);
  expect(widths[1]).toBeGreaterThan((gridWidth / 3) * 0.9);
  expect(widths[2]).toBeGreaterThan((gridWidth * 2) / 3 * 0.9);
});
