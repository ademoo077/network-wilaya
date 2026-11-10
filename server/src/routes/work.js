import { Router } from 'express';
import { getDb } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { workQueue } from '../services/workQueue.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  res.json({ item: workQueue(getDb(), req.user) });
});

export default router;
