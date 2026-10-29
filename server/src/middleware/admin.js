export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: { code: 'AUTH_REQUIRED', message: 'Authentification requise' } });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Acces refuse pour ce role' } });
  }
  next();
}
