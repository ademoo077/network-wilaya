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
  db.prepare('DELETE FROM rapports_hebdo').run();
  db.prepare('DELETE FROM audit_log').run();
  db.prepare('DELETE FROM users').run();
});

describe('Admin API', () => {
  let adminAgent;
  let operatorAgent;

  beforeAll(async () => {
    const now = new Date().toISOString();
    db.prepare('INSERT INTO users (username, full_name, password_hash, role, active, must_change_password, created_at, updated_at) VALUES (?, ?, ?, ?, 1, 0, ?, ?)').run('admin_test2', 'Admin Test 2', bcrypt.hashSync('Password123!', 12), 'admin', now, now);
    db.prepare('INSERT INTO users (username, full_name, password_hash, role, active, must_change_password, created_at, updated_at) VALUES (?, ?, ?, ?, 1, 0, ?, ?)').run('operateur_test2', 'Operateur Test 2', bcrypt.hashSync('Password123!', 12), 'operateur', now, now);

    adminAgent = request.agent(app);
    const adminLogin = await adminAgent.post('/api/auth/login').send({ username: 'admin_test2', password: 'Password123!' });
    expect(adminLogin.status).toBe(200);

    operatorAgent = request.agent(app);
    const operatorLogin = await operatorAgent.post('/api/auth/login').send({ username: 'operateur_test2', password: 'Password123!' });
    expect(operatorLogin.status).toBe(200);
  });

  it('GET /api/admin/audit -> 200 liste', async () => {
    const res = await adminAgent.get('/api/admin/audit');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/admin/audit -> 403 pour operateur', async () => {
    const res = await operatorAgent.get('/api/admin/audit');
    expect(res.status).toBe(403);
  });

  it('POST /api/admin/backup -> 201', async () => {
    const res = await adminAgent.post('/api/admin/backup');
    expect(res.status).toBe(201);
    expect(res.body.backup).toBeDefined();
  });

  it('GET /api/admin/backup -> 200 liste', async () => {
    const res = await adminAgent.get('/api/admin/backup');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/admin/anomalies/export?format=csv -> 200', async () => {
    const res = await adminAgent.get('/api/admin/anomalies/export?format=csv');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('reference');
  });

  it('GET /api/admin/anomalies/export?format=xlsx -> 200', async () => {
    const res = await adminAgent.get('/api/admin/anomalies/export?format=xlsx');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
  });

  it('GET /api/admin/anomalies/export sans format -> 400', async () => {
    const res = await adminAgent.get('/api/admin/anomalies/export');
    expect(res.status).toBe(400);
  });
});
