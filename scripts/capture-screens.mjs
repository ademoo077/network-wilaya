import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { startTestServer, loginAs, stubTiles } from '../tests/e2e/helpers.js';

const OUT = path.resolve('docs', 'screens');
const ROUTES = [
  ['tableau-de-bord', '/#/'], ['anomalies', '/#/anomalies'], ['nouvelle-anomalie', '/#/anomalies/nouvelle'],
  ['carte', '/#/carte'], ['a-faire', '/#/a-faire'], ['rapport', '/#/rapport'], ['sante', '/#/admin/sante'],
];
const VARIANTS = [['fr-light', 'fr', 'light'], ['fr-dark', 'fr', 'dark'], ['ar-dark', 'ar', 'dark']];
const WIDTHS = [1440, 390];

fs.mkdirSync(OUT, { recursive: true });
const server = await startTestServer();
const browser = await chromium.launch();
try {
  for (const [variant, lang, theme] of VARIANTS) {
    for (const width of WIDTHS) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: 1 });
      const auth = await loginAs(server.base);
      await context.addCookies([{ name: 'sid', value: auth.token, url: server.base }]);
      await context.addInitScript(([language, mode]) => {
        localStorage.setItem('anm-language', language); localStorage.setItem('anm-theme', mode);
      }, [lang, theme]);
      const page = await context.newPage(); await stubTiles(page);
      for (const [name, route] of ROUTES) {
        await page.goto(`${server.base}${route}`);
        await page.waitForSelector('#root h1');
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(OUT, `${variant}-${width}-${name}.png`) });
      }
      await context.close();
      process.stdout.write(`capturé : ${variant} ${width}px\n`);
    }
  }
} finally {
  await browser.close(); await server.close();
}
