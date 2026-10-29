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

describe('Stats API', () => {
  let agent;
  let refs;

  beforeAll(async () => {
    const now = new Date().toISOString();
    db.prepare('INSERT INTO users (username, full_name, password_hash, role, active, must_change_password, created_at, updated_at) VALUES (?, ?, ?, ?, 1, 0, ?, ?)').run('stats_admin', 'Stats Admin', bcrypt.hashSync('Password123!', 12), 'admin', now, now);
    const agentRef = request.agent(app);
    const loginRes = await agentRef.post('/api/auth/login').send({ username: 'stats_admin', password: 'Password123!' });
    expect(loginRes.status).toBe(200);
    agent = agentRef;

    const daira = db.prepare('INSERT INTO dairas (name_fr, name_ar, actif) VALUES (?, ?, 1)').run('Daia Stats', 'daia_stats_ar');
    const dairaId = Number(daira.lastInsertRowid);
    const commune = db.prepare('INSERT INTO communes (daira_id, name_fr, name_ar, actif) VALUES (?, ?, ?, 1)').run(dairaId, 'Commune Stats', 'commune_stats_ar');
    const communeId = Number(commune.lastInsertRowid);
    const epic = db.prepare('INSERT INTO epics (name, sigle, contact_nom, contact_tel, actif) VALUES (?, ?, ?, ?, 1)').run('EPIC Stats', 'EPCS', 'Contact', '0500000000');
    const epicId = Number(epic.lastInsertRowid);
    const domaine = db.prepare('SELECT id FROM domaines ORDER BY id LIMIT 1').get();
    const type = db.prepare('SELECT id, domaine_id FROM types_anomalie WHERE domaine_id = ? ORDER BY id LIMIT 1').get(domaine.id);

    refs = { dairaId, communeId, epicId, domaineId: domaine.id, typeId: type.id };
  });

  it('GET /api/stats/summary -> totaux et taux de traitement', async () => {
    const created1 = await agent.post('/api/anomalies').send({
      plateforme: 'facebook',
      lienUrl: 'https://facebook.com/watch?v=stats1',
      domaineId: refs.domaineId,
      typeId: refs.typeId,
      dairaId: refs.dairaId,
      communeId: refs.communeId,
      statut: 'traite',
      epicId: refs.epicId,
      dateTraitement: new Date().toISOString().slice(0, 10),
    });
    expect(created1.status).toBe(201);

    const created2 = await agent.post('/api/anomalies').send({
      plateforme: 'tiktok',
      lienUrl: 'https://tiktok.com/@user/video/2',
      domaineId: refs.domaineId,
      typeId: refs.typeId,
      dairaId: refs.dairaId,
      communeId: refs.communeId,
      statut: 'non_traite',
    });
    expect(created2.status).toBe(201);

    const res = await agent.get('/api/stats/summary');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.parStatut.traite).toBe(1);
    expect(res.body.parStatut.non_traite).toBe(1);
    expect(res.body.tauxTraitement).toBe(50);
  });

  it('GET /api/stats/by-platform -> retourne les plateformes presentes', async () => {
    const res = await agent.get('/api/stats/by-platform');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/stats/weekly -> retourne 12 semaines', async () => {
    const res = await agent.get('/api/stats/weekly?weeks=12');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(12);
    expect(res.body.data[0]).toHaveProperty('received');
    expect(res.body.data[0]).toHaveProperty('treated');
  });
});
