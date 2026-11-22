import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { config } from '../config/index.js';

/** Largeurs maximales des dérivés ; l'homologue JPEG sert de repli. */
export const TAILLES_DERIVEES = Object.freeze({ mini: 320, moyen: 800, grand: 1600 });
export const VARIANTES = Object.freeze(Object.keys(TAILLES_DERIVEES));

const uploadRoot = () => path.resolve(config.uploadDir);

/** Résolu sous le dossier privé uniquement ; refuse toute traversée. */
export function resolveStored(value) {
  if (typeof value !== 'string' || !value) return null;
  const parts = value.split(/[\\/]+/);
  if (parts.some((part) => !part || part === '.' || part === '..')) return null;
  if (!/^[A-Za-z0-9._-]+$/.test(parts.join(''))) return null;
  const root = uploadRoot();
  const target = path.resolve(root, ...parts);
  return target.startsWith(root + path.sep) ? target : null;
}

export function hashBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function dossierPourHash(hash) {
  return path.posix.join('derive', hash);
}

/**
 * Applique l'orientation EXIF, purge les métadonnées, calcule les dimensions,
 * le hash de contenu et un aperçu flou de ~24 px. Le buffer rendu remplace
 * l'original privé : aucune donnée EXIF ne quitte le serveur.
 */
export async function prepareImage(buffer, mime) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error('Image vide');
  let pipeline = sharp(buffer, { failOn: 'error' }).rotate();
  if (mime === 'image/png') pipeline = pipeline.png({ compressionLevel: 9 });
  else if (mime === 'image/webp') pipeline = pipeline.webp({ quality: 90 });
  else pipeline = pipeline.jpeg({ quality: 92, mozjpeg: true });
  const clean = await pipeline.toBuffer();
  const metadata = await sharp(clean).metadata();
  if (!Number.isFinite(metadata.width) || !Number.isFinite(metadata.height)
    || metadata.width <= 0 || metadata.height <= 0) throw new Error('Dimensions d’image invalides');
  const flou = await sharp(clean).rotate().resize(24, 24, { fit: 'inside' })
    .webp({ quality: 45 }).toBuffer();
  const hash = hashBuffer(clean);
  return {
    clean,
    hash,
    largeur: metadata.width,
    hauteur: metadata.height,
    apercu_flou: `data:image/webp;base64,${flou.toString('base64')}`,
    dossier_derive: dossierPourHash(hash),
  };
}

/** Écrit les six dérivés (3 tailles × WebP + repli JPEG) et la vignette historique. */
export async function ecrireDerives(image) {
  const dossier = path.join(uploadRoot(), image.dossier_derive);
  await fs.promises.mkdir(dossier, { recursive: true });
  for (const [taille, largeur] of Object.entries(TAILLES_DERIVEES)) {
    const base = sharp(image.clean).rotate().resize(largeur, largeur, { fit: 'inside', withoutEnlargement: true });
    const [webp, jpeg] = await Promise.all([
      base.clone().webp({ quality: 82 }).toBuffer(),
      base.clone().jpeg({ quality: 80, mozjpeg: true }).toBuffer(),
    ]);
    await Promise.all([
      fs.promises.writeFile(path.join(dossier, `${taille}.webp`), webp),
      fs.promises.writeFile(path.join(dossier, `${taille}.jpg`), jpeg),
    ]);
  }
  const vignette = await sharp(image.clean).rotate()
    .resize(TAILLES_DERIVEES.mini, TAILLES_DERIVEES.mini, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true }).toBuffer();
  const thumbName = `thumb-${image.hash.slice(0, 16)}.jpg`;
  await fs.promises.writeFile(path.join(uploadRoot(), thumbName), vignette);
  return { thumbName };
}

export function derivesPresent(row) {
  if (!row?.dossier_derive || !row?.hash) return false;
  const dossier = resolveStored(row.dossier_derive);
  if (!dossier) return false;
  return VARIANTES.every((taille) => ['webp', 'jpg'].every((ext) => fs.existsSync(path.join(dossier, `${taille}.${ext}`))));
}

export function cheminDerive(row, taille, ext = 'webp') {
  if (!VARIANTES.includes(taille) || !row?.dossier_derive) return null;
  return resolveStored(path.posix.join(row.dossier_derive, `${taille}.${ext}`));
}

export function supprimerDerives(row) {
  if (!row?.dossier_derive) return;
  const dossier = resolveStored(row.dossier_derive);
  if (!dossier) return;
  for (const taille of VARIANTES) {
    for (const ext of ['webp', 'jpg']) {
      try { fs.unlinkSync(path.join(dossier, `${taille}.${ext}`)); } catch { /* déjà absent */ }
    }
  }
  try { fs.rmdirSync(dossier); } catch { /* dossier partagé ou déjà absent */ }
}

/**
 * Recalcule les pièces historiques sans rien supprimer. Les pièces déjà
 * versionnées et complètes sont ignorées : une relance est sans effet.
 */
export async function recalculerPhotos(db, { onProgress = () => {} } = {}) {
  const lignes = db.prepare('SELECT * FROM pieces_jointes ORDER BY id').all();
  const rapport = { total: lignes.length, recalculees: 0, ignorees: 0, introuvables: 0, erreurs: [] };
  for (const [index, row] of lignes.entries()) {
    if (derivesPresent(row)) rapport.ignorees += 1;
    else {
      const original = resolveStored(row.chemin);
      if (!original || !fs.existsSync(original)) rapport.introuvables += 1;
      else {
        try {
          const buffer = await fs.promises.readFile(original);
          const image = await prepareImage(buffer, row.mime);
          const { thumbName } = await ecrireDerives(image);
          const nom = path.basename(original);
          await fs.promises.writeFile(path.join(uploadRoot(), nom), image.clean);
          db.prepare(`UPDATE pieces_jointes SET largeur = ?, hauteur = ?, apercu_flou = ?, hash = ?,
                      dossier_derive = ?, miniature_chemin = ? WHERE id = ?`)
            .run(image.largeur, image.hauteur, image.apercu_flou, image.hash,
              image.dossier_derive, thumbName, row.id);
          rapport.recalculees += 1;
        } catch (error) {
          rapport.erreurs.push({ id: row.id, message: error.message });
        }
      }
    }
    onProgress({ fait: index + 1, total: lignes.length, id: row.id });
  }
  return rapport;
}
