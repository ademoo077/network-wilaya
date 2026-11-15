import { z } from 'zod';
import { generateToken, hashToken } from './secrets.js';
import { forbidden, notFound, unauthorized } from '../utils/errors.js';

export const captureTokenSchema = z.object({ nom: z.string().trim().min(2).max(120) });

export function listCaptureTokens(db, userId) {
  return db.prepare(`SELECT id, user_id, nom, portee, derniere_utilisation, revoque, created_at
    FROM veille_jetons WHERE user_id = ? ORDER BY created_at DESC, id DESC`).all(userId);
}

export function createCaptureToken(db, userId, nom) {
  const token = generateToken();
  const hashed = hashToken(token);
  const id = Number(db.prepare(`INSERT INTO veille_jetons(user_id, nom, hash, portee)
    VALUES (?, ?, ?, 'capture')`).run(userId, nom, hashed).lastInsertRowid);
  return { token, item: db.prepare(`SELECT id, user_id, nom, portee, derniere_utilisation, revoque, created_at
    FROM veille_jetons WHERE id = ?`).get(id) };
}

export function revokeCaptureToken(db, userId, tokenId, { admin = false } = {}) {
  const row = db.prepare('SELECT * FROM veille_jetons WHERE id = ?').get(tokenId);
  if (!row) throw notFound('Jeton introuvable');
  if (!admin && Number(row.user_id) !== Number(userId)) throw forbidden('Jeton non autorisé');
  db.prepare('UPDATE veille_jetons SET revoque = 1 WHERE id = ?').run(tokenId);
  return db.prepare(`SELECT id, user_id, nom, portee, derniere_utilisation, revoque, created_at
    FROM veille_jetons WHERE id = ?`).get(tokenId);
}

function readBearer(req) {
  const header = String(req.get('authorization') || '');
  if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
  const alt = String(req.get('x-veille-token') || '').trim();
  return alt || null;
}

export function authenticateCaptureToken(db, req) {
  const token = readBearer(req);
  if (!token) throw unauthorized('Jeton de capture requis');
  const row = db.prepare(`SELECT j.*, u.username, u.full_name, u.role, u.actif
    FROM veille_jetons j JOIN users u ON u.id = j.user_id
    WHERE j.hash = ? AND j.portee = 'capture'`).get(hashToken(token));
  if (!row || row.revoque) throw unauthorized('Jeton de capture invalide ou révoqué');
  if (!row.actif) throw forbidden('Compte inactif');
  if (!['admin', 'operateur'].includes(row.role)) throw forbidden('Votre rôle ne permet pas la capture');
  db.prepare(`UPDATE veille_jetons SET derniere_utilisation = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`).run(row.id);
  return {
    tokenId: row.id,
    user: { id: row.user_id, username: row.username, full_name: row.full_name, role: row.role, actif: row.actif },
  };
}
