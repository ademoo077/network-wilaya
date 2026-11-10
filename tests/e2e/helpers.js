import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect } from '@playwright/test';
import { setTimeout as delay } from 'node:timers/promises';
export { startFakeRedirectServer } from '../support/fake-redirects.mjs';

export async function waitForHealth(base, attempts = 120) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) return await response.json();
    } catch { /* serveur pas encore prêt */ }
    await delay(250);
  }
  return null;
}

export async function startTestServer({ dataset = 'demo' } = {}) {
  const parent = process.platform === 'win32' ? path.join(process.env.LOCALAPPDATA, 'Temp', 'opencode') : os.tmpdir();
  fs.mkdirSync(parent, { recursive: true });
  const root = fs.mkdtempSync(path.join(parent, 'anm-v6-e2e-'));
  const child = fork(fileURLToPath(new URL('../support/browser-server.mjs', import.meta.url)), [], {
    env: { ...process.env, ANM_TEST_ROOT: root, E2E_DATASET: dataset, E2E_PORT: '0' }, silent: true,
  });
  let logs = '';
  child.stdout.on('data', (data) => { logs += data; });
  child.stderr.on('data', (data) => { logs += data; });
  const result = await new Promise((resolve, reject) => {
    child.once('message', resolve);
    child.once('error', reject);
    child.once('exit', (code) => reject(new Error(`Serveur E2E arrêté (${code}): ${logs}`)));
  });
  return { ...result, logs: () => logs, close: () => new Promise((resolve) => {
    child.once('exit', resolve); child.send('close');
  }) };
}

export async function loginAs(base, role = 'admin') {
  const username = role;
  const password = 'E2E-Alger-2026';
  const response = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
  const payload = await response.json().catch(() => null);
  const setCookie = response.headers.getSetCookie?.() || [];
  if (!response.ok) throw new Error(`loginAs: ${response.status} ${JSON.stringify(payload)}`);
  const pair = setCookie[0] || '';
  const token = pair.split(';')[0].split('=').slice(1).join('=');
  return { user: payload.user, csrf: payload.csrf, token, cookie: pair, role };
}

export function collectErrors(page) {
  const errors = { pageError: [], consoleError: [], requestFailed: [] };
  page.on('pageerror', (error) => errors.pageError.push({ message: String(error?.message || error), stack: error.stack }));
  page.on('console', (message) => { if (message.type() === 'error') errors.consoleError.push({ text: message.text() }); });
  page.on('requestfailed', (request) => {
    if (blockedPages.has(page) && isTile(request.url())) return;
    if (request.failure()?.errorText === 'net::ERR_ABORTED') return;
    errors.requestFailed.push({ url: request.url(), failure: request.failure()?.errorText });
  });
  return {
    errors,
    snapshot: () => ({ pageError: [...errors.pageError], consoleError: [...errors.consoleError], requestFailed: [...errors.requestFailed] }),
    reset: () => { errors.pageError.length = 0; errors.consoleError.length = 0; errors.requestFailed.length = 0; },
  };
}

export async function expectNotBlank(page, timeout = 3000) {
  await expect(page.locator('#root :is(h1, main)').first()).toBeVisible({ timeout });
  await expect.poll(() => page.locator('#root').innerText(), { timeout }).toMatch(/[\s\S]{50}/);
  return true;
}

export async function pasteText(page, selector, text) {
  await page.locator(selector).waitFor({ state: 'visible' });
  await page.locator(selector).focus();
  await page.evaluate(([target, value]) => {
    const element = document.querySelector(target);
    if (!element) throw new Error(`pasteText: élément introuvable ${target}`);
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', value);
    const event = new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true, composed: true });
    element.dispatchEvent(event);
  }, [selector, text]);
}

const blockedPages = new WeakSet();
const tilePattern = /^https:\/\/[^/]*(?:openstreetmap|basemaps|arcgisonline)[^/]*\//;
const isTile = (url) => tilePattern.test(url);
export async function blockTiles(page) { blockedPages.add(page); await page.route(tilePattern, (route) => route.abort()); }
export async function stubTiles(page) {
  await page.route(tilePattern, (route) => route.fulfill({ contentType: 'image/png',
    body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64') }));
}
export async function authenticate(page, base, role = 'admin') {
  const session = await loginAs(base, role);
  await page.context().addCookies([{ name: 'sid', value: session.token, url: base }]);
  return session;
}

export async function unroute(page) {
  await page.unroute('**/*');
}
