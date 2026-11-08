import { getDb } from '../db/index.js';
import { readSession } from '../services/sessions.js';
import { unauthorized, forbidden } from '../utils/errors.js';

export function attachUser(req, _res, next) {
  try {
    const session = readSession(getDb(), req);
    if (session) {
      req.session = { id: session.sessionId, csrf: session.csrf };
      req.user = session.user;
    }
  } catch {
    // une session illisible est traitée comme non authentifiée
  }
  next();
}

export function requireAuth(req, _res, next) {
  if (!req.user) return next(unauthorized());
  return next();
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden('Votre rôle ne permet pas cette action'));
    return next();
  };
}

export const requireAdmin = requireRole('admin');
export const requireWrite = requireRole('admin', 'operateur');
