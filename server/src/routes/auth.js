import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { loginSchema, changePasswordSchema, zodFields, passwordErrors } from '@anm/shared';
import { getDb } from '../db/index.js';
import { config } from '../config/index.js';
import { verifyPassword, hashPassword } from '../utils/crypto.js';
import { asyncHandler, badRequest, AppError } from '../utils/errors.js';
import { audit } from '../services/audit.js';
import {
  createSession, setSessionCookie, clearSessionCookie, destroySession, destroyUserSessions,
} from '../services/sessions.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.env === 'test' ? 1000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}:${String(req.body?.username || '').toLowerCase()}`,
  handler: (_req, res) => res.status(429).json({
    error: { code: 'TROP_DE_REQUETES', message: 'Trop de tentatives de connexion — réessayez dans 15 minutes' },
  }),
});

router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest('Identifiant et mot de passe requis', zodFields(parsed.error));
  const db = getDb();
  const { username, password } = parsed.data;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  const generic = () => new AppError(401, 'IDENTIFIANTS_INVALIDES', 'Identifiant ou mot de passe incorrect');

  if (!user || !user.actif) {
    audit(req, 'LOGIN_FAIL', { username, details: { reason: 'inconnu_ou_inactif' } });
    throw generic();
  }
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    audit(req, 'LOGIN_FAIL', { username, userId: user.id, details: { reason: 'verrouille' } });
    throw new AppError(429, 'COMPTE_VERROUILLE', 'Compte temporairement verrouillé — réessayez dans quelques minutes');
  }
  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    const attempts = user.failed_attempts + 1;
    const lockedUntil = attempts >= config.maxLoginAttempts
      ? new Date(Date.now() + config.lockMinutes * 60000).toISOString()
      : null;
    db.prepare('UPDATE users SET failed_attempts = ?, locked_until = ?, updated_at = strftime(\'%Y-%m-%dT%H:%M:%fZ\',\'now\') WHERE id = ?')
      .run(attempts, lockedUntil, user.id);
    audit(req, 'LOGIN_FAIL', { username, userId: user.id, details: { attempts } });
    throw generic();
  }
  db.prepare(`UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login_at = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`)
    .run(new Date().toISOString(), user.id);
  const session = createSession(db, user.id, req);
  setSessionCookie(res, session.token);
  audit(req, 'LOGIN_OK', { userId: user.id, username: user.username });
  res.json({
    user: {
      id: user.id, username: user.username, full_name: user.full_name, role: user.role,
      must_change_password: user.must_change_password,
    },
    csrf: session.csrf,
  });
}));

router.post('/logout', requireAuth, (req, res) => {
  const db = getDb();
  destroySession(db, req.session.id);
  audit(req, 'LOGOUT');
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user, csrf: req.session.csrf });
});

router.post('/change-password', requireAuth, asyncHandler(async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest('Mot de passe invalide', zodFields(parsed.error));
  const db = getDb();
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const ok = await verifyPassword(parsed.data.current, row.password_hash);
  if (!ok) throw badRequest('Mot de passe actuel incorrect', { current: 'Mot de passe actuel incorrect' });
  if (parsed.data.current === parsed.data.next) throw badRequest('Le nouveau mot de passe doit être différent', { next: 'Doit être différent du mot de passe actuel' });
  const policy = passwordErrors(parsed.data.next, row.username);
  if (policy.length) throw badRequest('Mot de passe trop faible', { next: policy.join(' · ') });
  const hash = await hashPassword(parsed.data.next);
  db.prepare(`UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`)
    .run(hash, row.id);
  destroyUserSessions(db, row.id);
  clearSessionCookie(res);
  audit(req, 'PASSWORD_CHANGE');
  res.json({ ok: true });
}));

export default router;
