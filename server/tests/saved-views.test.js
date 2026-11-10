import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { freshDatabase, login, write } from './helpers.js';

let db; let app; let admin; let operator; let reader;
beforeEach(async () => {
  ({ db } = freshDatabase()); app = createApp();
  admin = await login(app, 'admin'); operator = await login(app, 'operateur'); reader = await login(app, 'lecteur');
});

const body = { nom: 'Urgences Draria', filtres: { priorite: 'urgente', ouvertes: 1, page: 3, sort: 'date_signalement' } };

describe('Vues enregistrées par utilisateur', () => {
  it('enregistre les filtres utiles en ignorant pagination et tri, puis les relit', async () => {
    const created = await write(operator.agent, operator.csrf, 'post', '/api/views', body);
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body.item).toMatchObject({ nom: 'Urgences Draria', partagee: false, own: true,
      filtres: { priorite: 'urgente', ouvertes: '1' } });
    const list = await operator.agent.get('/api/views');
    expect(list.status).toBe(200); expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0].filtres.page).toBeUndefined();
  });
  it('refuse les doublons, les lecteurs et reste privée par défaut', async () => {
    await write(operator.agent, operator.csrf, 'post', '/api/views', body);
    const duplicate = await write(operator.agent, operator.csrf, 'post', '/api/views', body);
    expect(duplicate.status).toBe(409); expect(duplicate.body.error.code).toBe('VUE_EXISTE');
    expect((await write(reader.agent, reader.csrf, 'post', '/api/views', body)).status).toBe(403);
    expect((await operator.agent.get('/api/views')).body.items).toHaveLength(1);
    expect((await admin.agent.get('/api/views')).body.items).toHaveLength(0);
  });
  it('partage une vue en lecture seule aux autres utilisateurs sans permettre sa suppression', async () => {
    const created = await write(admin.agent, admin.csrf, 'post', '/api/views', { ...body, partagee: true });
    const shared = created.body.item;
    const list = await operator.agent.get('/api/views');
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0]).toMatchObject({ id: shared.id, own: false, partagee: true });
    expect((await write(operator.agent, operator.csrf, 'delete', `/api/views/${shared.id}`)).status).toBe(404);
    const renamed = await write(admin.agent, admin.csrf, 'patch', `/api/views/${shared.id}`, { nom: 'Partagée', partagee: false });
    expect(renamed.status).toBe(200); expect(renamed.body.item).toMatchObject({ nom: 'Partagée', partagee: false });
    expect((await operator.agent.get('/api/views')).body.items).toHaveLength(0);
  });
  it('valide le nom et supprime uniquement ses propres vues', async () => {
    const empty = await write(operator.agent, operator.csrf, 'post', '/api/views', { nom: '   ' });
    expect(empty.status).toBe(400);
    const created = await write(operator.agent, operator.csrf, 'post', '/api/views', body);
    const removed = await write(operator.agent, operator.csrf, 'delete', `/api/views/${created.body.item.id}`);
    expect(removed.status).toBe(200);
    expect(db.prepare('SELECT COUNT(*) AS n FROM vues_sauvegardees').get().n).toBe(0);
  });
});
