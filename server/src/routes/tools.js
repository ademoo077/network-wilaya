import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { parseSmartPaste, smartPasteSchema, zodFields } from '@anm/shared';
import { getDb } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { badRequest } from '../utils/errors.js';
import { getParams } from '../services/settings.js';

const router = Router();
const limiter = rateLimit({ windowMs: 60 * 1000, max: 120, keyGenerator: (req) => String(req.user.id), standardHeaders: true, legacyHeaders: false });

router.post('/parse-paste', requireAuth, limiter, (req, res) => {
  const parsed = smartPasteSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest('Texte invalide', zodFields(parsed.error));
  const bbox = getParams(getDb()).gps_bbox;
  res.json({ item: parseSmartPaste(parsed.data.texte, { bbox }) });
});

export default router;
