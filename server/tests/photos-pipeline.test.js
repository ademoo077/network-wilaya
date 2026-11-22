import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { config } from '../src/config/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { freshDatabase } from './helpers.js';
import {
  derivesPresent, ecrireDerives, prepareImage, recalculerPhotos, resolveStored,
} from '../src/services/photoPipeline.js';

const silencieux = { info() {} };
const migrationsSource = path.resolve('server/src/db/migrations');

describe('V13 — migration 014 sur copie arrêtée à 013', () => {
  it('ajoute les colonnes sans toucher aux pièces existantes', () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'anm-v13-mig-'));
    const dir = path.join(temp, 'migrations');
    fs.mkdirSync(dir);
    for (const file of fs.readdirSync(migrationsSource)) {
      const version = Number.parseInt(file, 10);
      if (/^\d{3}_.*\.sql$/i.test(file) && version <= 13) {
        fs.copyFileSync(path.join(migrationsSource, file), path.join(dir, file));
      }
    }
    const db = new Database(path.join(temp, 'copie.db'));
    try {
      runMigrations(db, { logger: silencieux, dir });
      db.pragma('foreign_keys = OFF');
      db.prepare(`INSERT INTO pieces_jointes(id, anomalie_id, chemin, nom_original, mime, taille)
                  VALUES (1, 1, 'ancien.jpg', 'ancien.jpg', 'image/jpeg', 123)`).run();
      const avant = db.prepare('SELECT * FROM pieces_jointes WHERE id = 1').get();
      fs.copyFileSync(path.join(migrationsSource, '014_photos_pipeline.sql'), path.join(dir, '014_photos_pipeline.sql'));
      runMigrations(db, { logger: silencieux, dir });
      const apres = db.prepare('SELECT * FROM pieces_jointes WHERE id = 1').get();
      const colonnes = db.prepare('PRAGMA table_info(pieces_jointes)').all().map((row) => row.name);
      expect(apres).toMatchObject({
        id: avant.id, chemin: avant.chemin, nom_original: 'ancien.jpg', mime: 'image/jpeg', taille: 123,
      });
      expect(apres.hash).toBeNull();
      expect(apres.largeur).toBeNull();
      for (const colonne of ['largeur', 'hauteur', 'apercu_flou', 'hash', 'dossier_derive']) {
        expect(colonnes).toContain(colonne);
      }
      expect(db.prepare('SELECT COUNT(*) AS c FROM pieces_jointes').get().c).toBe(1);
    } finally {
      db.close();
      fs.rmSync(temp, { recursive: true, force: true });
    }
  });
});

describe('V13 — pipeline d’images', () => {
  let context;

  beforeAll(() => {
    context = freshDatabase();
  });

  afterAll(() => {
    fs.rmSync(config.uploadDir, { recursive: true, force: true, maxRetries: 8, retryDelay: 50 });
  });

  it('applique l’orientation EXIF, purge les métadonnées et produit un hash stable', async () => {
    const source = await sharp({ create: { width: 80, height: 40, channels: 3, background: '#336699' } })
      .withMetadata({ orientation: 6 }).jpeg().toBuffer();
    const image = await prepareImage(source, 'image/jpeg');
    expect([image.largeur, image.hauteur]).toEqual([40, 80]);
    expect(image.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(image.apercu_flou).toMatch(/^data:image\/webp;base64,/);
    const relu = await sharp(image.clean).metadata();
    expect(relu.orientation ?? 1).toBe(1);
    expect(relu.exif).toBeUndefined();
    const again = await prepareImage(source, 'image/jpeg');
    expect(again.hash).toBe(image.hash);
  });

  it('écrit les dérivés 320/800/1600 WebP + repli JPEG et refuse les traversées', async () => {
    const source = await sharp({ create: { width: 1800, height: 900, channels: 3, background: '#aa5533' } })
      .jpeg().toBuffer();
    const image = await prepareImage(source, 'image/jpeg');
    const { thumbName } = await ecrireDerives(image);
    expect(thumbName).toMatch(/^thumb-[a-f0-9]{16}\.jpg$/);
    const row = { hash: image.hash, dossier_derive: image.dossier_derive };
    expect(derivesPresent(row)).toBe(true);
    for (const taille of ['mini', 'moyen', 'grand']) {
      for (const ext of ['webp', 'jpg']) {
        expect(fs.existsSync(path.join(config.uploadDir, image.dossier_derive, `${taille}.${ext}`))).toBe(true);
      }
    }
    const grandBuffer = await fs.promises.readFile(path.join(config.uploadDir, image.dossier_derive, 'grand.webp'));
    const grand = await sharp(grandBuffer).metadata();
    expect(grand.width).toBe(1600);
    expect(grand.height).toBe(800);
    expect(resolveStored(path.join(image.dossier_derive, 'mini.webp'))).toBeTruthy();
    expect(resolveStored('../secret.jpg')).toBeNull();
    expect(resolveStored('/etc/passwd')).toBeNull();
  });

  it('recalcule une pièce historique une seule fois, sans supprimer ni changer son rôle', async () => {
    const db = context.db;
    const legacy = path.join(config.uploadDir, 'legacy.jpg');
    fs.mkdirSync(config.uploadDir, { recursive: true });
    await sharp({ create: { width: 60, height: 30, channels: 3, background: '#225588' } }).jpeg().toFile(legacy);
    db.pragma('foreign_keys = OFF');
    db.prepare(`INSERT INTO pieces_jointes(id, anomalie_id, chemin, nom_original, mime, taille, role)
                VALUES (9001, 1, 'legacy.jpg', 'Par daïra.jpg', 'image/jpeg', 900, 'autre')`).run();
    db.pragma('foreign_keys = ON');
    const progress = [];
    const premier = await recalculerPhotos(db, { onProgress: (value) => progress.push(value) });
    expect(premier.recalculees).toBeGreaterThanOrEqual(1);
    expect(premier.erreurs).toEqual([]);
    expect(progress.at(-1)).toMatchObject({ fait: progress.length, total: progress.length });
    const apres = db.prepare('SELECT * FROM pieces_jointes WHERE id = 9001').get();
    expect(apres.role).toBe('autre');
    expect(apres.nom_original).toBe('Par daïra.jpg');
    expect(apres.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(derivesPresent(apres)).toBe(true);
    const second = await recalculerPhotos(db);
    expect(second.recalculees).toBe(0);
    expect(second.ignorees).toBeGreaterThanOrEqual(1);
    expect(fs.existsSync(legacy)).toBe(true);
  });
});
