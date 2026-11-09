import { expect, test } from '@playwright/test';
import { collectErrors, expectNotBlank, loginAs, pasteText } from './helpers';

test('C3 — collage dans le champ Lien fournit un retour visible', async ({ page, baseURL }) => {
  const session = await loginAs(baseURL, 'admin');
  await page.context().addCookies([{ name: 'sid', value: session.token, url: baseURL }]);
  const errors = collectErrors(page);
  await page.goto(`${baseURL}/#/anomalies/nouvelle`);
  await expectNotBlank(page);
  await pasteText(page, '#lien_url', 'https://www.facebook.com/agentwilaya/videos/7234567890123456789');
  const feedback = page.getByText(/Plateforme détectée|Lien reconnu|Lien doit commencer|non reconnue|Lien de la publication/i).first();
  await expect(feedback).toBeVisible({ timeout: 6000 });
  expect(errors.snapshot().pageError).toEqual([]);
});
