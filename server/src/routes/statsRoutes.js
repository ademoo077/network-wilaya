import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as stats from '../services/stats.js';

const router = Router();

router.get('/summary', requireAuth, (req, res) => res.json(stats.getSummary(req.query)));

router.get('/by-category', requireAuth, (req, res) => res.json({ data: stats.getByCategory(req.query) }));

router.get('/by-type', requireAuth, (req, res) => res.json({ data: stats.getByType(req.query) }));

router.get('/by-daira', requireAuth, (req, res) => res.json({ data: stats.getByDaira(req.query) }));

router.get('/by-commune', requireAuth, (req, res) => res.json({ data: stats.getByCommune(req.query) }));

router.get('/by-epic', requireAuth, (req, res) => res.json({ data: stats.getByEpic(req.query) }));

router.get('/by-platform', requireAuth, (req, res) => res.json({ data: stats.getByPlatform(req.query) }));

router.get('/timeline', requireAuth, (req, res) => res.json({ data: stats.getTimeline({ from: req.query.from, to: req.query.to, granularity: req.query.granularity }) }));

router.get('/weekly', requireAuth, (req, res) => res.json({ data: stats.getWeekly({ weeks: Number(req.query.weeks) || 12 }) }));

export default router;
