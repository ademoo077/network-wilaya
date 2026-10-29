import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as referenceService from '../services/referenceService.js';

const router = Router();

router.get('/domaines', requireAuth, (req, res) => res.json({ data: referenceService.listDomaines() }));
router.get('/types', requireAuth, (req, res) => res.json({ data: referenceService.listTypes(req.query.domaineId ? Number(req.query.domaineId) : undefined) }));
router.get('/dairas', requireAuth, (req, res) => res.json({ data: referenceService.listDairas() }));
router.get('/communes', requireAuth, (req, res) => res.json({ data: referenceService.listCommunes(req.query.dairaId ? Number(req.query.dairaId) : undefined) }));
router.get('/epics', requireAuth, (req, res) => res.json({ data: referenceService.listEpics() }));
router.get('/agents', requireAuth, (req, res) => res.json({ data: referenceService.listAgents() }));

export default router;
