import fs from 'node:fs';
import path from 'node:path';
import { MAX_PIECES, MAX_UPLOAD_BYTES } from '@anm/shared';
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

export async function savePiece(db, anomalieId, file, userId) {
  const anomalie = getAnomalie(db, anomalieId);
  if (!anomalie) throw notFound('Anomalie introuvable');
  const count = db.prepare('SELECT COUNT(*) AS c FROM pieces_jointes WHERE anomalie_id = ?').get(anomalieId).c;
  if (count >= MAX_PIECES) throw business(`Maximum ${MAX_PIECES} pièces jointes par anomalie`, 'LIMITE_PIECES');
  if (file.size > MAX_UPLOAD_BYTES) throw tooLarge('Fichier trop volumineux (5 Mo maximum)');
  const detected = detectedMime(file.buffer);
  if (!detected) throw badRequest('Format non autorisé : PNG, JPG ou WebP uniquement');
  if (file.mimetype && file.mimetype !== detected.mime) throw badRequest('Type MIME incohérent avec le contenu du fichier');
  fs.mkdirSync(config.uploadDir, { recursive: true });
  const filename = `${uuid()}.${detected.ext}`;
  const absolute = path.join(config.uploadDir, filename);
  await fs.promises.writeFile(absolute, file.buffer, { mode: 0o600 });
  const res = db.prepare(`INSERT INTO pieces_jointes(anomalie_id, chemin, nom_original, mime, taille, user_id)
                          VALUES (?, ?, ?, ?, ?, ?)`)
    .run(anomalieId, filename, (file.originalname || 'piece').slice(0, 200), detected.mime, file.size, userId);
  return {
    id: res.lastInsertRowid,
    anomalie_id: anomalieId,
    nom_original: file.originalname,
    mime: detected.mime,
    taille: file.size,
    url: `/api/pieces/${res.lastInsertRowid}/file`,
  };
}

export function getPiece(db, id) {
  const row = db.prepare('SELECT * FROM pieces_jointes WHERE id = ?').get(id);
  if (!row) return null;
  const absolute = path.resolve(config.uploadDir, row.chemin);
  if (!absolute.startsWith(path.resolve(config.uploadDir))) return null;
  if (!fs.existsSync(absolute)) return null;
  return { ...row, absolute };
}

export function deletePiece(db, id) {
  const row = getPiece(db, id);
  if (!row) return null;
  try { fs.unlinkSync(row.absolute); } catch { /* fichier déjà absent */ }
  db.prepare('DELETE FROM pieces_jointes WHERE id = ?').run(id);
  return row;
}
