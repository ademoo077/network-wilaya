import { verifyCsrf } from '../services/sessions.js';
import { forbidden } from '../utils/errors.js';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

export function csrfProtection(req, _res, next) {
  if (SAFE.has(req.method)) return next();
  if (req.path === '/auth/login') return next();
  if (!req.session) return next(forbidden('Session requise'));
  if (!verifyCsrf(req)) return next(forbidden('Jeton CSRF invalide ou expiré — rechargez la page'));
  return next();
}
