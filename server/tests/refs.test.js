import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../src/app.js';
import { freshDatabase, login, write } from './helpers.js';

let app;
let refs;

beforeAll(() => {
  ({ refs } = freshDatabase());
  app = createApp();
});

describe('Référentiels', () => {
  it('GET /api/ref/bootstrap expose la taxonomie 70/156 et les cascades', async () => {
    const { agent } = await login(app, 'lecteur');
    const res = await agent.get('/api/ref/bootstrap');
    expect(res.status).toBe(200);
    expect(res.body.taxonomie).toMatchObject({ domaines: 70, types: 156, ok: true });
    expect(res.body.domaines[0].types.length).toBeGreaterThan(0);
    expect(res.body.dairas[0].communes.length).toBeGreaterThan(0);
    expect(res.body.parametres.nom_cellule).toBeTruthy();
  });

  it('renvoie 304 avec ETag inchangé', async () => {
    const { agent } = await login(app, 'lecteur');
    const first = await agent.get('/api/ref/bootstrap');
    const etag = first.headers.etag;
    const second = await agent.get('/api/ref/bootstrap').set('If-None-Match', etag);
    expect(second.status).toBe(304);
  });

  it('crée, modifie et désactive une daïra', async () => {
    const { agent, csrf } = await login(app);
    const created = await write(agent, csrf, 'post', '/api/ref/dairas', { name_fr: 'Daïra Nouvelle', name_ar: 'دائرة جديدة' });
    expect(created.status).toBe(201);
    const id = created.body.item.id;
    const updated = await write(agent, csrf, 'patch', `/api/ref/dairas/${id}`, { name_fr: 'Daïra Renommée' });
    expect(updated.status).toBe(200);
    expect(updated.body.item.name_fr).toBe('Daïra Renommée');
    const disabled = await write(agent, csrf, 'delete', `/api/ref/dairas/${id}`);
    expect(disabled.status).toBe(200);
    expect(disabled.body.item.actif).toBe(0);
  });

  it('refuse un doublon de daïra', async () => {
    const { agent, csrf } = await login(app);
    const res = await write(agent, csrf, 'post', '/api/ref/dairas', { name_fr: 'Daïra Test' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DOUBLON_REFERENTIEL');
  });

  it('impose la daïra parente d’une commune', async () => {
    const { agent, csrf } = await login(app);
    const res = await write(agent, csrf, 'post', '/api/ref/communes', { daira_id: 999999, name_fr: 'Orpheline' });
    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/Daïra/);
  });

  it('aperçu puis validation du territoire, idempotents', async () => {
    const { agent, csrf } = await login(app);
    const texte = 'Daïra Alpha ; Commune A1\nDaïra Alpha ; Commune A2\nDaïra Beta : Commune B1, Commune B2\nligne invalide';
    const preview = await write(agent, csrf, 'post', '/api/ref/bulk-territoire', { texte, dryRun: true });
    expect(preview.status).toBe(200);
    expect(preview.body.item.applied).toBe(false);
    expect(preview.body.item.totals).toEqual({ dairas: 2, communes: 4 });
    expect(preview.body.item.invalides).toHaveLength(1);
    const applied = await write(agent, csrf, 'post', '/api/ref/bulk-territoire', { texte });
    expect(applied.status).toBe(200);
    expect(applied.body.item.createdDairas).toBe(2);
    expect(applied.body.item.createdCommunes).toBe(4);
    const again = await write(agent, csrf, 'post', '/api/ref/bulk-territoire', { texte });
    expect(again.status).toBe(200);
    expect(again.body.item.createdDairas).toBe(0);
    expect(again.body.item.createdCommunes).toBe(0);
  });

  it('crée une EPIC avec ses domaines de compétence', async () => {
    const { agent, csrf } = await login(app);
    const res = await write(agent, csrf, 'post', '/api/ref/epics', {
      name: 'EPIC Nouvelle', sigle: 'EPN', domaine_ids: [refs.domaineId, refs.otherDomaineId],
    });
    expect(res.status).toBe(201);
    const id = res.body.item.id;
    const bootstrap = await agent.get('/api/ref/bootstrap');
    const epic = bootstrap.body.epics.find((e) => e.id === id);
    expect(epic.domaine_ids.sort()).toEqual([refs.domaineId, refs.otherDomaineId].sort());
  });

  it('réserve les écritures de référentiel à l’administrateur', async () => {
    const { agent, csrf } = await login(app, 'operateur');
    const res = await write(agent, csrf, 'post', '/api/ref/dairas', { name_fr: 'Interdite' });
    expect(res.status).toBe(403);
  });
});
