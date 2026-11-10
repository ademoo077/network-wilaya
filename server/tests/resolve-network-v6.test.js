import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { freshDatabase, login } from './helpers.js';
import { setResolveDeps } from '../src/routes/tools.js';
import { createApp } from '../src/app.js';
import { startFakeRedirectServer } from '../../tests/support/fake-redirects.mjs';

describe('V6 — résolveur avec vrai faux serveur HTTP local', () => {
  let db; let app; let user; let fake;
  beforeAll(async () => {
    ({ db } = freshDatabase()); app = createApp(); user = await login(app, 'lecteur');
    fake = await startFakeRedirectServer();
  });
  beforeEach(() => {
    db.prepare('DELETE FROM liens_cache').run();
    db.prepare("UPDATE parametres SET valeur='cartes' WHERE cle='resolution_liens'").run();
    setResolveDeps({ fetchImpl: fake.fetchImpl, lookupImpl: fake.lookupImpl, timeoutMs: 150 });
  });
  afterAll(async () => { await fake.stop(); setResolveDeps({}); });
  const resolve = (path) => user.agent.post('/api/tools/resolve-link').set('X-CSRF-Token', user.csrf).send({ url: `https://maps.app.goo.gl/${path}` });
  it.each(['normal', 'pin', 'consent', 'html'])('%s → coordonnées précises', async (path) => {
    const res = await resolve(path);
    expect(res.status).toBe(200); expect(res.body.ok).toBe(true);
    expect(res.body.coords).toMatchObject({ lat: 36.7538, lng: 3.0588, source: 'lien_court' });
    expect(res.body.urlFinale).toMatch(/^https:/);
  });
  it.each([['network', 'NETWORK_UNAVAILABLE'], ['timeout', 'TIMEOUT'], ['blocked', 'BLOCKED_HOST'],
    ['outside', 'BLOCKED_HOST'], ['loop', 'TOO_MANY_REDIRECTS'], ['upstream', 'UPSTREAM_ERROR'], ['empty', 'NO_COORDINATES']])('%s → %s', async (path, code) => {
    const res = await resolve(path);
    expect(res.status).toBe(200); expect(res.body).toMatchObject({ ok: false, code }); expect(res.body.coords).toBeFalsy();
  });
  it('DNS privé et rebinding IPv6 sont refusés avant le fetch', async () => {
    let requests = 0;
    setResolveDeps({ fetchImpl: async () => { requests += 1; }, lookupImpl: async () => [{ address: '::ffff:7f00:1', family: 6 }] });
    expect((await resolve('private')).body.code).toBe('BLOCKED_HOST'); expect(requests).toBe(0);
  });
  it('TLS est expliqué sans désactiver la validation des certificats', async () => {
    setResolveDeps({ fetchImpl: async () => { throw Object.assign(new Error('fetch failed'), { cause: { code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' } }); } });
    expect((await resolve('tls')).body).toMatchObject({ ok: false, code: 'TLS_ERROR' });
  });
  it('cache succès 7 jours, échec 5 minutes, mode aucune prioritaire sur cache', async () => {
    await resolve('normal'); const calls = fake.requests.length;
    expect((await resolve('normal')).body.cache).toBe(true); expect(fake.requests.length).toBe(calls);
    db.prepare("UPDATE parametres SET valeur='aucune' WHERE cle='resolution_liens'").run();
    expect((await resolve('normal')).body.code).toBe('DISABLED');
    db.prepare("UPDATE parametres SET valeur='cartes' WHERE cle='resolution_liens'").run();
    await resolve('empty'); expect((await resolve('empty')).body.cache).toBe(true);
    db.prepare("UPDATE liens_cache SET fetched_at='2000-01-01T00:00:00.000Z'").run();
    expect((await resolve('empty')).body.cache).not.toBe(true);
  });
});
