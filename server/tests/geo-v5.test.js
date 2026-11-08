import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { anomalyPayload, freshDatabase, login, write } from './helpers.js';

let app;
let db;
let refs;
let admin;
let operator;
let reader;
let parentId;

const polygonFile = (name = 'Commune Test') => Buffer.from(JSON.stringify({
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    properties: { COMMUNE: name },
    geometry: { type: 'Polygon', coordinates: [[[3.04, 36.74], [3.06, 36.74], [3.06, 36.76], [3.04, 36.76], [3.04, 36.74]]] },
  }],
}));

async function createAt(session, index, commune = 'first', gps = { lat: 36.75, lng: 3.05 }, extra = {}) {
  const target = commune === 'first'
    ? { daira_id: refs.dairaId, commune_id: refs.communeId }
    : { daira_id: refs.otherDairaId, commune_id: refs.otherCommuneId };
  return write(session.agent, session.csrf, 'post', '/api/anomalies', anomalyPayload(refs, {
    lien_url: `https://facebook.com/geo-v5-${index}`,
    ...target,
    gps,
    gps_source: 'lien_carte',
    ...extra,
  }));
}

beforeAll(async () => {
  ({ db, refs } = freshDatabase());
  app = createApp();
  admin = await login(app, 'admin');
  operator = await login(app, 'operateur');
  reader = await login(app, 'lecteur');
});

describe('Outils de collage V5', () => {
  it('protège la route par authentification et CSRF', async () => {
    const anonymous = await import('supertest').then(({ default: request }) => request(app).post('/api/tools/parse-paste').send({ texte: '36.75, 3.05' }));
    expect(anonymous.status).toBe(401);
    const noCsrf = await reader.agent.post('/api/tools/parse-paste').send({ texte: '36.75, 3.05' });
    expect(noCsrf.status).toBe(403);
  });

  it('analyse le même message côté serveur sans accès réseau', async () => {
    const res = await write(reader.agent, reader.csrf, 'post', '/api/tools/parse-paste', {
      texte: 'شاهد https://facebook.com/reel/123 الموقع ٣٦٫٧٥٣٨، ٣٫٠٥٨٨',
    });
    expect(res.status).toBe(200);
    expect(res.body.item.urls[0]).toMatchObject({ plateforme: 'facebook', contenuType: 'reel' });
    expect(res.body.item.coords[0]).toMatchObject({ lat: 36.7538, lng: 3.0588 });
  });
});

describe('Limites GeoJSON et localisation', () => {
  it('réserve l’import des limites à l’administrateur', async () => {
    const res = await operator.agent.post('/api/admin/limites/import-geojson').set('X-CSRF-Token', operator.csrf)
      .field('property', 'COMMUNE').attach('file', polygonFile(), { filename: 'limites.geojson' });
    expect(res.status).toBe(403);
  });

  it('liste les propriétés avant de demander le choix', async () => {
    const res = await admin.agent.post('/api/admin/limites/import-geojson').set('X-CSRF-Token', admin.csrf)
      .attach('file', polygonFile(), { filename: 'limites.geojson' });
    expect(res.status).toBe(200);
    expect(res.body.item).toMatchObject({ applied: false, requiresProperty: true, properties: ['COMMUNE'] });
  });

  it('produit un aperçu avec rapport des non-appariés', async () => {
    const matched = await admin.agent.post('/api/admin/limites/import-geojson').set('X-CSRF-Token', admin.csrf)
      .field('property', 'COMMUNE').attach('file', polygonFile(), { filename: 'limites.geojson' });
    expect(matched.status).toBe(200);
    expect(matched.body.item.summary).toMatchObject({ total: 1, matched: 1, unmatched: 0 });
    const unmatched = await admin.agent.post('/api/admin/limites/import-geojson').set('X-CSRF-Token', admin.csrf)
      .field('property', 'COMMUNE').attach('file', polygonFile('Commune inconnue'), { filename: 'limites.geojson' });
    expect(unmatched.body.item.summary.unmatched).toBe(1);
  });

  it('valide les limites, les audite et localise par polygone', async () => {
    const commit = await admin.agent.post('/api/admin/limites/import-geojson?commit=1').set('X-CSRF-Token', admin.csrf)
      .field('property', 'COMMUNE').attach('file', polygonFile(), { filename: 'limites.geojson' });
    expect(commit.status).toBe(200);
    expect(commit.body.item).toMatchObject({ applied: true, summary: { saved: 1 } });
    const located = await write(reader.agent, reader.csrf, 'post', '/api/geo/locate', { lat: 36.75, lng: 3.05 });
    expect(located.body.item).toMatchObject({ commune_id: refs.communeId, daira_id: refs.dairaId, methode: 'polygone', confiance: 'haute' });
    const audit = await admin.agent.get('/api/admin/audit').query({ action: 'LIMITES_IMPORT' });
    expect(audit.body.total).toBe(1);
  });

  it('refuse les géométries hors plage', async () => {
    const invalid = Buffer.from(JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { COMMUNE: 'Commune Test' }, geometry: { type: 'Polygon', coordinates: [[[300, 36], [301, 36], [301, 37], [300, 36]]] } }] }));
    const res = await admin.agent.post('/api/admin/limites/import-geojson').set('X-CSRF-Token', admin.csrf)
      .field('property', 'COMMUNE').attach('file', invalid, { filename: 'invalid.geojson' });
    expect(res.body.item.summary.errors).toBe(1);
  });
});

describe('GPS V5, voisinage et répétitions', () => {
  it('stocke la provenance, la précision et les métadonnées V5', async () => {
    const res = await createAt(admin, 'metadata', 'first', { lat: 36.8, lng: 3.1 }, {
      gps_source: 'appareil', gps_precision_m: 8, gps_verifiee: 1,
      contenu_type: 'video', date_publication: '2026-09-30', date_publication_estimee: 1,
      legende: 'Texte public', auteur_publication: 'Auteur public',
    });
    expect(res.status).toBe(201);
    expect(res.body.item).toMatchObject({ gps_source: 'appareil', gps_precision_m: 8, gps_verifiee: 1, contenu_type: 'video', date_publication_estimee: 1 });
    parentId = res.body.item.id;
  });

  it('refuse une source GPS sans position', async () => {
    const res = await write(admin.agent, admin.csrf, 'post', '/api/anomalies', anomalyPayload(refs, {
      lien_url: 'https://facebook.com/gps-source-without-position', gps_source: 'exif',
    }));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('GPS_SOURCE_SANS_POSITION');
  });

  it('lie un signalement répété à sa fiche mère et le compte', async () => {
    const child = await createAt(admin, 'child', 'first', { lat: 36.8001, lng: 3.1001 }, { lie_a_id: parentId });
    expect(child.status).toBe(201);
    expect(child.body.item.lie_a_id).toBe(parentId);
    const parent = await admin.agent.get(`/api/anomalies/${parentId}`);
    expect(parent.body.item.repetitions_count).toBe(1);
  });

  it('refuse le lien d’une anomalie vers elle-même', async () => {
    const current = await admin.agent.get(`/api/anomalies/${parentId}`);
    const res = await write(admin.agent, admin.csrf, 'patch', `/api/anomalies/${parentId}`, { version: current.body.item.version, lie_a_id: parentId });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('LIEN_CIRCULAIRE');
  });

  it('efface provenance, précision et confirmation quand le GPS est retiré', async () => {
    const current = await admin.agent.get(`/api/anomalies/${parentId}`);
    const res = await write(admin.agent, admin.csrf, 'patch', `/api/anomalies/${parentId}`, { version: current.body.item.version, gps: null });
    expect(res.status).toBe(200);
    expect(res.body.item).toMatchObject({ gps: null, gps_source: null, gps_precision_m: null, gps_verifiee: 0 });
  });

  it('déduit une commune par majorité de voisinage sans limite importée', async () => {
    db.prepare('DELETE FROM limites_communes').run();
    await createAt(admin, 'neighbor-a', 'first', { lat: 36.7500, lng: 3.0500 });
    await createAt(admin, 'neighbor-b', 'first', { lat: 36.7501, lng: 3.0501 });
    await createAt(admin, 'neighbor-c', 'other', { lat: 36.7502, lng: 3.0501 });
    const located = await write(reader.agent, reader.csrf, 'post', '/api/geo/locate', { lat: 36.7501, lng: 3.0500 });
    expect(located.body.item).toMatchObject({ commune_id: refs.communeId, methode: 'voisinage', confiance: 'moyenne', voisins: 3, majorite: 2 });
  });

  it('ne suggère rien sans au moins 60 % de majorité', async () => {
    const located = await write(reader.agent, reader.csrf, 'post', '/api/geo/locate', { lat: 36.9, lng: 3.3 });
    expect(located.body.item).toEqual({ methode: null });
  });

  it('retourne les anomalies proches triées, filtrées et excluables', async () => {
    const all = await reader.agent.get('/api/anomalies/nearby').query({ lat: 36.7501, lng: 3.0500, radius: 80, type: refs.typeId });
    expect(all.status).toBe(200);
    expect(all.body.items).toHaveLength(3);
    expect(all.body.items[0].distance_m).toBeLessThanOrEqual(all.body.items[1].distance_m);
    const excluded = await reader.agent.get('/api/anomalies/nearby').query({ lat: 36.7501, lng: 3.0500, radius: 80, type: refs.typeId, exclude: all.body.items[0].id });
    expect(excluded.body.items).toHaveLength(2);
  });
});
