import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import db from '../src/db/database.js';
import { runMigrations } from '../src/db/migrations/index.js';
import { seedTaxonomy } from '../src/db/seed.js';

const app = createApp();

beforeAll(() => {
  runMigrations();
  seedTaxonomy();
  db.prepare('DELETE FROM anomalie_historique').run();
  db.prepare('DELETE FROM pieces_jointes').run();
  db.prepare('DELETE FROM anomalies').run();
  db.prepare('DELETE FROM users').run();
});

describe('Anomalies API', () => {
  let agent;
  let refs;

  beforeAll(async () => {
    const now = new Date().toISOString();
    db.prepare('INSERT INTO users (username, full_name, password_hash, role, active, must_change_password, created_at, updated_at) VALUES (?, ?, ?, ?, 1, 0, ?, ?)').run('operateur_test', 'Operateur Test', bcrypt.hashSync('Password123!', 12), 'operateur', now, now);

    const agentRef = request.agent(app);
    const loginRes = await agentRef.post('/api/auth/login').send({ username: 'operateur_test', password: 'Password123!' });
    expect(loginRes.status).toBe(200);
    agent = agentRef;

    const daira = db.prepare('INSERT INTO dairas (name_fr, name_ar, actif) VALUES (?, ?, 1)').run('Daia Test', 'daia_test_ar');
    const dairaId = Number(daira.lastInsertRowid);
    const commune = db.prepare('INSERT INTO communes (daira_id, name_fr, name_ar, actif) VALUES (?, ?, ?, 1)').run(dairaId, 'Commune Test', 'commune_test_ar');
    const communeId = Number(commune.lastInsertRowid);
    const epic = db.prepare('INSERT INTO epics (name, sigle, contact_nom, contact_tel, actif) VALUES (?, ?, ?, ?, 1)').run('EPIC Test', 'EPCT', 'Contact', '0500000000');
    const epicId = Number(epic.lastInsertRowid);
    const domaine = db.prepare('SELECT id FROM domaines ORDER BY id LIMIT 1').get();
    const type = db.prepare('SELECT id, domaine_id FROM types_anomalie WHERE domaine_id = ? ORDER BY id LIMIT 1').get(domaine.id);

    refs = { dairaId, communeId, epicId, domaineId: domaine.id, typeId: type.id };
  });

  it('POST /api/anomalies -> 201 cree une anomalie', async () => {
    const res = await agent.post('/api/anomalies').send({
      plateforme: 'facebook',
      lienUrl: 'https://facebook.com/watch?v=abc123',
      domaineId: refs.domaineId,
      typeId: refs.typeId,
      dairaId: refs.dairaId,
      communeId: refs.communeId,
      adresseTexte: 'Rue Test',
      statut: 'non_traite',
    });
    expect(res.status).toBe(201);
    expect(res.body.anomaly.reference).toMatch(/^ANM-\d{4}-\d{5}$/);
  });

  it('POST /api/anomalies -> 400 INTEGRITY si le type n appartient pas au domaine', async () => {
    const otherDomaine = db.prepare('SELECT id FROM domaines WHERE id != ? ORDER BY id LIMIT 1').get(refs.domaineId);
    const otherType = db.prepare('SELECT id FROM types_anomalie WHERE domaine_id = ? ORDER BY id LIMIT 1').get(otherDomaine.id);
    const res = await agent.post('/api/anomalies').send({
      plateforme: 'youtube',
      lienUrl: 'https://youtube.com/watch?v=xyz',
      domaineId: refs.domaineId,
      typeId: otherType.id,
      dairaId: refs.dairaId,
      communeId: refs.communeId,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INTEGRITY');
  });

  it('POST /api/anomalies -> 400 si statut=traite sans EPIC', async () => {
    const res = await agent.post('/api/anomalies').send({
      plateforme: 'tiktok',
      lienUrl: 'https://tiktok.com/@user/video/1',
      domaineId: refs.domaineId,
      typeId: refs.typeId,
      dairaId: refs.dairaId,
      communeId: refs.communeId,
      statut: 'traite',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INTEGRITY');
  });

  it('GET /api/anomalies/check-duplicate -> true pour un lien normalise existant', async () => {
    const res = await agent.get('/api/anomalies/check-duplicate?url=' + encodeURIComponent('https://facebook.com/watch?v=abc123&utm_source=fb'));
    expect(res.status).toBe(200);
    expect(res.body.duplicate).toBe(true);
  });

  it('GET /api/anomalies/check-duplicate -> false pour un lien inconnu', async () => {
    const res = await agent.get('/api/anomalies/check-duplicate?url=' + encodeURIComponent('https://facebook.com/watch?v=inconnu999'));
    expect(res.status).toBe(200);
    expect(res.body.duplicate).toBe(false);
  });

  it('GET /api/anomalies -> pagination + total', async () => {
    const created = [];
    for (let i = 0; i < 3; i += 1) {
      const res = await agent.post('/api/anomalies').send({
        plateforme: 'whatsapp',
        lienUrl: `https://wa.me/21260000${i}`,
        domaineId: refs.domaineId,
        typeId: refs.typeId,
        dairaId: refs.dairaId,
        communeId: refs.communeId,
        statut: 'non_traite',
      });
      expect(res.status).toBe(201);
      created.push(res.body.anomaly.id);
    }
    const page1 = await agent.get('/api/anomalies?page=1&pageSize=2');
    expect(page1.status).toBe(200);
    expect(page1.body.data.length).toBe(2);
    expect(page1.body.pagination.total).toBeGreaterThanOrEqual(3);
    expect(page1.body.pagination.totalPages).toBeGreaterThanOrEqual(2);

    const page2 = await agent.get('/api/anomalies?page=2&pageSize=2');
    expect(page2.status).toBe(200);
    expect(page2.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('POST /api/anomalies/bulk-status -> maj statut + ecriture historique', async () => {
    const createRes = await agent.post('/api/anomalies').send({
      plateforme: 'x',
      lienUrl: 'https://x.com/user/status/42',
      domaineId: refs.domaineId,
      typeId: refs.typeId,
      dairaId: refs.dairaId,
      communeId: refs.communeId,
      statut: 'non_traite',
    });
    expect(createRes.status).toBe(201);
    const anomalyId = createRes.body.anomaly.id;

    const bulk = await agent.post('/api/anomalies/bulk-status').send({ ids: [anomalyId], statut: 'en_cours', epicId: refs.epicId });
    expect(bulk.status).toBe(200);

    const getRes = await agent.get(`/api/anomalies/${anomalyId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.anomaly.statut).toBe('en_cours');
    expect(getRes.body.anomaly.epic_id).toBe(refs.epicId);

    const histo = await agent.get(`/api/anomalies/${anomalyId}/historique`);
    expect(histo.status).toBe(200);
    expect(histo.body.data.length).toBeGreaterThanOrEqual(1);
    expect(histo.body.data[0].champ).toBe('statut');
  });
});
