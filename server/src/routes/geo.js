import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { geoLocateSchema, zodFields } from '@anm/shared';
import { getDb } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { badRequest } from '../utils/errors.js';
import { locatePoint } from '../services/geoLocation.js';

const router = Router();
const limiter = rateLimit({ windowMs: 60 * 1000, max: 120, keyGenerator: (req) => String(req.user.id), standardHeaders: true, legacyHeaders: false });

router.post('/locate', requireAuth, limiter, (req, res) => {
  const parsed = geoLocateSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest('Position invalide', zodFields(parsed.error));
  res.json({ item: locatePoint(getDb(), parsed.data.lat, parsed.data.lng) });
});

router.get('/limit/:communeId', requireAuth, (req, res) => {
  const row = getDb().prepare('SELECT geojson FROM limites_communes WHERE commune_id = ?').get(Number(req.params.communeId));
  if (!row) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Limite communale non configuree' } });
  return res.json({ item: JSON.parse(row.geojson) });
});

export default router;
