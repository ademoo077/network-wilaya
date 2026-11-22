import fs from 'node:fs';
import path from 'node:path';
import exifr from 'exifr';
import { MAX_PIECES_PAR_ROLE, MAX_UPLOAD_BYTES, PHOTO_ROLES } from '@anm/shared';
import { config } from '../config/index.js';
import { getAnomalie } from './anomalyRead.js';
import { badRequest, tooLarge, notFound, business } from '../utils/errors.js';
import { uuid } from '../utils/crypto.js';
import { safeDisplayFilename } from '../utils/filenames.js';
import { ecrireDerives, prepareImage, resolveStored, supprimerDerives } from './photoPipeline.js';

const SIGNATURES = {
  png: (buf) => buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47,
  jpg: (buf) => buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
  jpeg: (buf) => buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
  webp: (buf) => buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP',
};

function estHeic(buffer) {
  if (buffer.length < 16 || buffer.toString('ascii', 4, 8) !== 'ftyp') return false;
  const marque = buffer.toString('ascii', 8, 12);
  return ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(marque);
}

function detectedMime(buffer) {
  for (const [key, test] of Object.entries(SIGNATURES)) {
    if (test(buffer)) {
      if (key === 'jpg' || key === 'jpeg') return { mime: 'image/jpeg', ext: 'jpg', allowed: ['image/jpeg'] };
      return { mime: `image/${key}`, ext: key, allowed: [`image/${key}`] };
    }
  }
  // HEIC/HEIF est converti en JPEG par le pipeline : rien de ce format ne reste stocké.
  if (estHeic(buffer)) return { mime: 'image/jpeg', ext: 'jpg', allowed: ['image/heic', 'image/heif', 'image/jpeg'] };
  return null;
}

/** EXIF est lu avant purge : la date et le GPS ne sont conservés que dans la base. */
async function readPhotoMetadata(buffer) {
  try {
    const [gps, meta] = await Promise.all([
      exifr.gps(buffer).catch(() => null),
      exifr.parse(buffer, ['DateTimeOriginal', 'CreateDate', 'ModifyDate', 'GPSHPositioningError']).catch(() => null),
    ]);
    const raw = meta?.DateTimeOriginal || meta?.CreateDate || meta?.ModifyDate;
    const iso = raw instanceof Date && !Number.isNaN(raw.getTime())
      ? raw.toISOString().slice(0, 10)
      : typeof raw === 'string' && /^\d{4}[:-]\d{2}[:-]\d{2}/.test(raw) ? raw.slice(0, 10).replaceAll(':', '-') : null;
    return {
      prise_le: iso,
      gps_lat: Number.isFinite(gps?.latitude) ? Math.round(gps.latitude * 1e6) / 1e6 : null,
      gps_lng: Number.isFinite(gps?.longitude) ? Math.round(gps.longitude * 1e6) / 1e6 : null,
      precision: Number.isFinite(meta?.GPSHPositioningError) ? Math.round(meta.GPSHPositioningError) : null,
    };
  } catch {
    return { prise_le: null, gps_lat: null, gps_lng: null, precision: null };
  }
}

function normalizeRole(value) {
  return PHOTO_ROLES.includes(value) ? value : 'autre';
}

function normalizeDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function normalizeCoord(value, min, max) {
  const n = Number(value);
  return value !== null && value !== undefined && value !== '' && Number.isFinite(n) && n >= min && n <= max
    ? Math.round(n * 1e6) / 1e6 : null;
}

export function photoCounts(db, anomalieId) {
  const rows = db.prepare('SELECT role, COUNT(*) AS c FROM pieces_jointes WHERE anomalie_id = ? GROUP BY role').all(anomalieId);
  const counts = { avant: 0, apres: 0, autre: 0 };
  for (const row of rows) if (row.role in counts) counts[row.role] = row.c;
  return counts;
}

function assertRoleCapacity(db, anomalieId, role, excludeId = null) {
  const used = db.prepare('SELECT COUNT(*) AS c FROM pieces_jointes WHERE anomalie_id = ? AND role = ? AND id <> ?')
    .get(anomalieId, role, excludeId || -1).c;
  if (used >= MAX_PIECES_PAR_ROLE) {
    throw business(`Maximum ${MAX_PIECES_PAR_ROLE} photos ${role} par anomalie`, 'LIMITE_PHOTOS');
  }
}

function piecePayload(row) {
  const version = row.hash ? row.hash.slice(0, 16) : null;
  const query = (taille) => {
    const parts = [];
    if (version) parts.push(`v=${version}`);
    if (taille) parts.push(`taille=${taille}`);
    return parts.length ? `?${parts.join('&')}` : '';
  };
  // V13 : toute pièce doit avoir une URL d'affichage, y compris les pièces
  // historiques antérieures au pipeline (sans miniature). Le serveur sert
  // alors l'original en repli : aucune image n'apparaît comme cassée.
  const thumb = `/api/photos/${row.id}/thumb${query()}`;
  return {
    id: row.id,
    anomalie_id: row.anomalie_id,
    nom_original: row.nom_original,
    mime: row.mime,
    taille: row.taille,
    role: row.role || 'autre',
    principale: Boolean(row.principale),
    legende: row.legende || null,
    prise_le: row.prise_le || null,
    gps_lat: row.gps_lat ?? null,
    gps_lng: row.gps_lng ?? null,
    created_at: row.created_at,
    auteur: row.auteur || row.auteur_username || null,
    largeur: row.largeur ?? null,
    hauteur: row.hauteur ?? null,
    apercu_flou: row.apercu_flou || null,
    hash: row.hash || null,
    url: `/api/photos/${row.id}/file${query()}`,
    thumb_url: thumb,
    variantes: version ? {
      mini: `/api/photos/${row.id}/file${query('mini')}`,
      moyen: `/api/photos/${row.id}/file${query('moyen')}`,
      grand: `/api/photos/${row.id}/file${query('grand')}`,
    } : null,
  };
}

/** Paires avant/après des fiches traitées sur une période, pour le widget de synthèse. */
export function listPhotoPairs(db, { debut = '0000-01-01', fin = '9999-12-31', limite = 12 } = {}) {
  const rows = db.prepare(`
    SELECT a.id AS anomalie_id, a.reference, a.date_signalement, a.date_intervention, a.date_traitement,
      a.intervenant_autre,
      da.name_fr AS daira_fr, da.name_ar AS daira_ar,
      co.name_fr AS commune_fr, co.name_ar AS commune_ar,
      ag.full_name AS agent_nom, ep.name AS epic_name,
      (SELECT p.id FROM pieces_jointes p
       WHERE p.anomalie_id = a.id AND p.role = 'avant'
       ORDER BY p.principale DESC, p.id DESC LIMIT 1) AS avant_id,
      (SELECT p.id FROM pieces_jointes p
       WHERE p.anomalie_id = a.id AND p.role = 'apres'
       ORDER BY p.principale DESC, p.id DESC LIMIT 1) AS apres_id
    FROM anomalies a
    LEFT JOIN dairas da ON da.id = a.daira_id
    LEFT JOIN communes co ON co.id = a.commune_id
    LEFT JOIN agents ag ON ag.id = a.agent_id
    LEFT JOIN epics ep ON ep.id = a.epic_id
    WHERE a.deleted_at IS NULL AND a.statut = 'traite'
      AND COALESCE(a.verification, '') <> 'infirmee'
      AND a.date_traitement >= ? AND a.date_traitement <= ?
      AND EXISTS (SELECT 1 FROM pieces_jointes p WHERE p.anomalie_id = a.id AND p.role = 'avant')
      AND EXISTS (SELECT 1 FROM pieces_jointes p WHERE p.anomalie_id = a.id AND p.role = 'apres')
    ORDER BY a.date_traitement DESC, a.id DESC
    LIMIT ?`).all(debut, fin, limite);
  const byId = db.prepare('SELECT * FROM pieces_jointes WHERE id = ?');
  return rows.map((row) => ({
    anomalie_id: row.anomalie_id,
    reference: row.reference,
    date_signalement: row.date_signalement,
    date_intervention: row.date_intervention,
    date_traitement: row.date_traitement,
    daira: { fr: row.daira_fr || row.daira_ar || '', ar: row.daira_ar || row.daira_fr || '' },
    commune: { fr: row.commune_fr || row.commune_ar || '', ar: row.commune_ar || row.commune_fr || '' },
    intervenant: row.epic_name || row.intervenant_autre || row.agent_nom || '',
    avant: piecePayload(byId.get(row.avant_id)),
    apres: piecePayload(byId.get(row.apres_id)),
  }));
}

export async function savePiece(db, anomalieId, file, userId, options = {}) {
  const anomalie = getAnomalie(db, anomalieId);
  if (!anomalie) throw notFound('Anomalie introuvable');
  if (file.size > MAX_UPLOAD_BYTES || file.buffer?.length > MAX_UPLOAD_BYTES) {
    throw tooLarge('Fichier trop volumineux (5 Mo maximum)');
  }
  const detected = detectedMime(file.buffer);
  if (!detected) throw badRequest('Format non autorisé : PNG, JPG, WebP ou HEIC uniquement');
  if (file.mimetype && !detected.allowed.includes(file.mimetype)) {
    throw badRequest('Type MIME incohérent avec le contenu du fichier');
  }
  const role = normalizeRole(options.role);
  assertRoleCapacity(db, anomalieId, role);
  const meta = await readPhotoMetadata(file.buffer);
  const image = await prepareImage(file.buffer, detected.mime);
  const filename = `${uuid()}.${detected.ext}`;
  fs.mkdirSync(config.uploadDir, { recursive: true });
  await fs.promises.writeFile(path.join(config.uploadDir, filename), image.clean);
  const { thumbName } = await ecrireDerives(image);
  const principale = options.principale ? 1 : 0;
  if (principale) db.prepare('UPDATE pieces_jointes SET principale = 0 WHERE anomalie_id = ? AND role = ?').run(anomalieId, role);
  const res = db.prepare(`INSERT INTO pieces_jointes(anomalie_id, chemin, nom_original, mime, taille, user_id,
      role, principale, legende, prise_le, gps_lat, gps_lng, miniature_chemin,
      largeur, hauteur, apercu_flou, hash, dossier_derive)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(anomalieId, filename, safeDisplayFilename(file.originalname), detected.mime, image.clean.length, userId,
      role, principale, String(options.legende || '').trim().slice(0, 200) || null,
      normalizeDate(options.prise_le) || meta.prise_le,
      normalizeCoord(options.gps_lat ?? meta.gps_lat, -90, 90),
      normalizeCoord(options.gps_lng ?? meta.gps_lng, -180, 180),
      thumbName, image.largeur, image.hauteur, image.apercu_flou, image.hash, image.dossier_derive);
  const cree = db.prepare(`SELECT p.*, u.full_name AS auteur, u.username AS auteur_username
                           FROM pieces_jointes p LEFT JOIN users u ON u.id = p.user_id WHERE p.id = ?`)
    .get(res.lastInsertRowid);
  return piecePayload(cree);
}

export function listPieces(db, anomalieId) {
  return db.prepare(`SELECT p.*, u.full_name AS auteur, u.username AS auteur_username
                     FROM pieces_jointes p LEFT JOIN users u ON u.id = p.user_id
                     WHERE p.anomalie_id = ? ORDER BY p.role, p.principale DESC, p.id`)
    .all(anomalieId).map(piecePayload);
}

export function getPiece(db, id) {
  const row = db.prepare('SELECT * FROM pieces_jointes WHERE id = ?').get(id);
  if (!row) return null;
  const absolute = resolveStored(row.chemin);
  if (!absolute || !fs.existsSync(absolute)) return null;
  return { ...row, absolute };
}

export function getPieceThumb(db, id) {
  const row = db.prepare('SELECT miniature_chemin FROM pieces_jointes WHERE id = ?').get(id);
  if (!row) return null;
  const miniature = row.miniature_chemin ? resolveStored(row.miniature_chemin) : null;
  const main = getPiece(db, id);
  if (!main) return null;
  // Repli pour les pièces historiques sans dérivé : sert l'original,
  // stocké dans le dossier privé et jamais exposé en statique.
  if (!miniature || !fs.existsSync(miniature)) return main;
  return { ...main, absolute: miniature };
}

export function updatePiece(db, id, patch = {}) {
  const row = db.prepare('SELECT * FROM pieces_jointes WHERE id = ?').get(id);
  if (!row) return null;
  const role = patch.role === undefined ? row.role : normalizeRole(patch.role);
  if (role !== row.role) assertRoleCapacity(db, row.anomalie_id, role, id);
  const principale = patch.principale === undefined ? row.principale : (patch.principale ? 1 : 0);
  if (principale) db.prepare('UPDATE pieces_jointes SET principale = 0 WHERE anomalie_id = ? AND role = ? AND id <> ?')
    .run(row.anomalie_id, role, id);
  db.prepare(`UPDATE pieces_jointes SET role = ?, principale = ?, legende = ?, prise_le = ?, gps_lat = ?, gps_lng = ?
              WHERE id = ?`).run(role, principale,
    patch.legende === undefined ? row.legende : String(patch.legende || '').trim().slice(0, 200) || null,
    patch.prise_le === undefined ? row.prise_le : normalizeDate(patch.prise_le),
    patch.gps_lat === undefined ? row.gps_lat : normalizeCoord(patch.gps_lat, -90, 90),
    patch.gps_lng === undefined ? row.gps_lng : normalizeCoord(patch.gps_lng, -180, 180), id);
  return piecePayload(db.prepare('SELECT * FROM pieces_jointes WHERE id = ?').get(id));
}

export function deletePiece(db, id) {
  const row = getPiece(db, id);
  if (!row) return null;
  const thumb = getPieceThumb(db, id);
  const derniere = row.hash
    ? db.prepare('SELECT COUNT(*) AS c FROM pieces_jointes WHERE hash = ?').get(row.hash).c === 1
    : true;
  try { fs.unlinkSync(row.absolute); } catch { /* fichier déjà absent */ }
  if (thumb) { try { fs.unlinkSync(thumb.absolute); } catch { /* miniature déjà absente */ } }
  if (derniere) supprimerDerives(row);
  db.prepare('DELETE FROM pieces_jointes WHERE id = ?').run(id);
  return row;
}
