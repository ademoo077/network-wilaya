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
  const counts = seedTaxonomy();
  console.log('[tests] seed:', JSON.stringify(counts));
});

describe('GET /api/health', () => {
  it('repond 200 avec ok=true', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe('Auth', () => {
  it('login avec identifiants inconnus -> 401', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'utilisateur_inconnu_xyz', password: 'wrongpass123' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('login admin -> 200 + user, puis /auth/me -> 200', async () => {
    const username = 'admin_test';
    const password = 'Password123!';
    const now = new Date().toISOString();
    db.prepare('INSERT INTO users (username, full_name, password_hash, role, active, must_change_password, created_at, updated_at) VALUES (?, ?, ?, ?, 1, 0, ?, ?)').run(username, 'Admin Test', bcrypt.hashSync(password, 12), 'admin', now, now);

    const agent = request.agent(app);
    const loginRes = await agent.post('/api/auth/login').send({ username, password });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.user.username).toBe('admin_test');

    const meRes = await agent.get('/api/auth/me');
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.role).toBe('admin');
  });

  it('sans session -> /auth/me -> 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});
