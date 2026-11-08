import { describe, it, expect, beforeAll } from 'vitest';
import { todayAlgiers } from '@anm/shared';
import { createApp } from '../src/app.js';
import { freshDatabase, login, write, anomalyPayload } from './helpers.js';

let app;
let refs;
let agent;
let csrf;
let names;
const today = todayAlgiers();

const quote = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const HEADER = 'lien_url,date_signalement,categorie,type,daira,commune,gps,adresse,priorite,verification,agent,statut,epic,date_intervention,date_traitement,observations';

function buildCsv(namesOverride = {}) {
  const local = { ...names, ...namesOverride };
  const rowFor = (values) => [
    values.lien, values.date, local.categorie, local.type, local.daira, local.commune,
    values.gps || '', values.adresse || '', '', '', '', '', '', '', '', values.observations || '',
  ].map(quote).join(',');
  const invalid = rowFor({ lien: 'https://example.dz/import/3', date: today, observations: 'ligne invalide' })
    .replace(quote(local.categorie), quote('Catégorie inconnue'));
  return [
    HEADER,
    rowFor({ lien: 'https://example.dz/import/1', date: today, gps: '36.7538, 3.0588', adresse: 'Adresse 1' }),
    rowFor({ lien: 'https://example.dz/import/2', date: today, adresse: 'Adresse 2' }),
    invalid,
  ].join('\r\n');
}

async function preview(buffer = buildCsv()) {  return agent.post('/api/anomalies/import/preview')
    .set('X-CSRF-Token', csrf)
    .attach('file', Buffer.from(buffer, 'utf8'), { filename: 'anomalies.csv', contentType: 'text/csv' });
}

beforeAll(async () => {
  const fresh = freshDatabase();
  refs = fresh.refs;
  app = createApp();
  ({ agent, csrf } = await login(app, 'admin'));
  const db = fresh.db;
  names = {
    categorie: db.prepare('SELECT name_ar FROM domaines WHERE id = ?').get(refs.domaineId).name_ar,
    type: db.prepare('SELECT name_ar FROM types_anomalie WHERE id = ?').get(refs.typeId).name_ar,
    daira: 'Daïra Test',
    commune: 'Commune Test',
  };
});

describe('Import CSV', () => {
  let importId;

  it('produit un aperçu avec lignes valides et erreurs explicites', async () => {
    const res = await preview();
    expect(res.status).toBe(200);
    const item = res.body.item;
    importId = item.importId;
    expect(item.summary).toMatchObject({ total: 3, ok: 2, warning: 0, error: 1 });
    expect(item.rows[0].statut).toBe('ok');
    expect(item.rows[2].statut).toBe('error');
    expect(item.rows[2].messages.join(' ')).toContain('Catégorie inconnue');
  });

  it('télécharge le modèle et le rapport d’erreurs', async () => {
    const template = await agent.get('/api/anomalies/import/template');
    expect(template.status).toBe(200);
    expect(template.text).toContain('lien_url');
    expect(template.text).toContain('date_traitement');

    const report = await agent.get(`/api/anomalies/import/report/${importId}`);
    expect(report.status).toBe(200);
    expect(report.headers['content-type']).toContain('text/csv');
    expect(report.text).toContain('Catégorie inconnue');
  });

  it('importe seulement les lignes valides', async () => {
    const res = await write(agent, csrf, 'post', '/api/anomalies/import/commit', {
      importId, mode: 'valid_only',
    });
    expect(res.status).toBe(200);
    expect(res.body.item.created).toBe(2);
    expect(res.body.item.skipped).toBe(1);

    const list = await agent.get('/api/anomalies').query({ q: 'example.dz/import', pageSize: 10 });
    expect(list.body.total).toBe(2);
    const audit = await agent.get('/api/admin/audit').query({ action: 'IMPORT_COMMIT' });
    expect(audit.body.total).toBeGreaterThanOrEqual(1);
  });

  it('avertit sur les doublons de lien et bloque tout ou rien', async () => {
    const again = await preview(buildCsv({ daira: 'Daïra Autre', commune: 'Commune Autre' }));
    expect(again.status).toBe(200);
    expect(again.body.item.summary).toMatchObject({ ok: 0, warning: 2, error: 1 });
    expect(again.body.item.rows[0].messages.join(' ')).toContain('Lien déjà utilisé');

    const blocked = await write(agent, csrf, 'post', '/api/anomalies/import/commit', {
      importId: again.body.item.importId, mode: 'all_or_nothing',
    });
    expect(blocked.status).toBe(422);
    expect(blocked.body.error.code).toBe('IMPORT_BLOQUE');

    const list = await agent.get('/api/anomalies').query({ q: 'example.dz/import' });
    expect(list.body.total).toBe(2);
  });
});

describe('Export', () => {
  let created;

  beforeAll(async () => {
    const res = await write(agent, csrf, 'post', '/api/anomalies', anomalyPayload(refs, {
      lien_url: 'https://example.dz/export/formule',
      date_signalement: today,
      observations: '=1+1',
      adresse_texte: '+SUM(A1)',
      lieu_dit: '@cmd',
    }));
    expect(res.status).toBe(201);
    created = res.body.item;
  });

  it('neutralise les formules dans le CSV', async () => {
    const res = await agent.get('/api/anomalies/export').query({ format: 'csv', q: 'export/formule' });
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('.csv');
    expect(res.text.startsWith('\uFEFF')).toBe(true);
    expect(res.text).toContain(created.reference);
    expect(res.text).toContain("'=1+1");
    expect(res.text).toContain("'+SUM(A1)");
    expect(res.text).toContain("'@cmd");
  });

  it('exporte le même nombre de lignes que la sélection filtrée', async () => {
    const list = await agent.get('/api/anomalies').query({ q: 'example.dz/import' });
    const res = await agent.get('/api/anomalies/export').query({ format: 'csv', q: 'example.dz/import' });
    const lines = res.text.split('\r\n').length - 1;
    expect(lines).toBe(list.body.total);
  });

  it('produit un classeur xlsx', async () => {
    const res = await agent.get('/api/anomalies/export').query({ format: 'xlsx', q: 'export/formule' })
      .buffer(true)
      .parse((response, callback) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect(res.body.length).toBeGreaterThan(1000);
  });
});
