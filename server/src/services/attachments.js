import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import exifr from 'exifr';
import { MAX_PIECES_PAR_ROLE, MAX_UPLOAD_BYTES, PHOTO_ROLES } from '@anm/shared';
import { config } from '../config/index.js';
import { getAnomalie } from './anomalyRead.js';
import { badRequest, tooLarge, notFound, business } from '../utils/errors.js';
import { uuid } from '../utils/crypto.js';

const SIGNATURES = {
  png: (buf) => buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47,
  jpg: (buf) => buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
  jpeg: (buf) => buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
  webp: (buf) => buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP',
};

function detectedMime(buffer) {
  for (const [key, test] of Object.entries(SIGNATURES)) {
    if (test(buffer)) {
      if (key === 'jpg' || key === 'jpeg') return { mime: 'image/jpeg', ext: 'jpg' };
      return { mime: `image/${key}`, ext: key };
    }
  }
  return null;
}

/** Retire les segments EXIF des JPEG et le chunk eXIf des PNG avant stockage. */
function stripMetadata(buffer, mime) {
  if (mime === 'image/jpeg') {
    const out = [Buffer.from([0xff, 0xd8])];
    let offset = 2;
    while (offset + 3 < buffer.length) {
      if (buffer[offset] !== 0xff) { out.push(buffer.subarray(offset, offset + 1)); offset += 1; continue; }
      const marker = buffer[offset + 1];
      if (marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        out.push(buffer.subarray(offset, offset + 2)); offset += 2; continue;
      }
      if (marker === 0xda) { out.push(buffer.subarray(offset)); break; }
      const length = buffer.readUInt16BE(offset + 2);
      if (length < 2 || offset + 2 + length > buffer.length) { out.push(buffer.subarray(offset)); break; }
      const segment = buffer.subarray(offset, offset + 2 + length);
      const isExif = marker === 0xe1 && segment.length >= 10 && segment.toString('ascii', 4, 10) === 'Exif\0\0';
      if (!isExif) out.push(segment);
      offset += 2 + length;
    }
    return Buffer.concat(out);
  }
  if (mime === 'image/png') {
    const out = [buffer.subarray(0, 8)];
    let offset = 8;
    while (offset + 8 <= buffer.length) {
      const length = buffer.readUInt32BE(offset);
      if (length < 0 || offset + 12 + length > buffer.length) { out.push(buffer.subarray(offset)); break; }
      const type = buffer.toString('ascii', offset + 4, offset + 8);
      const chunk = buffer.subarray(offset, offset + 12 + length);
      if (type !== 'eXIf') out.push(chunk);
      offset += 12 + length;
    }
    return Buffer.concat(out);
  }
  return buffer;
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

function safeFilename(filename) {
  return typeof filename === 'string' && /^[A-Za-z0-9._-]+$/.test(filename) ? filename : null;
}

function absoluteFor(filename) {
  const safe = safeFilename(filename);
  if (!safe) return null;
  const root = path.resolve(config.uploadDir);
  const target = path.resolve(root, safe);
  return target === root || !target.startsWith(root + path.sep) ? null : target;
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
  const thumb = row.miniature_chemin ? `/api/photos/${row.id}/thumb` : null;
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
    url: `/api/photos/${row.id}/file`,
    thumb_url: thumb,
  };
}

/** Paires avant/après des fiches traitées sur une période, pour le widget de synthèse. */
export function listPhotoPairs(db, { debut = '0000-01-01', fin = '9999-12-31', limite = 12 } = {}) {
  const rows = db.prepare(`
    SELECT a.id AS anomalie_id, a.reference, a.date_traitement,
      (SELECT p.id FROM pieces_jointes p
       WHERE p.anomalie_id = a.id AND p.role = 'avant'
       ORDER BY p.principale DESC, p.id DESC LIMIT 1) AS avant_id,
      (SELECT p.id FROM pieces_jointes p
       WHERE p.anomalie_id = a.id AND p.role = 'apres'
       ORDER BY p.principale DESC, p.id DESC LIMIT 1) AS apres_id
    FROM anomalies a
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
    date_traitement: row.date_traitement,
    avant: piecePayload(byId.get(row.avant_id)),
    apres: piecePayload(byId.get(row.apres_id)),
  }));
}

async function makeThumbnail(buffer) {
  try {
    return await sharp(buffer).rotate().resize(320, 320, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true }).toBuffer();
  } catch {
    return null;
  }
}

export async function savePiece(db, anomalieId, file, userId, options = {}) {
  const anomalie = getAnomalie(db, anomalieId);
  if (!anomalie) throw notFound('Anomalie introuvable');
  if (file.size > MAX_UPLOAD_BYTES) throw tooLarge('Fichier trop volumineux (5 Mo maximum)');
  const detected = detectedMime(file.buffer);
  if (!detected) throw badRequest('Format non autorisé : PNG, JPG ou WebP uniquement');
  if (file.mimetype && file.mimetype !== detected.mime) throw badRequest('Type MIME incohérent avec le contenu du fichier');
  const role = normalizeRole(options.role);
  assertRoleCapacity(db, anomalieId, role);
  const meta = await readPhotoMetadata(file.buffer);
  const cleaned = stripMetadata(file.buffer, detected.mime);
  const filename = `${uuid()}.${detected.ext}`;
  const thumbName = `thumb-${uuid()}.jpg`;
  fs.mkdirSync(config.uploadDir, { recursive: true });
  await fs.promises.writeFile(path.join(config.uploadDir, filename), cleaned, { mode: 0o600 });
  const thumbnail = await makeThumbnail(cleaned);
  if (thumbnail) await fs.promises.writeFile(path.join(config.uploadDir, thumbName), thumbnail, { mode: 0o600 });
  const principale = options.principale ? 1 : 0;
  if (principale) db.prepare('UPDATE pieces_jointes SET principale = 0 WHERE anomalie_id = ? AND role = ?').run(anomalieId, role);
  const res = db.prepare(`INSERT INTO pieces_jointes(anomalie_id, chemin, nom_original, mime, taille, user_id,
      role, principale, legende, prise_le, gps_lat, gps_lng, miniature_chemin)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(anomalieId, filename, (file.originalname || 'piece').slice(0, 200), detected.mime, cleaned.length, userId,
      role, principale, String(options.legende || '').trim().slice(0, 200) || null,
      normalizeDate(options.prise_le) || meta.prise_le,
      normalizeCoord(options.gps_lat ?? meta.gps_lat, -90, 90),
      normalizeCoord(options.gps_lng ?? meta.gps_lng, -180, 180),
      thumbnail ? thumbName : null);
  return piecePayload(db.prepare('SELECT * FROM pieces_jointes WHERE id = ?').get(res.lastInsertRowid));
}

export function listPieces(db, anomalieId) {
  return db.prepare('SELECT * FROM pieces_jointes WHERE anomalie_id = ? ORDER BY role, principale DESC, id').all(anomalieId).map(piecePayload);
}

export function getPiece(db, id) {
  const row = db.prepare('SELECT * FROM pieces_jointes WHERE id = ?').get(id);
  if (!row) return null;
  const absolute = absoluteFor(row.chemin);
  if (!absolute || !fs.existsSync(absolute)) return null;
  return { ...row, absolute };
}

export function getPieceThumb(db, id) {
  const row = db.prepare('SELECT miniature_chemin FROM pieces_jointes WHERE id = ?').get(id);
  if (!row) return null;
  const absolute = absoluteFor(row.miniature_chemin);
  if (!absolute || !fs.existsSync(absolute)) return null;
  const main = getPiece(db, id);
  return main ? { ...main, absolute } : null;
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
  try { fs.unlinkSync(row.absolute); } catch { /* fichier déjà absent */ }
  if (thumb) { try { fs.unlinkSync(thumb.absolute); } catch { /* miniature déjà absente */ } }
  db.prepare('DELETE FROM pieces_jointes WHERE id = ?').run(id);
  return row;
}
