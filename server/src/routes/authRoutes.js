import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import db from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';
import { findUserByUsername, getUserById } from '../services/userService.js';

const router = Router();

const loginBody = z.object({
  username: z.string().min(3).max(64),
  password: z.string().min(8).max(128),
});

router.post('/login', (req, res) => {
  const parsed = loginBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Donnees invalides', fields: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })) },
    });
  }
  const user = findUserByUsername(parsed.data.username);
  const valid = Boolean(user) && user.active === 1 && bcrypt.compareSync(parsed.data.password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Identifiants invalides' } });
  }
  const now = new Date().toISOString();
  db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(now, user.id);
  req.session.userId = user.id;
  const fresh = getUserById(user.id);
  return res.status(200).json({ user: fresh });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.post('/change-password', requireAuth, (req, res) => {
  const body = req.body || {};
  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
  if (newPassword.length < 10) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Le nouveau mot de passe doit contenir au moins 10 caracteres' } });
  }
  const currentUser = req.user;
  const user = findUserByUsername(currentUser ? currentUser.username : '');
  if (!user || !bcrypt.compareSync(currentPassword, user.passwordHash)) {
    return res.status(400).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Mot de passe actuel incorrect' } });
  }
  const now = new Date().toISOString();
  db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?').run(bcrypt.hashSync(newPassword, 12), now, user.id);
  return res.status(200).json({ ok: true });
});

export default router;
