import { describe, it, expect, beforeAll } from 'vitest';
import { addDays, todayAlgiers } from '@anm/shared';
import { createApp } from '../src/app.js';
import { freshDatabase, login, write, anomalyPayload } from './helpers.js';

let app;
let refs;
let agent;
let csrf;
const today = todayAlgiers();
const day = (offset) => addDays(today, offset);
const from = day(-3);

async function createPayload(overrides) {
  const res = await write(agent, csrf, 'post', '/api/anomalies', anomalyPayload(refs, overrides));
  if (res.status !== 201) throw new Error(`Création échouée ${res.status}: ${JSON.stringify(res.body)}`);
  return res.body.item;
}

beforeAll(async () => {
  ({ refs } = freshDatabase());
  app = createApp();
  ({ agent, csrf } = await login(app, 'admin'));

  await createPayload({ lien_url: 'https://facebook.com/a/1', date_signalement: day(-3), priorite: 'urgente' });

  await createPayload({
    lien_url: 'https://facebook.com/a/2', date_signalement: day(-3),
    verification: 'confirmee', agent_id: refs.agentId, statut: 'en_cours',
    epic_id: refs.epicId, date_intervention: day(-2),
  });

  await createPayload({
    lien_url: 'https://facebook.com/a/3', date_signalement: day(-2),
    verification: 'confirmee', agent_id: refs.agentId, statut: 'traite',
    epic_id: refs.epicId, date_intervention: day(-1), date_traitement: today,
  });

  const inferred = await createPayload({ lien_url: 'https://facebook.com/a/4', date_signalement: day(-1) });
  const res = await write(agent, csrf, 'post', `/api/anomalies/${inferred.id}/verification`, {
    version: inferred.version, verification: 'infirmee', agent_id: refs.agentId, motif: 'Introuvable',
  });
  if (res.status !== 200) throw new Error('Infirmation échouée');

  // Reçue hors période mais traitée dans la période : compte dans le délai moyen, pas dans la cohorte.
  await createPayload({
    lien_url: 'https://facebook.com/a/5', date_signalement: day(-20),
    verification: 'confirmee', agent_id: refs.agentId, statut: 'traite',
    epic_id: refs.epicId, date_intervention: day(-1), date_traitement: today,
  });

  // Ouverte ancienne : compte dans « en retard » toutes périodes.
  await createPayload({ lien_url: 'https://facebook.com/a/6', date_signalement: day(-10) });
});

describe('Tableau de bord', () => {
  it('calcule la cohorte, les pourcentages et le délai moyen sur les traitées de la période', async () => {
    const res = await agent.get('/api/stats/overview').query({ from, to: today });
    expect(res.status).toBe(200);
    const item = res.body.item;
    expect(item.cohorte).toMatchObject({ total: 3, non_traite: 1, en_cours: 1, traite: 1 });
    const sum = item.cohorte.pct_non_traite + item.cohorte.pct_en_cours + item.cohorte.pct_traite;
    expect(Math.round(sum * 10) / 10).toBe(100);
    expect(item.taux_traitement).toBeCloseTo(1 / 3, 4);
    // C (2 jours) + E (20 jours, reçue hors période) => 11 jours.
    expect(item.delai_moyen_jours).toBe(11);
    expect(item.urgentes_ouvertes).toBe(1);
    expect(item.en_retard).toBe(1);
    expect(item.previous).toBeTruthy();
  });

  it('retourne une période vide sans division par zéro', async () => {
    const res = await agent.get('/api/stats/overview').query({ from: day(-100), to: day(-90) });
    expect(res.status).toBe(200);
    expect(res.body.item.cohorte.total).toBe(0);
    expect(res.body.item.cohorte.pct_non_traite).toBeNull();
    expect(res.body.item.taux_traitement).toBeNull();
    expect(res.body.item.delai_moyen_jours).toBeNull();
  });
});

describe('Groupes et chronologie', () => {
  it('groupe par domaine avec totaux et pourcentages cohérents', async () => {
    const res = await agent.get('/api/stats/group').query({ by: 'domaine', from, to: today });
    expect(res.status).toBe(200);
    const body = res.body.item;
    expect(body.totals.total).toBe(3);
    expect(body.rows.reduce((n, r) => n + r.total, 0)).toBe(3);
    const pctSum = body.totals.pct_non_traite + body.totals.pct_en_cours + body.totals.pct_traite;
    expect(Math.round(pctSum * 10) / 10).toBe(100);
  });

  it('inclut les lignes vides à la demande', async () => {
    const res = await agent.get('/api/stats/group').query({ by: 'daira', from, to: today, include_empty: '1' });
    expect(res.status).toBe(200);
    expect(res.body.item.rows.some((r) => r.total === 0)).toBe(true);
    const without = await agent.get('/api/stats/group').query({ by: 'daira', from, to: today });
    expect(without.body.item.rows.every((r) => r.total > 0)).toBe(true);
  });

  it('produit 12 semaines de chronologie', async () => {
    const res = await agent.get('/api/stats/timeline').query({ to: today });
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(12);
    expect(res.body.items[0]).toHaveProperty('debut');
    expect(res.body.items[0]).toHaveProperty('recues');
    expect(res.body.items[0]).toHaveProperty('traitees');
  });

  it('expose l’activité récente', async () => {
    const res = await agent.get('/api/stats/activite').query({ limit: 5 });
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items[0]).toHaveProperty('reference');
  });
});
