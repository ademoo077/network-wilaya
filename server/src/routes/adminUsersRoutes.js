import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import * as userService from '../services/userService.js';
import { logAudit } from '../services/auditService.js';

const router = Router();

router.get('/', requireAuth, requireAdmin, (req, res) => res.json({ data: userService.listUsers() }));

router.post('/', requireAuth, requireAdmin, (req, res) => {
  const body = req.body || {};
  const user = userService.createUser({ username: body.username, fullName: body.fullName, password: body.password, role: body.role });
  logAudit({ userId: req.user.id, action: 'USER_CREATE', entite: 'user', entiteId: user.id, details: { username: user.username }, ip: req.ip });
  return res.status(201).json({ user });
});

router.patch('/:id', requireAuth, requireAdmin, (req, res) => {
  const user = userService.updateUser(Number(req.params.id), req.body);
  logAudit({ userId: req.user.id, action: 'USER_UPDATE', entite: 'user', entiteId: user.id, details: { username: user.username }, ip: req.ip });
  return res.json({ user });
});

router.delete('/:id', requireAuth, requireAdmin, (req, res) => {
  const result = userService.deleteUser(Number(req.params.id));
  logAudit({ userId: req.user.id, action: 'USER_DELETE', entite: 'user', entiteId: Number(req.params.id), details: { username: req.params.id }, ip: req.ip });
  return res.json(result);
});

export default router;
