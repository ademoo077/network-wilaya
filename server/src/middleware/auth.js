import { getUserById } from '../services/userService.js';

export function requireAuth(req, res, next) {
  const userId = req.session?.userId;
  if (!userId) {
    return res.status(401).json({ error: { code: 'AUTH_REQUIRED', message: 'Authentification requise' } });
  }
  const user = getUserById(userId);
  if (!user || user.active !== 1) {
    return res.status(401).json({ error: { code: 'AUTH_SESSION_INVALID', message: 'Session invalide' } });
  }
  req.user = user;
  next();
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: { code: 'AUTH_REQUIRED', message: 'Authentification requise' } });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Acces refuse pour ce role' } });
    }
    next();
  };
}
