import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { getDb } from '../db/index.js';
import { requireAdmin } from '../middleware/auth.js';
import { badRequest } from '../utils/errors.js';
import { audit } from '../services/audit.js';
import { importGeoJson } from '../services/geojson.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024, files: 1 } });
const limiter = rateLimit({ windowMs: 60 * 1000, max: 20, keyGenerator: (req) => String(req.user.id), standardHeaders: true, legacyHeaders: false });

router.post('/import-geojson', requireAdmin, limiter, upload.single('file'), (req, res) => {
  if (!req.file) throw badRequest('Fichier GeoJSON requis');
  const commit = req.query.commit === '1' || req.body.commit === '1';
  const result = importGeoJson(getDb(), req.file.buffer, {
    property: req.body.property,
    mapping: req.body.mapping,
    commit,
  });
  if (commit) audit(req, 'LIMITES_IMPORT', { entite: 'limites_communes', details: result.summary });
  res.json({ item: result });
});

export default router;
