import crypto from 'node:crypto';
import { config } from '../config/index.js';
import { sha256, randomToken, safeEqual } from '../utils/crypto.js';

export const COOKIE_NAME = 'sid';

export function createSession(db, userId, req) {
  const token = randomToken(32);
  const csrf = randomToken(24);
  const id = sha256(token);
  const expires = new Date(Date.now() + config.sessionTtlHours * 3600 * 1000).toISOString();
  db.prepare(`INSERT INTO sessions(id, user_id, csrf_token, expires_at, last_seen_at, ip, user_agent)
              VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(id, userId, csrf, expires, new Date().toISOString(), req.ip || null, String(req.headers['user-agent'] || '').slice(0, 300));
  return { token, csrf, expires };
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    secure: config.cookieSecure,
    maxAge: config.sessionTtlHours * 3600 * 1000,
  };
}

export function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, cookieOptions());
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: undefined });
}

export function readSession(db, req) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  const id = sha256(token);
  const row = db.prepare(`SELECT s.*, u.username, u.full_name, u.role, u.actif, u.must_change_password
                          FROM sessions s JOIN users u ON u.id = s.user_id
                          WHERE s.id = ?`).get(id);
  if (!row) return null;
  if (row.expires_at < new Date().toISOString()) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
    return null;
  }
  if (!row.actif) {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.user_id);
    return null;
  }
  const expires = new Date(row.expires_at).getTime();
  if (expires - Date.now() < (config.sessionTtlHours * 3600 * 1000) / 2) {
    const next = new Date(Date.now() + config.sessionTtlHours * 3600 * 1000).toISOString();
    db.prepare('UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?')
      .run(new Date().toISOString(), next, id);
    row.expires_at = next;
  }
  return {
    sessionId: id,
    csrf: row.csrf_token,
    user: {
      id: row.user_id,
      username: row.username,
      full_name: row.full_name,
      role: row.role,
      actif: row.actif,
      must_change_password: row.must_change_password,
    },
  };
}

export function destroySession(db, sessionId) {
  if (!sessionId) return;
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

export function destroyUserSessions(db, userId, exceptId = null) {
  if (exceptId) db.prepare('DELETE FROM sessions WHERE user_id = ? AND id <> ?').run(userId, exceptId);
  else db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

export function verifyCsrf(req) {
  const expected = req.session?.csrf;
  const given = req.get('x-csrf-token') || req.body?.csrf;
  if (!expected || !given) return false;
  return safeEqual(expected, given);
}

export function newCsrfToken() {
  return crypto.randomBytes(24).toString('base64url');
}
