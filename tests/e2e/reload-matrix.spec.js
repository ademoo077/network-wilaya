import { test, expect } from './fixture.js';
import { authenticate, collectErrors, expectNotBlank } from './helpers.js';
import { routeCases } from './route-cases.js';
import fs from 'node:fs';
function loadDict(lang) {
  return ['', '-v5', '-v6', '-v7', '-v8', '-reseaux'].reduce((merged, suffix) => ({
    ...merged,
    ...JSON.parse(fs.readFileSync(new URL(`../../client/src/i18n/${lang}${suffix}.json`, import.meta.url))),
  }), {});
}
const fr = loadDict('fr');
const ar = loadDict('ar');

for (const dataset of ['demo', 'empty']) for (const lang of ['fr', 'ar']) for (const theme of ['light', 'dark']) {
  test(`33 — chaque route / ${dataset} / ${lang} / ${theme}`, async ({ page, testServer, emptyServer }, info) => {
    test.setTimeout(120_000);
    const base = dataset === 'demo' ? testServer.base : emptyServer.base;
    const session = await authenticate(page, base);
    await page.addInitScript(({ lang, theme }) => { localStorage.setItem('anm-language', lang); localStorage.setItem('anm-theme', theme); }, { lang, theme });
    const errors = collectErrors(page);
    const dict = lang === 'fr' ? fr : ar;
    for (const [pattern, key] of routeCases) {
      const isVeilleElement = pattern.startsWith('/veille/elements/');
      const route = pattern.replace(':id', isVeilleElement
        ? (dataset === 'demo' ? String(testServer.refs.veilleElementId) : 'absente')
        : (dataset === 'demo' ? String(testServer.refs.ids[0]) : 'absente'));
      let title = dict[key];
      if (key === 'dashboard.hello') title = title.replace('{name}', session.user.full_name);
      if (pattern.includes(':id') && dataset === 'empty') title = dict['notFound.title'];
      if (key === 'reference' && dataset === 'demo') title = new RegExp('^ANM-');
      if (key === 'veille.detail.title' && dataset === 'demo') title = new RegExp('^\\[DEMO\\] Page Veille');
      await test.step(route, async () => {
        await page.goto(`${base}/#${route}`);
        for (let reload = 0; reload < 3; reload += 1) {
          if (reload) await page.reload();
          await expectNotBlank(page, 3000);
          await expect(page.locator('main h1, #root > div h1').first(), `Titre ${route} (${key})`).toHaveText(title, { timeout: 3000 });
          await expect(page.getByText(dict['errors.fallback.title'], { exact: true })).toBeHidden();
        }
        await info.attach(`console-${encodeURIComponent(route)}`, { body: JSON.stringify(errors.snapshot()), contentType: 'application/json' });
        expect(errors.snapshot().pageError, route).toEqual([]);
        expect(errors.snapshot().consoleError, route).toEqual([]);
        expect(errors.snapshot().requestFailed, route).toEqual([]);
        errors.reset();
      });
    }
  });
}
