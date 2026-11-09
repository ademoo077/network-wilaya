import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { todayAlgiers } from '@anm/shared';
import { createApp } from '../src/app.js';
import { freshDatabase, login, write, anomalyPayload } from './helpers.js';

let app;
let refs;
const today = todayAlgiers();

function uniqueLink(suffix) {
  return `https://example.dz/permissions/${suffix}`;
}

async function createAs(session, suffix) {
  return write(session.agent, session.csrf, 'post', '/api/anomalies', anomalyPayload(refs, {
    lien_url: uniqueLink(suffix), date_signalement: today,
  }));
}

beforeAll(() => {
  ({ refs } = freshDatabase());
  app = createApp();
});

describe('Permissions par rôle (§ 4.7)', () => {
  it('refuse les routes protégées sans session', async () => {
    const anonymous = request(app);
    expect((await anonymous.get('/api/anomalies')).status).toBe(401);
    expect((await anonymous.get('/api/stats/overview')).status).toBe(401);
    expect((await anonymous.get('/api/stats/detail')).status).toBe(401);
    expect((await anonymous.get('/api/settings')).status).toBe(401);
    expect((await anonymous.get('/api/health')).status).toBe(200);
    expect((await anonymous.get('/api/config')).status).toBe(200);
  });

  it('lecteur : lecture et export seulement', async () => {
    const session = await login(app, 'lecteur');
    const list = await session.agent.get('/api/anomalies');
    expect(list.status).toBe(200);
    expect((await session.agent.get('/api/stats/overview')).status).toBe(200);
    expect((await session.agent.get('/api/stats/detail')).status).toBe(200);
    expect((await session.agent.get('/api/anomalies/export?format=csv')).status).toBe(200);

    expect((await createAs(session, 'lecteur')).status).toBe(403);
    expect((await write(session.agent, session.csrf, 'post', '/api/reports/weekly/snapshot', { semaine: today })).status).toBe(403);
    expect((await write(session.agent, session.csrf, 'delete', '/api/anomalies/1', { motif: 'test' })).status).toBe(403);
    expect((await write(session.agent, session.csrf, 'post', '/api/anomalies/1/restore')).status).toBe(403);
    expect((await session.agent.get('/api/users')).status).toBe(403);
    expect((await session.agent.get('/api/admin/backups')).status).toBe(403);
    expect((await session.agent.get('/api/admin/audit')).status).toBe(403);

    const settings = await session.agent.get('/api/settings');
    expect(settings.status).toBe(200);
    expect(settings.body.item.exiger_verification).toBeUndefined();
    expect(settings.body.item.tile_url).toBeTruthy();
  });

  it('opérateur : écriture métier mais pas administration', async () => {
    const session = await login(app, 'operateur');
    const created = await createAs(session, 'operateur');
    expect(created.status).toBe(201);
    const id = created.body.item.id;

    const patched = await write(session.agent, session.csrf, 'patch', `/api/anomalies/${id}`, {
      version: created.body.item.version, observations: 'Modifié par opérateur',
    });
    expect(patched.status).toBe(200);

    expect((await session.agent.get('/api/anomalies/import/template')).status).toBe(200);
    expect((await write(session.agent, session.csrf, 'delete', `/api/anomalies/${id}`, { motif: 'test' })).status).toBe(403);
    expect((await session.agent.get('/api/users')).status).toBe(403);
    expect((await session.agent.get('/api/admin/backups')).status).toBe(403);
    expect((await write(session.agent, session.csrf, 'put', '/api/settings', {
      nom_cellule: 'Interdit', week_start_day: 0, delai_retard_jours: 7,
      exiger_verification: 1, tile_url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      backup_retention_days: 30, gps_bbox: '36.40,2.50,36.95,3.40',
    })).status).toBe(403);
  });

  it('admin : administration complète et suppression/restauration', async () => {
    const session = await login(app, 'admin');
    const created = await createAs(session, 'admin');
    expect(created.status).toBe(201);
    const id = created.body.item.id;

    expect((await session.agent.get('/api/users')).status).toBe(200);
    expect((await session.agent.get('/api/admin/backups')).status).toBe(200);
    expect((await session.agent.get('/api/admin/audit')).status).toBe(200);

    const settings = await session.agent.get('/api/settings');
    expect(settings.status).toBe(200);
    expect(settings.body.item.exiger_verification).toBeDefined();

    expect((await write(session.agent, session.csrf, 'delete', `/api/anomalies/${id}`, { motif: 'Test' })).status).toBe(200);
    expect((await session.agent.get(`/api/anomalies/${id}`)).status).toBe(404);
    expect((await write(session.agent, session.csrf, 'post', `/api/anomalies/${id}/restore`)).status).toBe(200);
    expect((await session.agent.get(`/api/anomalies/${id}`)).status).toBe(200);
  });
});
