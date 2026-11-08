import { Router } from 'express';
import { statsQuerySchema, zodFields } from '@anm/shared';
import { getDb } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { badRequest } from '../utils/errors.js';
import { overview, groupStats, timeline, activite } from '../services/stats.js';

const router = Router();

function parsed(req) {
  const result = statsQuerySchema.safeParse(req.query);
  if (!result.success) throw badRequest('Filtres invalides', zodFields(result.error));
  return result.data;
}

router.get('/overview', requireAuth, (req, res) => {
  res.json({ item: overview(getDb(), parsed(req)) });
});

router.get('/group', requireAuth, (req, res) => {
  const params = parsed(req);
  const by = params.by || req.query.by || 'domaine';
  if (!['domaine', 'type', 'daira', 'commune', 'epic', 'agent', 'plateforme', 'priorite'].includes(by)) {
    throw badRequest('Dimension invalide', { by: 'Dimension inconnue' });
  }
  res.json({ item: groupStats(getDb(), by, params) });
});

router.get('/timeline', requireAuth, (req, res) => {
  res.json({ items: timeline(getDb(), parsed(req)) });
});

router.get('/activite', requireAuth, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  res.json({ items: activite(getDb(), limit) });
});

export default router;
