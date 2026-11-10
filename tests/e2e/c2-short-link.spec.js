import { expect, test } from './fixture.js';
import { loginAs } from './helpers';

test('C2 — un lien court de localisation doit aboutir a une position reconnue', async ({ page, baseURL }) => {
  const session = await loginAs(baseURL, 'admin');
  await page.context().addCookies([{ name: 'sid', value: session.token, url: baseURL }]);
  const response = await page.request.post(`${baseURL}/api/tools/resolve-link`, {
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrf },
    data: { url: 'https://maps.app.goo.gl/faux123456' },
  });
  const payload = await response.json().catch(() => null);
  const resolved = Boolean(payload?.coords?.lat != null && payload?.coords?.lng != null);
  expect(resolved, `statut=${response.status()} payload=${JSON.stringify(payload)}`).toBe(true);
  expect(payload.coords.lat).toBeCloseTo(36.7538, 6);
  expect(payload.coords.lng).toBeCloseTo(3.0588, 6);
});
