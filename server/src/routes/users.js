import { Router } from 'express';
import { userCreateSchema, userUpdateSchema, zodFields } from '@anm/shared';
import { getDb } from '../db/index.js';
import { requireAdmin } from '../middleware/auth.js';
import { asyncHandler, badRequest, notFound } from '../utils/errors.js';
import { audit } from '../services/audit.js';
import { listUsers, createUser, updateUser, resetUserPassword } from '../services/users.js';
import { destroyUserSessions } from '../services/sessions.js';

const router = Router();
router.use(requireAdmin);

router.get('/', (req, res) => {
  res.json({ items: listUsers(getDb()) });
});

router.post('/', asyncHandler(async (req, res) => {
  const parsed = userCreateSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest('Données invalides', zodFields(parsed.error));
  const user = await createUser(getDb(), parsed.data);
  audit(req, 'USER_CREATE', { entite: 'users', entiteId: user.id, details: { username: user.username, role: user.role } });
  res.status(201).json({ item: user });
}));

router.patch('/:id', (req, res) => {
  const parsed = userUpdateSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest('Données invalides', zodFields(parsed.error));
  const id = Number(req.params.id);
  const user = updateUser(getDb(), id, parsed.data, req.user.id);
  if (user.actif === 0) destroyUserSessions(getDb(), id);
  audit(req, 'USER_UPDATE', { entite: 'users', entiteId: id, details: parsed.data });
  res.json({ item: user });
});

router.post('/:id/reset-password', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!getDb().prepare('SELECT id FROM users WHERE id = ?').get(id)) throw notFound('Utilisateur introuvable');
  const result = await resetUserPassword(getDb(), id, req.body?.password || null);
  destroyUserSessions(getDb(), id);
  audit(req, 'USER_RESET_PASSWORD', { entite: 'users', entiteId: id });
  res.json({ item: result });
}));

export default router;
