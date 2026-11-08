import { Router } from 'express';
import { settingsSchema, zodFields } from '@anm/shared';
import { getDb } from '../db/index.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { badRequest } from '../utils/errors.js';
import { audit } from '../services/audit.js';
import { getParams, setParams, publicParams } from '../services/settings.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  const item = req.user.role === 'admin' ? getParams(db) : publicParams(db);
  res.json({ item });
});

router.put('/', requireAdmin, (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest('Paramètres invalides', zodFields(parsed.error));
  const item = setParams(getDb(), parsed.data);
  audit(req, 'PARAM_UPDATE', { entite: 'parametres', details: parsed.data });
  res.json({ item });
});

export default router;
