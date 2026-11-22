import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import { createApp } from '../src/app.js';
import { setParams } from '../src/services/settings.js';
import { freshDatabase, login, anomalyPayload, write } from './helpers.js';

let app;
let refs;
let admin;
let lecteur;
let csrf;
let csrfLecteur;
let jpegAvecExif;
let png;

beforeAll(async () => {
  ({ refs } = freshDatabase());
  app = createApp();
  ({ agent: admin, csrf } = await login(app, 'admin'));
  ({ agent: lecteur, csrf: csrfLecteur } = await login(app, 'lecteur'));
  const source = await sharp({ create: { width: 4, height: 3, channels: 3, background: { r: 30, g: 90, b: 140 } } }).png().toBuffer();
  png = source;
  jpegAvecExif = await sharp(source).withMetadata({
    exif: { IFD0: { DateTime: '2026:07:04 12:00:00' }, ExifIFD: { DateTimeOriginal: '2026:07:04 12:00:00' } },
  }).jpeg().toBuffer();
});

async function createAnomalie(suffix) {
  const res = await write(admin, csrf, 'post', '/api/anomalies',
    anomalyPayload(refs, { lien_url: `https://www.facebook.com/watch/?v=v12-${suffix}` }));
  expect(res.status).toBe(201);
  return res.body.item;
}

function upload(agent, token, id, buffer, fields = {}, filename = 'photo.jpg', contentType = 'image/jpeg') {
  let req = agent.post(`/api/anomalies/${id}/pieces`).set('X-CSRF-Token', token);
  for (const [key, value] of Object.entries(fields)) req = req.field(key, String(value));
  return req.attach('file', buffer, { filename, contentType });
}

async function enCours(item) {
  const res = await write(admin, csrf, 'post', `/api/anomalies/${item.id}/statut`, {
    version: item.version, statut: 'en_cours', epic_id: refs.epicId, date_intervention: '2026-10-02',
  });
  expect(res.status).toBe(200);
  return res.body.item;
}

describe('Photos avant/après V12', () => {
  it('range et purge EXIF, produit une miniature et sert les fichiers uniquement aux utilisateurs connectés', async () => {
    const item = await createAnomalie('exif');
    const res = await upload(admin, csrf, item.id, jpegAvecExif, { role: 'avant', legende: 'Façade' }, 'facade.jpg');
    expect(res.status).toBe(201);
    const piece = res.body.item;
    expect(piece.role).toBe('avant');
    expect(piece.legende).toBe('Façade');
    expect(piece.prise_le).toBe('2026-07-04');
    expect(piece.thumb_url).toBe(`/api/photos/${piece.id}/thumb?v=${piece.hash.slice(0, 16)}`);
    expect(piece.url).toBe(`/api/photos/${piece.id}/file?v=${piece.hash.slice(0, 16)}`);

    const file = await admin.get(`/api/photos/${piece.id}/file`);
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toContain('image/jpeg');
    expect(file.body.includes(Buffer.from('Exif\0\0'))).toBe(false);
    const thumb = await admin.get(`/api/photos/${piece.id}/thumb`);
    expect(thumb.status).toBe(200);
    expect(thumb.headers['content-type']).toContain('image/jpeg');
    const metadata = await sharp(thumb.body).metadata();
    expect(Math.max(metadata.width, metadata.height)).toBeLessThanOrEqual(320);

    const anonymous = await request(app).get(`/api/photos/${piece.id}/file`);
    expect(anonymous.status).toBe(401);
  });

  it('refuse un MIME incohérent, un format inconnu et une onzième photo sur un même rôle', async () => {
    const item = await createAnomalie('limites');
    const incoherent = await upload(admin, csrf, item.id, png, { role: 'avant' }, 'faux.jpg', 'image/jpeg');
    expect(incoherent.status).toBe(400);
    expect(incoherent.body.error.code).toBe('VALIDATION');
    const inconnu = await upload(admin, csrf, item.id, Buffer.from('pas une image'), { role: 'avant' });
    expect(inconnu.status).toBe(400);
    for (let i = 0; i < 5; i += 1) {
      const ok = await upload(admin, csrf, item.id, png, { role: 'apres' }, `apres-${i}.png`, 'image/png');
      expect(ok.status).toBe(201);
    }
    const sixieme = await upload(admin, csrf, item.id, png, { role: 'apres' }, 'apres-5.png', 'image/png');
    expect(sixieme.status).toBe(422);
    expect(sixieme.body.error.code).toBe('LIMITE_PHOTOS');
    const list = await admin.get(`/api/anomalies/${item.id}/pieces`);
    expect(list.body.items).toHaveLength(5);
    expect(list.body.items.every((piece) => piece.role === 'apres')).toBe(true);
  });

  it('empêche un lecteur d’ajouter ou modifier une photo mais lui laisse la lecture', async () => {
    const item = await createAnomalie('droits');
    const refused = await upload(lecteur, csrfLecteur, item.id, png, { role: 'avant' }, 'lecteur.png', 'image/png');
    expect(refused.status).toBe(403);
    const allowed = await upload(admin, csrf, item.id, png, { role: 'avant' }, 'admin.png', 'image/png');
    expect(allowed.status).toBe(201);
    const pieceId = allowed.body.item.id;
    const patch = await write(lecteur, csrfLecteur, 'patch', `/api/photos/${pieceId}`, { role: 'apres' });
    expect(patch.status).toBe(403);
    const list = await lecteur.get(`/api/anomalies/${item.id}/pieces`);
    expect(list.status).toBe(200);
    expect(list.body.items[0].role).toBe('avant');
  });

  it('marquer une photo après permet de clore sans motif ; sinon motif obligatoire', async () => {
    const item = await createAnomalie('cloture');
    const avant = await upload(admin, csrf, item.id, png, { role: 'avant' }, 'avant.png', 'image/png');
    expect(avant.status).toBe(201);
    const enCoursItem = await enCours(item);

    const refuse = await write(admin, csrf, 'post', `/api/anomalies/${item.id}/statut`, {
      version: enCoursItem.version, statut: 'traite', epic_id: refs.epicId, date_traitement: '2026-10-03',
    });
    expect(refuse.status).toBe(422);
    expect(refuse.body.error.code).toBe('PHOTO_APRES_REQUISE');

    const motife = await write(admin, csrf, 'post', `/api/anomalies/${item.id}/statut`, {
      version: enCoursItem.version, statut: 'traite', epic_id: refs.epicId,
      date_traitement: '2026-10-03', sans_photo_motif: 'Site dangereux',
    });
    expect(motife.status).toBe(200);
    expect(motife.body.item.sans_photo_motif).toBe('Site dangereux');

    const item2 = await createAnomalie('cloture-photo');
    const avant2 = await upload(admin, csrf, item2.id, png, { role: 'avant' }, 'avant.png', 'image/png');
    const enCours2 = await enCours(item2);
    const marque = await write(admin, csrf, 'patch', `/api/photos/${avant2.body.item.id}`,
      { role: 'apres', principale: true });
    expect(marque.status).toBe(200);
    expect(marque.body.item.role).toBe('apres');
    expect(marque.body.item.principale).toBe(true);
    const traite = await write(admin, csrf, 'post', `/api/anomalies/${item2.id}/statut`, {
      version: enCours2.version, statut: 'traite', epic_id: refs.epicId, date_traitement: '2026-10-03',
    });
    expect(traite.status).toBe(200);
    expect(traite.body.item.sans_photo_motif).toBeNull();
  });

  it('expose les paires avant/après traitées sur la période demandée pour le widget de synthèse', async () => {
    const item = await createAnomalie('paires');
    const avant = await upload(admin, csrf, item.id, png, { role: 'avant', legende: 'Avant' }, 'avant.png', 'image/png');
    expect(avant.status).toBe(201);
    const apres = await upload(admin, csrf, item.id, png, { role: 'apres', legende: 'Après' }, 'apres.png', 'image/png');
    expect(apres.status).toBe(201);
    const enCoursItem = await enCours(item);
    const traite = await write(admin, csrf, 'post', `/api/anomalies/${item.id}/statut`, {
      version: enCoursItem.version, statut: 'traite', epic_id: refs.epicId, date_traitement: '2026-10-15',
    });
    expect(traite.status).toBe(200);

    const dansLaPeriode = await admin.get('/api/photos/paires?debut=2026-10-01&fin=2026-10-31');
    expect(dansLaPeriode.status).toBe(200);
    const paire = dansLaPeriode.body.items.find((entry) => entry.anomalie_id === item.id);
    expect(paire).toBeDefined();
    expect(paire.avant.role).toBe('avant');
    expect(paire.apres.role).toBe('apres');
    expect(paire.avant.thumb_url).toBe(`/api/photos/${avant.body.item.id}/thumb?v=${avant.body.item.hash.slice(0, 16)}`);

    const horsPeriode = await admin.get('/api/photos/paires?debut=2026-11-01&fin=2026-11-30');
    expect(horsPeriode.body.items.some((entry) => entry.anomalie_id === item.id)).toBe(false);
    const invalide = await admin.get('/api/photos/paires?debut=10/01/2026');
    expect(invalide.status).toBe(400);
    const anonyme = await request(app).get('/api/photos/paires');
    expect(anonyme.status).toBe(401);
  });

  it('respecte le paramètre photo_apres_obligatoire désactivé', async () => {
    const db = (await import('../src/db/index.js')).getDb();
    setParams(db, { photo_apres_obligatoire: '0' });
    try {
      const item = await createAnomalie('dispense-parametre');
      const enCoursItem = await enCours(item);
      const traite = await write(admin, csrf, 'post', `/api/anomalies/${item.id}/statut`, {
        version: enCoursItem.version, statut: 'traite', epic_id: refs.epicId, date_traitement: '2026-10-03',
      });
      expect(traite.status).toBe(200);
      expect(traite.body.item.statut).toBe('traite');
    } finally {
      setParams(db, { photo_apres_obligatoire: '1' });
    }
  });
});
