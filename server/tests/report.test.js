import { describe, it, expect, beforeAll } from 'vitest';
import { todayAlgiers, weekStart, weekEnd, addDays } from '@anm/shared';
import { createApp } from '../src/app.js';
import { freshDatabase, login, write, anomalyPayload } from './helpers.js';

let app;
let refs;
let agent;
let csrf;
const today = todayAlgiers();
const S = weekStart(today, 0);
const E = weekEnd(today, 0);

async function create(overrides) {
  const res = await write(agent, csrf, 'post', '/api/anomalies', anomalyPayload(refs, overrides));
  if (res.status !== 201) throw new Error(`Création échouée ${res.status}: ${JSON.stringify(res.body)}`);
  return res.body.item;
}

beforeAll(async () => {
  ({ refs } = freshDatabase());
  app = createApp();
  ({ agent, csrf } = await login(app, 'admin'));
  await create({ lien_url: 'https://facebook.com/r/1', date_signalement: today });
  await create({
    lien_url: 'https://facebook.com/r/2', date_signalement: today,
    verification: 'confirmee', agent_id: refs.agentId, statut: 'en_cours',
    epic_id: refs.epicId, date_intervention: today,
  });
  await create({
    lien_url: 'https://facebook.com/r/3', date_signalement: today,
    verification: 'confirmee', agent_id: refs.agentId, statut: 'traite',
    epic_id: refs.epicId, date_intervention: today, date_traitement: today,
  });
});

describe('Rapport hebdomadaire', () => {
  it('calcule les KPI de la semaine et le statut à la fin de semaine', async () => {
    const res = await agent.get('/api/reports/weekly').query({ semaine: S });
    expect(res.status).toBe(200);
    const report = res.body.item;
    expect(report.semaine).toMatchObject({ debut: S, fin: E });
    expect(report.kpis.recues).toBe(3);
    expect(report.kpis.non_traite).toBe(1);
    expect(report.kpis.en_cours).toBe(1);
    expect(report.kpis.traite).toBe(1);
    expect(report.kpis.traitees_semaine).toBe(1);
    expect(report.kpis.stock_fin).toBe(2);
    expect(report.kpis.taux_traitement).toBeCloseTo(1 / 3, 4);
    expect(report.resume).toContain('Synthèse hebdomadaire');
    expect(report.serie_8_semaines).toHaveLength(8);
  });

  it('propose le même effectif que le tableau de bord pour la même cohorte', async () => {
    const overview = await agent.get('/api/stats/overview').query({ from: S, to: E });
    const report = await agent.get('/api/reports/weekly').query({ semaine: S });
    expect(overview.body.item.cohorte.total).toBe(report.body.item.kpis.recues);
    expect(overview.body.item.cohorte.traite).toBe(report.body.item.kpis.traite);
  });

  it('fige des versions successives sans altérer les précédentes', async () => {
    const v1 = await write(agent, csrf, 'post', '/api/reports/weekly/snapshot', { semaine: S });
    expect(v1.status).toBe(201);
    expect(v1.body.version).toBe(1);
    const v1Recues = v1.body.item.kpis.recues;

    await create({ lien_url: 'https://facebook.com/r/4', date_signalement: today });

    const v2 = await write(agent, csrf, 'post', '/api/reports/weekly/snapshot', { semaine: S });
    expect(v2.status).toBe(201);
    expect(v2.body.version).toBe(2);
    expect(v2.body.item.kpis.recues).toBe(v1Recues + 1);

    const frozen1 = await agent.get('/api/reports/weekly').query({ semaine: S, source: 'snapshot', version: 1 });
    expect(frozen1.status).toBe(200);
    expect(frozen1.body.item.kpis.recues).toBe(v1Recues);
    expect(frozen1.body.item.snapshot.version).toBe(1);

    const latest = await agent.get('/api/reports/weekly').query({ semaine: S, source: 'snapshot' });
    expect(latest.body.item.snapshot.version).toBe(2);

    const history = await agent.get('/api/reports/weekly/history').query({ semaine: S });
    expect(history.body.items).toHaveLength(2);
  });

  it('exporte le rapport en xlsx', async () => {
    const res = await agent.get('/api/reports/weekly/export').query({ semaine: S })
      .buffer(true)
      .parse((response, callback) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect(res.body.length).toBeGreaterThan(1000);
  });

  it('rejette une semaine invalide', async () => {
    const res = await agent.get('/api/reports/weekly').query({ semaine: '2026-02-30' });
    expect(res.status).toBe(400);
  });
});

describe('Fuseau et bornes', () => {
  it('ne décale pas la semaine (arithmétique UTC)', () => {
    expect(weekStart('2026-11-08', 0)).toBe('2026-11-08');
    expect(weekEnd('2026-11-08', 0)).toBe('2026-11-14');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});
