import { test, expect } from './fixture.js';
import { authenticate } from './helpers.js';
import { expectNoOverflow } from './geometry.js';

test('formulaire mobile — collage lisible et actions secondaires repliées', async ({ page, baseURL }) => {
  await authenticate(page, baseURL); await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/#/anomalies/nouvelle');
  const paste = page.locator('section').filter({ has: page.locator('#smart-paste') });
  await expect(paste.getByRole('button', { name: 'Coller depuis le presse-papiers' })).toBeVisible();
  const paragraph = paste.locator('p').first();
  const paragraphBox = await paragraph.boundingBox();
  expect(paragraphBox, 'description visible').not.toBeNull();
  expect(paragraphBox.width, 'texte de collage non comprimé').toBeGreaterThan(220);
  const buttonBox = await paste.getByRole('button', { name: 'Coller depuis le presse-papiers' }).boundingBox();
  expect(buttonBox.y, 'bouton sous le texte').toBeGreaterThan(paragraphBox.y);
  await expectNoOverflow(page);
});

test('formulaire mobile — barre d’actions compacte et menu accessible', async ({ page, baseURL }) => {
  await authenticate(page, baseURL); await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/#/anomalies/nouvelle');
  const bar = page.locator('[data-action-bar]'); const more = bar.getByRole('button', { name: "Plus d'actions" });
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await expect(bar.getByRole('button', { name: 'Enregistrer et nouveau', exact: true })).toBeHidden();
  const collapsed = await bar.evaluate((element) => element.getBoundingClientRect().height);
  expect(collapsed, 'barre repliée compacte').toBeLessThan(120);
  await more.click();
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  await expect(bar.getByRole('button', { name: 'Enregistrer et nouveau', exact: true })).toBeVisible();
  await expect(bar.getByRole('button', { name: 'Enregistrer et dupliquer', exact: true })).toBeVisible();
  await expect(bar.getByRole('button', { name: 'Annuler', exact: true })).toBeVisible();
  await more.click();
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await expect(bar.getByRole('button', { name: 'Enregistrer et nouveau', exact: true })).toBeHidden();
  await expectNoOverflow(page);
});
