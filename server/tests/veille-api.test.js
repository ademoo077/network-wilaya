import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { freshDatabase, login, write } from './helpers.js';
import { veilleContext } from '../src/veille/context.js';
import { createVeilleElement } from '../src/veille/ingest.js';
import { resetCaptureRateLimit } from '../src/veille/capture.js';

let app; let db; let refs; let sourceId; let elementId;

beforeAll(() => {
  ({ db, refs } = freshDatabase());
  sourceId = Number(db.prepare("INSERT INTO veille_sources(type, nom, actif) VALUES ('rss', 'Flux API test', 1)").run().lastInsertRowid);
  const created = createVeilleElement(db, sourceId, {
    id_externe: 'api-1', texte: 'Nid de poule à Commune Test', url: 'https://example.dz/api-1', page_nom: 'Page API',
  }, { context: veilleContext(db) });
  elementId = created.element.id;
  app = createApp();
  resetCaptureRateLimit();
});

describe('API Veille — triage humain', () => {
  it('liste les éléments et expose les termes reconnus', async () => {
    const { agent } = await login(app, 'operateur');
    const res = await agent.get('/api/veille/elements?statut=a_qualifier');
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.items[0].termes).toContain('nid de poule');
  });

  it('refuse une décision au lecteur et accepte l’opérateur', async () => {
    const reader = await login(app, 'lecteur');
    expect((await write(reader.agent, reader.csrf, 'post', `/api/veille/elements/${elementId}/retenir`, {})).status).toBe(403);
    const operator = await login(app, 'operateur');
    const res = await write(operator.agent, operator.csrf, 'post', `/api/veille/elements/${elementId}/retenir`, {});
    expect(res.status).toBe(200);
    expect(res.body.item.statut).toBe('retenu');
    expect(res.body.prefill.veille_element_id).toBe(elementId);
    expect(res.body.prefill.commune_id).toBe(refs.communeId);
  });

  it('prépare le formulaire sans modifier l’élément et permet l’annulation', async () => {
    const { agent, csrf } = await login(app, 'operateur');
    const prefill = await agent.get(`/api/veille/prefill/${elementId}`);
    expect(prefill.status).toBe(200);
    expect(prefill.body.item.lien_url).toBe('https://example.dz/api-1');
    const undo = await write(agent, csrf, 'post', `/api/veille/elements/${elementId}/annuler`, {});
    expect(undo.status).toBe(200);
    expect(undo.body.item.statut).not.toBe('retenu');
  });

  it('crée une fiche anomalie depuis le préremplissage avec veille_element_id', async () => {
    const { agent, csrf } = await login(app, 'operateur');
    const prefill = (await agent.get(`/api/veille/prefill/${elementId}`)).body.item;
    const res = await write(agent, csrf, 'post', '/api/anomalies', { ...prefill, force_duplicate: true });
    expect(res.status).toBe(201);
    expect(res.body.item.veille_element_id).toBe(elementId);
    expect(res.body.item.commune_id).toBe(refs.communeId);
  });

  it('analyse un texte et renvoie les suggestions explicables', async () => {
    const { agent, csrf } = await login(app, 'operateur');
    const before = db.prepare('SELECT COUNT(*) AS c FROM veille_elements').get().c;
    const res = await write(agent, csrf, 'post', '/api/veille/analyser', { texte: 'Éclairage public en panne à Commune Test' });
    expect(res.status).toBe(200);
    expect(res.body.item.correspondances.length).toBeGreaterThan(0);
    expect(res.body.item.suggestions.length).toBeGreaterThan(0);
    expect(db.prepare('SELECT COUNT(*) AS c FROM veille_elements').get().c).toBe(before);
  });

  it('réserve le lexique et les alias à l’administrateur', async () => {
    const operator = await login(app, 'operateur');
    expect((await write(operator.agent, operator.csrf, 'patch', '/api/veille/lexique/1', { poids: 2 })).status).toBe(403);
    const admin = await login(app, 'admin');
    const term = db.prepare('SELECT id FROM veille_lexique ORDER BY id LIMIT 1').get();
    const res = await write(admin.agent, admin.csrf, 'patch', `/api/veille/lexique/${term.id}`, { poids: 2, actif: 1 });
    expect(res.status).toBe(200);
    const alias = await write(admin.agent, admin.csrf, 'post', '/api/veille/alias', { alias: 'Commune Test Centre', commune_id: refs.communeId });
    expect(alias.status).toBe(201);
    expect((await write(admin.agent, admin.csrf, 'delete', `/api/veille/alias/${alias.body.item.id}`)).status).toBe(204);
  });

  it('expose les propositions d’apprentissage et permet de les traiter', async () => {
    const { agent, csrf } = await login(app, 'admin');
    const refreshed = await write(agent, csrf, 'post', '/api/veille/apprentissages/rafraichir', {});
    expect(refreshed.status).toBe(200);
    const list = await agent.get('/api/veille/apprentissages');
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.items)).toBe(true);
  });

  it('gère les jetons de capture et refuse un jeton révoqué', async () => {
    const operator = await login(app, 'operateur');
    const created = await write(operator.agent, operator.csrf, 'post', '/api/veille/capture-tokens', { nom: 'Extension test' });
    expect(created.status).toBe(201);
    expect(created.body.token).toBeTruthy();
    const listed = await operator.agent.get('/api/veille/capture-tokens');
    expect(listed.body.items.some((item) => item.id === created.body.item.id)).toBe(true);
    const capture = await request(app).post('/api/veille/capture')
      .set('Authorization', `Bearer ${created.body.token}`)
      .send({ texte: 'Nid de poule dangereux à Commune Test', url: 'https://facebook.com/capture/1', page_nom: 'Page citoyenne' });
    expect(capture.status).toBe(201);
    expect(capture.body.item.id).toBeTruthy();
    const revoked = await write(operator.agent, operator.csrf, 'delete', `/api/veille/capture-tokens/${created.body.item.id}`);
    expect(revoked.status).toBe(200);
    const refused = await request(app).post('/api/veille/capture')
      .set('Authorization', `Bearer ${created.body.token}`)
      .send({ texte: 'Nid de poule dangereux à Commune Test', url: 'https://facebook.com/capture/2' });
    expect(refused.status).toBe(401);
  });
});
