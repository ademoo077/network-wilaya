import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../src/app.js';
import { freshDatabase, login, write, anomalyPayload } from './helpers.js';

let app;
let refs;
let agent;
let csrf;

beforeAll(async () => {
  ({ refs } = freshDatabase());
  app = createApp();
  ({ agent, csrf } = await login(app, 'admin'));
  // Créer quelques anomalies
  await write(agent, csrf, 'post', '/api/anomalies', anomalyPayload(refs, { date_signalement: '2026-11-23', priorite: 'urgente' }));
  await write(agent, csrf, 'post', '/api/anomalies', anomalyPayload(refs, { date_signalement: '2026-11-23' }));
  await write(agent, csrf, 'post', '/api/anomalies', anomalyPayload(refs, { date_signalement: '2026-11-22' }));
});

describe('API Fil des anomalies', () => {
  it('renvoie un résumé et des groupes par date', async () => {
    const res = await agent.get('/api/anomalies/fil');
    expect(res.status).toBe(200);
    expect(res.body.resume.signalees).toBe(3);
    expect(res.body.resume.urgentes).toBe(1);
    expect(res.body.groupes.length).toBeGreaterThanOrEqual(2);
    expect(res.body.groupes[0].total).toBe(2); // 2026-11-23
  });

  it('filtre les groupes comme le tableau', async () => {
    const res = await agent.get('/api/anomalies/fil?priorite=urgente');
    expect(res.body.resume.signalees).toBe(1);
    expect(res.body.groupes[0].total).toBe(1);
  });
});
