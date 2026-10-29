import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import { listAudit } from '../services/auditService.js';

const router = Router();

router.get('/', requireAuth, requireAdmin, (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 50));
  const userId = req.query.userId ? Number(req.query.userId) : undefined;
  const result = listAudit({ page, pageSize, userId });
  return res.json(result);
});

export default router;
