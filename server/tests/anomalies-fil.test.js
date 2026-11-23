import { describe, it, expect, beforeAll } from 'vitest';
import { todayAlgiers, addDays } from '@anm/shared';
import { createApp } from '../src/app.js';
import { freshDatabase, login, write, anomalyPayload } from './helpers.js';

let app;
let refs;
let agent;
let csrf;
let today;
let yesterday;

beforeAll(async () => {
  ({ refs } = freshDatabase());
  app = createApp();
  ({ agent, csrf } = await login(app, 'admin'));
  today = todayAlgiers();
  yesterday = addDays(today, -1);
  await write(agent, csrf, 'post', '/api/anomalies', anomalyPayload(refs, { date_signalement: today, priorite: 'urgente', lien_url: 'https://www.facebook.com/watch/?v=fil1' }));
  await write(agent, csrf, 'post', '/api/anomalies', anomalyPayload(refs, { date_signalement: today, lien_url: 'https://www.facebook.com/watch/?v=fil2' }));
  await write(agent, csrf, 'post', '/api/anomalies', anomalyPayload(refs, { date_signalement: yesterday, lien_url: 'https://www.facebook.com/watch/?v=fil3' }));
});

describe('API Fil des anomalies', () => {
  it('renvoie un résumé et des groupes par date (aujourd\'hui par défaut)', async () => {
    const res = await agent.get('/api/anomalies/fil');
    expect(res.status).toBe(200);
    expect(res.body.resume.signalees).toBe(2);
    expect(res.body.resume.urgentes).toBe(1);
    expect(res.body.groupes.length).toBe(1);
    expect(res.body.groupes[0].total).toBe(2);
  });

  it('filtre les groupes comme le tableau', async () => {
    const res = await agent.get('/api/anomalies/fil?priorite=urgente');
    expect(res.body.resume.signalees).toBe(1);
    expect(res.body.groupes[0].total).toBe(1);
  });

  it('jour=tout retourne tous les groupes', async () => {
    const res = await agent.get('/api/anomalies/fil?jour=tout');
    expect(res.status).toBe(200);
    expect(res.body.resume.signalees).toBe(3);
    expect(res.body.groupes.length).toBe(2);
  });

  it('comptes groupes = comptes tableau pour les mêmes filtres', async () => {
    const fil = await agent.get('/api/anomalies/fil?jour=tout&groupe=date');
    const list = await agent.get('/api/anomalies?from=' + yesterday + '&to=' + today + '&pageSize=100');
    expect(fil.status).toBe(200);
    expect(list.status).toBe(200);
    const filTotal = fil.body.groupes.reduce((s, g) => s + g.total, 0);
    expect(filTotal).toBe(list.body.total);
  });

  it('resume Aujourd\'hui = anomalies du jour fuseau Alger', async () => {
    const fil = await agent.get('/api/anomalies/fil?jour=aujourdhui');
    const list = await agent.get('/api/anomalies?from=' + today + '&to=' + today + '&pageSize=100');
    expect(fil.body.resume.signalees).toBe(list.body.total);
  });

  it('jour=traitees retourne l\'historique des anomalies traitées', async () => {
    const created = await write(agent, csrf, 'post', '/api/anomalies', anomalyPayload(refs, { date_signalement: yesterday, lien_url: 'https://www.facebook.com/watch/?v=fil-traite1' }));
    expect(created.status).toBe(201);
    const id = created.body.item.id;
    const v = created.body.item.version;
    const treated = await write(agent, csrf, 'post', `/api/anomalies/${id}/statut`, { version: v, statut: 'traite', epic_id: refs.epicId, date_traitement: today, sans_photo_motif: 'Test' });
    expect(treated.status).toBe(200);
    const fil = await agent.get('/api/anomalies/fil?jour=traitees');
    expect(fil.status).toBe(200);
    expect(fil.body.resume.signalees).toBeGreaterThanOrEqual(1);
    expect(fil.body.groupes.some((g) => g.items.some((it) => it.id === id))).toBe(true);
  });
});
