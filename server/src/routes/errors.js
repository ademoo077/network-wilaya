import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getDb } from '../db/index.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { asyncHandler, badRequest } from '../utils/errors.js';
import { clientErrorSchema, sanitizeClientError, zodFields } from '@anm/shared';

const router = Router();
const limiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({
    error: { code: 'TROP_DE_REQUETES', message: 'Trop de requêtes — réessayez dans une minute' },
  }),
});

router.post('/client-errors', requireAuth, limiter, asyncHandler(async (req, res) => {
  const parsed = clientErrorSchema.safeParse(req.body || {});
  if (!parsed.success) throw badRequest('Rapport invalide', zodFields(parsed.error));
  const db = getDb();
  const data = sanitizeClientError(parsed.data);
  db.prepare("DELETE FROM erreurs_client WHERE created_at < strftime('%Y-%m-%dT%H:%M:%fZ','now','-30 days')").run();
  db.prepare(`INSERT INTO erreurs_client(message, stack, route, user_agent, version, user_id, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(
      data.message, data.stack || null, data.route || null, data.userAgent, data.version, null,
      new Date().toISOString(),
    );
  res.json({ ok: true });
}));
router.get('/admin/client-errors', requireAdmin, (_req, res) => {
  res.json({ items: getDb().prepare("SELECT id,message,stack,route,user_agent,version,created_at FROM erreurs_client WHERE created_at >= strftime('%Y-%m-%dT%H:%M:%fZ','now','-30 days') ORDER BY id DESC LIMIT 100").all() });
});

export default router;
