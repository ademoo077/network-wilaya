import { beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { createApp } from '../src/app.js';
import { config } from '../src/config/index.js';
import { getDb } from '../src/db/index.js';
import { listPieces } from '../src/services/attachments.js';
import { freshDatabase, login, anomalyPayload } from './helpers.js';

let app;
let refs;
let admin;
let csrf;

beforeAll(async () => {
  ({ refs } = freshDatabase());
  app = createApp();
  ({ agent: admin, csrf } = await login(app, 'admin'));
});

/** Insère une pièce « historique » : fichier présent, mais sans miniature ni dérivé. */
async function pieceHistorique(anomalieId, suffix) {
  const db = getDb();
  const buffer = await sharp({ create: { width: 6, height: 4, channels: 3, background: { r: 20, g: 120, b: 200 } } })
    .png().toBuffer();
  const filename = `legacy-${suffix}.png`;
  fs.mkdirSync(config.uploadDir, { recursive: true });
  fs.writeFileSync(path.join(config.uploadDir, filename), buffer);
  const res = await admin.post(`/api/anomalies/${anomalieId}/pieces`)
    .set('X-CSRF-Token', csrf)
    .field('role', 'autre')
    .attach('file', buffer, { filename, contentType: 'image/png' });
  expect(res.status).toBe(201);
  const id = res.body.item.id;
  // Simule une pièce d'avant le pipeline : plus de miniature, plus de hash.
  db.prepare('UPDATE pieces_jointes SET miniature_chemin = NULL, hash = NULL, dossier_derive = NULL WHERE id = ?').run(id);
  return id;
}

describe('Repli des pièces historiques sans dérivé (V13)', () => {
  it('sert l’original via /thumb et fournit toujours une URL de vignette', async () => {
    const created = await admin.post('/api/anomalies').set('X-CSRF-Token', csrf)
      .send(anomalyPayload(refs, { lien_url: 'https://www.facebook.com/watch/?v=legacy-thumb' }));
    expect(created.status).toBe(201);
    const anomalieId = created.body.item.id;
    const pieceId = await pieceHistorique(anomalieId, Date.now());

    const payload = listPieces(getDb(), anomalieId).find((piece) => piece.id === pieceId);
    expect(payload.thumb_url).toContain(`/api/photos/${pieceId}/thumb`);

    const thumb = await admin.get(`/api/photos/${pieceId}/thumb`);
    expect(thumb.status).toBe(200);
    expect(thumb.headers['content-type']).toMatch(/image\/png/);
  });
});
