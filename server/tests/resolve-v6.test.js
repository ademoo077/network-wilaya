import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { freshDatabase, login } from './helpers.js';
import { setResolveDeps } from '../src/routes/tools.js';

function fakeResponse(status, location = null) {
  return { status, ok: status < 400, headers: { get: (name) => (String(name).toLowerCase() === 'location' ? location : null) } };
}

describe('Outils de resolution de liens courts V6', () => {
  let app;
  let db;
  let reader;

  beforeAll(async () => {
    ({ db } = freshDatabase());
    app = createApp();
    reader = await login(app, 'lecteur');
    db.prepare(`INSERT INTO parametres(cle, valeur) VALUES ('resolution_liens', 'cartes')
      ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur`).run();
  });

  beforeEach(() => {
    setResolveDeps({});
    db.prepare(`UPDATE parametres SET valeur = 'cartes' WHERE cle = 'resolution_liens'`).run();
    db.prepare('DELETE FROM liens_cache').run();
  });

  it('resout un lien court carte via une chaine de redirections (C40)', async () => {
    let calls = 0;
    setResolveDeps({ fetchImpl: async () => { calls += 1; return calls === 1 ? fakeResponse(302, 'https://www.google.com/maps/@36.7538,3.0588,17z') : fakeResponse(200); }, lookupImpl: async () => ({ address: '142.250.75.224' }) });
    const res = await reader.agent.post('/api/tools/resolve-link').set('X-CSRF-Token', reader.csrf).send({ url: 'https://maps.app.goo.gl/abc123' });
    expect(res.status).toBe(200);
    expect(res.body.disponible).toBe(true);
    expect(res.body.coords).toMatchObject({ lat: 36.7538, lng: 3.0588 });
  });

  it('garde une reponse propre quand la resolution est impossible (C41)', async () => {
    setResolveDeps({ fetchImpl: async () => { throw new Error('boom réseau'); }, lookupImpl: async () => ({ address: '142.250.75.224' }) });
    const res = await reader.agent.post('/api/tools/resolve-link').set('X-CSRF-Token', reader.csrf).send({ url: 'https://maps.app.goo.gl/abc123' });
    expect(res.status).toBe(200);
    expect(res.body.disponible).toBe(false);
  });

  it('autorise la resolution des liens courts reseaux via mode tous (C44)', async () => {
    db.prepare(`UPDATE parametres SET valeur = 'tous' WHERE cle = 'resolution_liens'`).run();
    let calls = 0;
    setResolveDeps({ fetchImpl: async () => { calls += 1; return calls === 1 ? fakeResponse(302, 'https://www.tiktok.com/@agentwilaya/video/7293847562983745') : fakeResponse(200); }, lookupImpl: async () => ({ address: '185.60.216.35' }) });
    const res = await reader.agent.post('/api/tools/resolve-link').set('X-CSRF-Token', reader.csrf).send({ url: 'https://vm.tiktok.com/ZMabc123/' });
    expect(res.status).toBe(200);
    expect(res.body.disponible).toBe(true);
  });
});
