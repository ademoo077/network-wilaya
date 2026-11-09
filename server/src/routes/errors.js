import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { getDb } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, badRequest } from '../utils/errors.js';
import { zodFields } from '@anm/shared';

const router = Router();
const limiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  keyGenerator: (req) => String(req.user?.id || req.ip),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({
    error: { code: 'TROP_DE_REQUETES', message: 'Trop de requêtes — réessayez dans une minute' },
  }),
});

const schema = z.object({
  message: z.string().max(2000),
  stack: z.string().max(4000).optional(),
  route: z.string().max(500).optional(),
  userAgent: z.string().max(500).optional(),
  version: z.string().max(20).optional(),
});

router.post('/client-errors', requireAuth, limiter, asyncHandler(async (req, res) => {
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) throw badRequest('Rapport invalide', zodFields(parsed.error));
  const db = getDb();
  db.prepare(`INSERT INTO erreurs_client(message, stack, route, user_agent, version, user_id, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(
      parsed.data.message.slice(0, 2000),
      parsed.data.stack || null,
      parsed.data.route || null,
      parsed.data.userAgent || null,
      parsed.data.version || null,
      req.user?.id || null,
      new Date().toISOString(),
    );
  res.json({ ok: true });
}));

export default router;
