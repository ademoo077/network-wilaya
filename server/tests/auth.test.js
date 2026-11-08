import { describe, it, expect, beforeAll } from 'vitest';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { freshDatabase, TEST_PASSWORD, USERS, login, write } from './helpers.js';
import { getDb } from '../src/db/index.js';

let app;

beforeAll(() => {
  freshDatabase();
  app = createApp();
});

describe('Santé et session', () => {
  it('GET /api/health répond ok avec la version', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, db: true, version: '5.0.0' });
  });

  it('refuse un identifiant inconnu avec un message générique', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'inconnu_xyz', password: 'Password123!' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('IDENTIFIANTS_INVALIDES');
    expect(res.body.error.message).toBe('Identifiant ou mot de passe incorrect');
  });

  it('connecte, expose le jeton CSRF et /me', async () => {
    const { agent, csrf, user } = await login(app);
    expect(csrf).toBeTruthy();
    expect(user.role).toBe('admin');
    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.username).toBe(USERS.admin.username);
    expect(me.body.csrf).toBe(csrf);
  });

  it('invalide la session à la déconnexion', async () => {
    const { agent, csrf } = await login(app);
    const out = await write(agent, csrf, 'post', '/api/auth/logout');
    expect(out.status).toBe(200);
    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(401);
  });

  it('refuse une écriture sans jeton CSRF', async () => {
    const { agent } = await login(app);
    const res = await agent.post('/api/anomalies').send({});
    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/CSRF/);
  });

  it('accepte une écriture avec jeton CSRF (validation métier ensuite)', async () => {
    const { agent, csrf } = await login(app);
    const res = await write(agent, csrf, 'post', '/api/anomalies', {});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION');
  });
});

describe('Verrouillage et mot de passe', () => {
  it('verrouille 15 min après 5 échecs', async () => {
    const db = getDb();
    db.prepare(`INSERT INTO users(username, full_name, password_hash, role, actif, must_change_password)
                VALUES ('lockme', 'Lock Me', ?, 'operateur', 1, 0)`).run(bcrypt.hashSync(TEST_PASSWORD, 4));
    for (let i = 0; i < 5; i += 1) {
      const res = await request(app).post('/api/auth/login').send({ username: 'lockme', password: 'Mauvais123!' });
      expect(res.status).toBe(401);
    }
    const row = db.prepare("SELECT failed_attempts, locked_until FROM users WHERE username = 'lockme'").get();
    expect(row.failed_attempts).toBe(5);
    expect(row.locked_until).toBeTruthy();
    const blocked = await request(app).post('/api/auth/login').send({ username: 'lockme', password: TEST_PASSWORD });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('COMPTE_VERROUILLE');
  });

  it('change le mot de passe et détruit les sessions existantes', async () => {
    const { agent, csrf } = await login(app, 'operateur');
    const wrong = await write(agent, csrf, 'post', '/api/auth/change-password', { current: 'Mauvais123!', next: 'NouveauPass123' });
    expect(wrong.status).toBe(400);
    const ok = await write(agent, csrf, 'post', '/api/auth/change-password', { current: TEST_PASSWORD, next: 'NouveauPass123' });
    expect(ok.status).toBe(200);
    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(401);
    const after = await request(app).post('/api/auth/login').send({ username: USERS.operateur.username, password: 'NouveauPass123' });
    expect(after.status).toBe(200);
    const old = await request(app).post('/api/auth/login').send({ username: USERS.operateur.username, password: TEST_PASSWORD });
    expect(old.status).toBe(401);
  });
});
