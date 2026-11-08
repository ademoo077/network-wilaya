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

beforeAll(async () => {
  ({ refs } = freshDatabase());
  app = createApp();
  ({ agent, csrf } = await login(app, 'admin'));
});

async function create(payload) {
  const res = await write(agent, csrf, 'post', '/api/anomalies', payload);
  return res;
}

async function transition(id, body, endpoint = 'statut') {
  return write(agent, csrf, 'post', `/api/anomalies/${id}/${endpoint}`, body);
}

describe('Création et doublons', () => {
  let first;

  it('crée une anomalie avec référence séquentielle et URL normalisée', async () => {
    const res = await create(anomalyPayload(refs, {
      lien_url: 'https://www.facebook.com/watch/?v=123456&utm_source=test&fbclid=abc#fragment',
      date_signalement: day(-5),
    }));
    expect(res.status).toBe(201);
    first = res.body.item;
    expect(first.reference).toMatch(/^ANM-\d{4}-00001$/);
    expect(first.plateforme).toBe('facebook');
    expect(first.lien_normalise).toBe('https://facebook.com/watch?v=123456');
    expect(first.statut).toBe('non_traite');
    expect(first.version).toBe(1);
  });

  it('avertit DUPLICATE_LINK puis accepte une autre anomalie du même lien', async () => {
    const sameLink = await create(anomalyPayload(refs, {
      lien_url: 'https://facebook.com/watch/?v=123456', date_signalement: day(-5),
      daira_id: refs.otherDairaId, commune_id: refs.otherCommuneId,
    }));
    expect(sameLink.status).toBe(409);
    expect(sameLink.body.error.code).toBe('DUPLICATE_LINK');
    expect(sameLink.body.error.details.length).toBeGreaterThan(0);
    const forced = await create(anomalyPayload(refs, {
      lien_url: 'https://facebook.com/watch/?v=123456', date_signalement: day(-4),
      daira_id: refs.otherDairaId, commune_id: refs.otherCommuneId, force_duplicate: true,
    }));
    expect(forced.status).toBe(201);
  });

  it('refuse DUPLICATE_STRICT même avec force_duplicate', async () => {
    const res = await create(anomalyPayload(refs, {
      lien_url: 'https://facebook.com/watch/?v=123456', date_signalement: day(-3), force_duplicate: true,
    }));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_STRICT');
  });

  it('contrôle le lien en direct', async () => {
    const res = await agent.get(`/api/anomalies/check-link?url=${encodeURIComponent('https://m.facebook.com/watch/?v=123456&si=x')}`);
    expect(res.status).toBe(200);
    expect(res.body.item.matches.length).toBeGreaterThanOrEqual(2);
  });

  it('refuse type hors catégorie et commune hors daïra', async () => {
    const badType = await create(anomalyPayload(refs, { type_id: refs.otherTypeId, lien_url: 'https://x.com/a/1' }));
    expect(badType.status).toBe(422);
    expect(badType.body.error.code).toBe('INTEGRITE_TYPE');
    const badCommune = await create(anomalyPayload(refs, { daira_id: refs.otherDairaId, lien_url: 'https://x.com/a/2' }));
    expect(badCommune.status).toBe(422);
    expect(badCommune.body.error.code).toBe('INTEGRITE_COMMUNE');
  });

  it('refuse une URL dangereuse', async () => {
    const res = await create(anomalyPayload(refs, { lien_url: 'javascript:alert(1)' }));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('LIEN_INVALIDE');
  });
});

describe('Transitions de vérification et de statut', () => {
  let id;
  let version = 1;

  it('crée une fiche à vérifier', async () => {
    const res = await create(anomalyPayload(refs, {
      lien_url: 'https://www.tiktok.com/@user/video/1', date_signalement: day(-5),
    }));
    expect(res.status).toBe(201);
    id = res.body.item.id;
  });

  it('refuse « en cours » sans vérification confirmée', async () => {
    const res = await transition(id, {
      version, statut: 'en_cours', epic_id: refs.epicId, date_intervention: day(-2),
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VERIFICATION_REQUISE');
  });

  it('confirme avec agent puis passe en cours puis traité', async () => {
    const confirmed = await transition(id, {
      version, verification: 'confirmee', agent_id: refs.agentId,
    }, 'verification');
    expect(confirmed.status).toBe(200);
    version = confirmed.body.item.version;

    const inProgress = await transition(id, {
      version, statut: 'en_cours', epic_id: refs.epicId, date_intervention: day(-2),
    });
    expect(inProgress.status).toBe(200);
    expect(inProgress.body.item.date_traitement).toBeNull();
    version = inProgress.body.item.version;

    const done = await transition(id, {
      version, statut: 'traite', date_traitement: day(-1),
    });
    expect(done.status).toBe(200);
    expect(done.body.item.statut).toBe('traite');
    expect(done.body.item.date_intervention).toBe(day(-2));
    expect(done.body.item.date_traitement).toBe(day(-1));
    version = done.body.item.version;

    const history = await agent.get(`/api/anomalies/${id}/historique`);
    const fields = history.body.items.map((h) => h.champ);
    expect(fields).toContain('creation');
    expect(fields.filter((f) => f === 'statut').length).toBeGreaterThanOrEqual(2);
    expect(history.body.items.every((h) => h.at && h.user_nom)).toBe(true);
  });

  it('refuse la réouverture sans motif, l’accepte avec motif', async () => {
    const noMotif = await transition(id, { version, statut: 'en_cours', date_intervention: day(-1) });
    expect(noMotif.status).toBe(422);
    expect(noMotif.body.error.code).toBe('MOTIF_REQUIS');
    const reopened = await transition(id, { version, statut: 'en_cours', motif: 'Réouverture demandée' });
    expect(reopened.status).toBe(200);
    expect(reopened.body.item.statut).toBe('en_cours');
    expect(reopened.body.item.date_traitement).toBeNull();
    version = reopened.body.item.version;
  });

  it('détecte un conflit de version', async () => {
    const current = await agent.get(`/api/anomalies/${id}`);
    const stale = current.body.item.version;
    const first = await write(agent, csrf, 'patch', `/api/anomalies/${id}`, { version: stale, observations: 'Première édition' });
    expect(first.status).toBe(200);
    const second = await write(agent, csrf, 'patch', `/api/anomalies/${id}`, { version: stale, observations: 'Seconde édition' });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('VERSION_CONFLICT');
    version = first.body.item.version;
  });

  it('infirme : statut forcé non traité, EPIC effacé, motif obligatoire', async () => {
    const reset = await transition(id, { version, statut: 'non_traite', motif: 'Remise à zéro' });
    expect(reset.status).toBe(200);
    version = reset.body.item.version;
    const noMotif = await transition(id, { version, verification: 'infirmee', agent_id: refs.agentId }, 'verification');
    expect(noMotif.status).toBe(422);
    expect(noMotif.body.error.code).toBe('MOTIF_REQUIS');
    const inferred = await transition(id, {
      version, verification: 'infirmee', agent_id: refs.agentId, motif: 'Non constatée sur place',
    }, 'verification');
    expect(inferred.status).toBe(200);
    expect(inferred.body.item.statut).toBe('non_traite');
    expect(inferred.body.item.epic_id).toBeNull();
    expect(inferred.body.item.date_verification).toBeTruthy();
    version = inferred.body.item.version;
    const forbidden = await transition(id, { version, statut: 'en_cours', epic_id: refs.epicId });
    expect(forbidden.status).toBe(422);
    expect(forbidden.body.error.code).toBe('STATUT_INFIRMEE');
  });

  it('exclut les infirmées des statistiques sauf option explicite', async () => {
    const reference = (await agent.get(`/api/anomalies/${id}`)).body.item.reference;
    const excluded = await agent.get('/api/stats/overview').query({ all_periods: '1', q: reference });
    expect(excluded.status).toBe(200);
    expect(excluded.body.item.cohorte.total).toBe(0);
    const included = await agent.get('/api/stats/overview').query({ all_periods: '1', q: reference, include_infirmees: '1' });
    expect(included.body.item.cohorte.total).toBe(1);
  });
});

describe('Suppression logique et corbeille', () => {
  let id;

  it('supprime puis restaure une fiche', async () => {
    const created = await create(anomalyPayload(refs, {
      lien_url: 'https://youtu.be/abc', date_signalement: day(-2),
    }));
    id = created.body.item.id;
    const del = await write(agent, csrf, 'delete', `/api/anomalies/${id}`, { motif: 'Doublon' });
    expect(del.status).toBe(200);
    const get = await agent.get(`/api/anomalies/${id}`);
    expect(get.status).toBe(404);
    const list = await agent.get('/api/anomalies');
    expect(list.body.items.some((item) => item.id === id)).toBe(false);
    const trash = await agent.get('/api/anomalies?corbeille=1');
    expect(trash.body.items.some((item) => item.id === id)).toBe(true);
    const restored = await write(agent, csrf, 'post', `/api/anomalies/${id}/restore`);
    expect(restored.status).toBe(200);
    const after = await agent.get(`/api/anomalies/${id}`);
    expect(after.status).toBe(200);
  });
});
