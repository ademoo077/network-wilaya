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

describe('Reports API', () => {
  let agent;

  beforeAll(async () => {
    const now = new Date().toISOString();
    db.prepare('INSERT INTO users (username, full_name, password_hash, role, active, must_change_password, created_at, updated_at) VALUES (?, ?, ?, ?, 1, 0, ?, ?)').run('report_admin', 'Report Admin', bcrypt.hashSync('Password123!', 12), 'admin', now, now);
    const agentRef = request.agent(app);
    const loginRes = await agentRef.post('/api/auth/login').send({ username: 'report_admin', password: 'Password123!' });
    expect(loginRes.status).toBe(200);
    agent = agentRef;
  });

  it('GET /api/reports/weekly -> rapport avec KPI', async () => {
    const res = await agent.get('/api/reports/weekly');
    expect(res.status).toBe(200);
    expect(res.body.report).toBeDefined();
    expect(res.body.report.semaine_debut).toBeDefined();
    expect(res.body.report.semaine_fin).toBeDefined();
    expect(res.body.report.kpis).toBeDefined();
    expect(res.body.report.kpis.total).toBe(0);
  });

  it('POST /api/reports/weekly/snapshot -> cree un snapshot', async () => {
    const res = await agent.post('/api/reports/weekly/snapshot').send({ week_start: new Date().toISOString().slice(0, 10) });
    expect(res.status).toBe(201);
    expect(res.body.snapshot).toBeDefined();
  });

  it('GET /api/reports/weekly/history -> liste les snapshots', async () => {
    const res = await agent.get('/api/reports/weekly/history');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
