import { expect, test } from './fixture.js';
import { authenticate } from './helpers.js';

test('lien d’évitement — visible au clavier, cible le contenu sans casser la route', async ({ page, baseURL }) => {
  await authenticate(page, baseURL);
  await page.goto('/#/');
  await page.locator('#main-content').waitFor();
  const skip = page.getByRole('link', { name: 'Aller au contenu principal' });
  const initialUrl = page.url();

  await page.keyboard.press('Tab');
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();

  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  expect(page.url()).toBe(initialUrl);
});
