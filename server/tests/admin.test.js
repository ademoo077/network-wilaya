import { describe, it, expect, beforeAll } from 'vitest';
import { todayAlgiers } from '@anm/shared';
import { createApp } from '../src/app.js';
import { freshDatabase, login, write, anomalyPayload } from './helpers.js';
import { getDb } from '../src/db/index.js';

let app;
let refs;
let agent;
let csrf;
const today = todayAlgiers();

async function create(marker) {
  const res = await write(agent, csrf, 'post', '/api/anomalies', anomalyPayload(refs, {
    lien_url: `https://example.dz/sauvegarde/${marker}`,
    date_signalement: today,
    observations: marker,
  }));
  if (res.status !== 201) throw new Error(`Création échouée : ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.item;
}

beforeAll(async () => {
  ({ refs } = freshDatabase());
  app = createApp();
  ({ agent, csrf } = await login(app, 'admin'));
});

describe('Sauvegardes', () => {
  let backupName;
  let avant;

  it('crée une sauvegarde manuelle listée et téléchargeable', async () => {
    avant = await create('AVANT');
    const res = await write(agent, csrf, 'post', '/api/admin/backups');
    expect(res.status).toBe(201);
    backupName = res.body.item.nom;
    expect(backupName).toMatch(/^anomalies-\d{8}-\d{6}-manuelle\.db$/);

    const list = await agent.get('/api/admin/backups');
    expect(list.status).toBe(200);
    expect(list.body.items.some((b) => b.nom === backupName)).toBe(true);
    expect(list.body.schemaVersion).toBeGreaterThanOrEqual(1);

    const download = await agent.get(`/api/admin/backups/${backupName}/download`);
    expect(download.status).toBe(200);
    expect(download.headers['content-disposition']).toContain(backupName);
  });

  it('refuse un nom invalide et une confirmation erronée', async () => {
    expect((await agent.get('/api/admin/backups/evil.db/download')).status).toBe(400);
    const bad = await write(agent, csrf, 'post', `/api/admin/backups/${backupName}/restore`, { confirm: 'oui' });
    expect(bad.status).toBe(400);
    expect((await agent.get('/api/anomalies').query({ q: 'APRES' })).body.total).toBe(0);
  });

  it('restaure la sauvegarde et revient à l’état antérieur', async () => {
    await create('APRES');
    expect((await agent.get('/api/anomalies').query({ q: 'APRES' })).body.total).toBe(1);

    const res = await write(agent, csrf, 'post', `/api/admin/backups/${backupName}/restore`, { confirm: 'RESTAURER' });
    expect(res.status).toBe(200);
    expect(res.body.item.nom).toBe(backupName);
    expect(res.body.item.securite).toMatch(/-securite\.db$/);

    const after = await agent.get('/api/anomalies').query({ q: 'APRES' });
    expect(after.status).toBe(200);
    expect(after.body.total).toBe(0);
    expect((await agent.get('/api/anomalies').query({ q: 'AVANT' })).body.total).toBe(1);
    expect(getDb().prepare('SELECT id FROM anomalies WHERE id = ?').get(avant.id)).toBeTruthy();
  });

  it('journalise création et restauration, puis supprime la sauvegarde', async () => {
    const audit = await agent.get('/api/admin/audit').query({ action: 'BACKUP_RESTORE' });
    expect(audit.status).toBe(200);
    expect(audit.body.total).toBeGreaterThanOrEqual(1);

    const del = await write(agent, csrf, 'delete', `/api/admin/backups/${backupName}`);
    expect(del.status).toBe(200);
    expect(del.body.ok).toBe(true);
    const list = await agent.get('/api/admin/backups');
    expect(list.body.items.some((b) => b.nom === backupName)).toBe(false);
  });
});

describe('Journal d’audit', () => {
  it('filtre par action et exporte un CSV avec BOM', async () => {
    const filtered = await agent.get('/api/admin/audit').query({ action: 'ANOMALIE_CREATE', pageSize: 10 });
    expect(filtered.status).toBe(200);
    expect(filtered.body.total).toBeGreaterThanOrEqual(1);
    expect(filtered.body.items.every((row) => row.action === 'ANOMALIE_CREATE')).toBe(true);

    const csv = await agent.get('/api/admin/audit/export');
    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text.startsWith('\uFEFF')).toBe(true);
    expect(csv.text).toContain('"Action"');
  });
});
