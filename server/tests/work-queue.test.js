import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createAnomalie } from '../src/services/anomalies.js';
import { freshDatabase, login, anomalyPayload } from './helpers.js';

let db; let refs; let app; let session; let admin;
beforeEach(async () => {
  ({ db, refs } = freshDatabase()); app = createApp();
  session = await login(app, 'operateur'); admin = await login(app, 'admin');
});

describe('File de travail « À faire »', () => {
  it('agrège les mêmes conditions SQL que les listes filtrées', async () => {
    createAnomalie(db, anomalyPayload(refs, { date_signalement: '2020-01-01' }), session.user.id);
    const response = await session.agent.get('/api/work');
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    const item = response.body.item;
    const byId = Object.fromEntries(item.items.map((queue) => [queue.id, queue.count]));
    expect(byId.incompletes).toBe(1); expect(byId.sans_photo).toBe(1);
    expect(byId.sla_depassee).toBe(1); expect(byId.retard).toBe(1);
    expect(item.total).toBe(item.items.reduce((sum, queue) => sum + queue.count, 0));
    for (const queue of item.items) {
      const list = await session.agent.get(`/api/anomalies?${new URLSearchParams(queue.filters)}&pageSize=100`);
      expect(list.body.total, queue.id).toBe(queue.count);
    }
  });
  it('réserve les alertes système aux administrateurs', async () => {
    expect((await session.agent.get('/api/work')).body.item.alertes).toEqual({});
    const alerts = (await admin.agent.get('/api/work')).body.item.alertes;
    expect(Object.keys(alerts).sort()).toEqual(['certificat_expire', 'sauvegarde_manquante']);
    expect((await admin.agent.get('/api/anomalies')).status).toBe(200);
  });
  it('exige une authentification', async () => {
    expect((await request(app).get('/api/work')).status).toBe(401);
  });
});
