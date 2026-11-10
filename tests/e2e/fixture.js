import { test as base, expect } from '@playwright/test';
import { startTestServer, stubTiles } from './helpers.js';

export const test = base.extend({
  testServer: async ({ browserName: _browserName }, provide) => { const server = await startTestServer(); try { await provide(server); } finally { await server.close(); } },
  emptyServer: async ({ browserName: _browserName }, provide) => { const server = await startTestServer({ dataset: 'empty' }); try { await provide(server); } finally { await server.close(); } },
  baseURL: async ({ testServer }, provide) => provide(testServer.base),
  page: async ({ page }, provide) => { await stubTiles(page); await provide(page); },
});
export { expect };
