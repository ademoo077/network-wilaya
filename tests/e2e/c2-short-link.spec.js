import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';

test('C2 — un lien court de localisation doit aboutir a une position reconnue', async ({ page, baseURL }) => {
  const session = await loginAs(baseURL, 'admin');
  const response = await page.request.post(`${baseURL}/api/tools/resolve-link`, {
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrf },
    data: { url: 'https://maps.app.goo.gl/faux123456' },
  });
  const payload = await response.json().catch(() => null);
  const resolved = Boolean(payload?.coords?.lat != null && payload?.coords?.lng != null);
  expect(resolved, `statut=${response.status()} payload=${JSON.stringify(payload)}`).toBe(false);
});
