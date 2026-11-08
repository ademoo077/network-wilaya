import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../src/app.js';
import { freshDatabase, login, write, USERS, TEST_PASSWORD } from './helpers.js';
import { getDb } from '../src/db/index.js';

let app;
let agent;
let csrf;
let userIds;

beforeAll(async () => {
  const fresh = freshDatabase();
  userIds = fresh.userIds;
  app = createApp();
  ({ agent, csrf } = await login(app, 'admin'));
});

describe('Utilisateurs', () => {
  it('liste les comptes sans exposer les mots de passe', async () => {
    const res = await agent.get('/api/users');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThanOrEqual(3);
    expect(res.body.items[0].password_hash).toBeUndefined();
  });

  it('refuse un mot de passe faible et un identifiant en doublon', async () => {
    const weak = await write(agent, csrf, 'post', '/api/users', {
      username: 'faible', full_name: 'Compte Faible', role: 'lecteur', password: 'court',
    });
    expect(weak.status).toBe(400);
    expect(weak.body.error.code).toBe('VALIDATION');

    const duplicate = await write(agent, csrf, 'post', '/api/users', {
      username: USERS.lecteur.username, full_name: 'Doublon', role: 'lecteur', password: 'MotDePasse123!',
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('IDENTIFIANT_EXISTE');
  });

  it('crée un compte avec changement de mot de passe forcé', async () => {
    const res = await write(agent, csrf, 'post', '/api/users', {
      username: 'nouveau', full_name: 'Nouveau Compte', role: 'operateur', password: 'MotDePasse123!',
    });
    expect(res.status).toBe(201);
    expect(res.body.item.username).toBe('nouveau');
    expect(res.body.item.must_change_password).toBe(1);
    expect(res.body.item.password_hash).toBeUndefined();
  });

  it('protège le dernier administrateur actif et sa propre désactivation', async () => {
    const demote = await write(agent, csrf, 'patch', `/api/users/${userIds.admin}`, { role: 'operateur' });
    expect(demote.status).toBe(409);
    expect(demote.body.error.code).toBe('DERNIER_ADMIN');

    const second = await write(agent, csrf, 'post', '/api/users', {
      username: 'second_admin', full_name: 'Second Admin', role: 'admin', password: 'MotDePasse123!',
    });
    expect(second.status).toBe(201);

    const self = await write(agent, csrf, 'patch', `/api/users/${userIds.admin}`, { actif: 0 });
    expect(self.status).toBe(409);
    expect(self.body.error.code).toBe('AUTO_DESACTIVATION');
  });

  it('met à jour un compte et réinitialise son mot de passe', async () => {
    const updated = await write(agent, csrf, 'patch', `/api/users/${userIds.lecteur}`, {
      full_name: 'Lecteur Renommé', role: 'lecteur', actif: 1,
    });
    expect(updated.status).toBe(200);
    expect(updated.body.item.full_name).toBe('Lecteur Renommé');

    const reset = await write(agent, csrf, 'post', `/api/users/${userIds.operateur}/reset-password`, {});
    expect(reset.status).toBe(200);
    expect(reset.body.item.password).toBeTruthy();
    expect(reset.body.item.must_change_password).toBe(1);

    const sessions = getDb().prepare('SELECT COUNT(*) AS c FROM sessions WHERE user_id = ?').get(userIds.operateur).c;
    expect(sessions).toBe(0);
  });
});

describe('Paramètres', () => {
  function validParams(overrides = {}) {
    return {
      nom_cellule: 'Cellule de test',
      week_start_day: 1,
      delai_retard_jours: 10,
      exiger_verification: 1,
      tile_url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      backup_retention_days: 45,
      gps_bbox: '36.40,2.50,36.95,3.40',
      ...overrides,
    };
  }

  it('refuse un modèle de tuiles ou une bbox invalide', async () => {
    const tile = await write(agent, csrf, 'put', '/api/settings', validParams({ tile_url: 'https://exemple.dz/tiles/{z}.png' }));
    expect(tile.status).toBe(400);
    expect(tile.body.error.fields.tile_url).toBeTruthy();

    const bbox = await write(agent, csrf, 'put', '/api/settings', validParams({ gps_bbox: '36.40;2.50' }));
    expect(bbox.status).toBe(400);
  });

  it('applique les paramètres et les expose publiquement', async () => {
    const res = await write(agent, csrf, 'put', '/api/settings', validParams());
    expect(res.status).toBe(200);
    expect(res.body.item.nom_cellule).toBe('Cellule de test');
    expect(res.body.item.week_start_day).toBe('1');

    const lecteur = await login(app, 'lecteur', TEST_PASSWORD);
    const publicRes = await lecteur.agent.get('/api/settings');
    expect(publicRes.status).toBe(200);
    expect(publicRes.body.item.nom_cellule).toBe('Cellule de test');
    expect(publicRes.body.item.exiger_verification).toBeUndefined();
    expect(publicRes.body.item.backup_retention_days).toBeUndefined();
  });

  it('journalise la mise à jour dans l’audit', async () => {
    const res = await agent.get('/api/admin/audit').query({ action: 'PARAM_UPDATE' });
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
  });
});
