import { expect, test } from './fixture.js';
import { authenticate } from './helpers.js';
import { expectNoOverflow } from './geometry.js';

test.beforeEach(async ({ page, baseURL }) => {
  await authenticate(page, baseURL);
  await page.goto('/#/anomalies/nouvelle');
  await expect(page.locator('#smart-paste')).toBeVisible();
});

test('Options avancées — affordance, focus clavier et état conservé', async ({ page }) => {
  const details = page.locator('details[data-advanced]');
  const summary = details.locator('summary');

  await expect(details).toHaveJSProperty('open', false);
  await expect(summary).toHaveAccessibleName('Options avancées');
  await expect(summary.locator('svg')).toHaveAttribute('aria-hidden', 'true');

  await summary.click();
  await expect(details).toHaveJSProperty('open', true);

  await page.locator('#intervenant_autre').fill('Prestataire temporaire');
  await expect(page.locator('#intervenant_autre')).toHaveValue('Prestataire temporaire');
  await page.locator('#intervenant_autre').fill('');
  await expect(details, 'le panneau reste ouvert après vidage du champ').toHaveJSProperty('open', true);

  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(details).toHaveJSProperty('open', false);
  await page.keyboard.press('Enter');
  await expect(details).toHaveJSProperty('open', true);

  await page.setViewportSize({ width: 390, height: 900 });
  await expectNoOverflow(page);
  await expect(summary).toBeInViewport();
});
