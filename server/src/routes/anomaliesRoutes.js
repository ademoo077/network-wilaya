import { Router } from 'express';
import { z } from 'zod';
import db from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';
import * as anomalyService from '../services/anomalyService.js';

const router = Router();

const createBody = z.object({
  plateforme: z.enum(['facebook', 'instagram', 'tiktok', 'youtube', 'x', 'whatsapp', 'telegram', 'autre']).optional(),
  lienUrl: z.string().url(),
  datePublication: z.string().optional(),
  dateSignalement: z.string().optional(),
  domaineId: z.number().int().positive(),
  typeId: z.number().int().positive(),
  dairaId: z.number().int().positive(),
  communeId: z.number().int().positive(),
  adresseTexte: z.string().max(255).optional(),
  lieuDit: z.string().max(255).optional(),
  gpsLat: z.number().min(-90).max(90).optional(),
  gpsLng: z.number().min(-180).max(180).optional(),
  saisiPar: z.number().int().positive().optional(),
  agentId: z.number().int().positive().optional(),
  statut: z.enum(['non_traite', 'en_cours', 'traite']).optional(),
  epicId: z.number().int().positive().optional(),
  priorite: z.enum(['normale', 'haute', 'urgente']).optional(),
  observations: z.string().max(2000).optional(),
});

router.post('/', requireAuth, (req, res, next) => {
  const parsed = createBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Donnees invalides', fields: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })) } });
  }
  try {
    const anomaly = anomalyService.createAnomaly(parsed.data);
    return res.status(201).json({ anomaly });
  } catch (err) {
    return next(err);
  }
});

router.get('/', requireAuth, (req, res) => {
  const filters = {
    statut: req.query.statut,
    verification: req.query.verification,
    domaineId: req.query.domaineId ? Number(req.query.domaineId) : undefined,
    typeId: req.query.typeId ? Number(req.query.typeId) : undefined,
    dairaId: req.query.dairaId ? Number(req.query.dairaId) : undefined,
    communeId: req.query.communeId ? Number(req.query.communeId) : undefined,
    epicId: req.query.epicId ? Number(req.query.epicId) : undefined,
    agentId: req.query.agentId ? Number(req.query.agentId) : undefined,
    plateforme: req.query.plateforme,
    from: req.query.from,
    to: req.query.to,
    q: req.query.q,
  };
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 25));
  const sort = req.query.sort;
  const order = req.query.order === 'desc' ? 'desc' : 'asc';
  const result = anomalyService.listAnomalies(filters, { page, pageSize, sort, order });
  return res.json(result);
});

router.get('/check-duplicate', requireAuth, (req, res) => {
  const url = req.query.url;
  if (!url) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Parametre url requis' } });
  }
  const result = anomalyService.findDuplicate(url);
  return res.json(result);
});

router.get('/:id/historique', requireAuth, (req, res) => {
  const anomalyId = Number(req.params.id);
  const anomaly = anomalyService.getAnomalyById(anomalyId);
  if (!anomaly) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Anomalie introuvable' } });
  }
  const historique = anomalyService.getHistorique(anomalyId);
  return res.json({ data: historique });
});

router.get('/:id', requireAuth, (req, res) => {
  const anomaly = anomalyService.getAnomalyById(Number(req.params.id));
  if (!anomaly) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Anomalie introuvable' } });
  }
  return res.json({ anomaly });
});

router.post('/bulk-status', requireAuth, (req, res, next) => {
  const body = req.body || {};
  const ids = Array.isArray(body.ids) ? body.ids.map(Number) : [];
  const statut = body.statut;
  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'ids requis' } });
  }
  try {
    const results = anomalyService.bulkStatus({ ids, statut, epicId: body.epicId, dateTraitement: body.dateTraitement, userId: req.user.id });
    return res.json({ results });
  } catch (err) {
    return next(err);
  }
});

router.patch('/:id', requireAuth, (req, res, next) => {
  const anomalyId = Number(req.params.id);
  const anomaly = anomalyService.getAnomalyById(anomalyId);
  if (!anomaly) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Anomalie introuvable' } });
  }
  try {
    const updated = anomalyService.updateAnomaly(anomalyId, req.body || {}, req.user.id);
    if (!updated) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Anomalie introuvable' } });
    }
    return res.json({ anomaly: updated });
  } catch (err) {
    return next(err);
  }
});

router.delete('/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const anomaly = anomalyService.getAnomalyById(id);
  if (!anomaly) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Anomalie introuvable' } });
  }
  db.prepare('UPDATE anomalies SET deleted_at = ?, updated_at = ? WHERE id = ?').run(new Date().toISOString(), new Date().toISOString(), id);
  return res.json({ ok: true });
});

router.post('/:id/pieces', requireAuth, (req, res) => {
  const body = req.body || {};
  const anomalyId = Number(req.params.id);
  const anomaly = anomalyService.getAnomalyById(anomalyId);
  if (!anomaly) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Anomalie introuvable' } });
  }
  if (!body.chemin || !body.nomOriginal) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'chemin et nomOriginal requis' } });
  }
  const info = db.prepare('INSERT INTO pieces_jointes (anomalie_id, chemin, nom_original, mime, taille, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(anomalyId, body.chemin, body.nomOriginal, body.mime || 'application/octet-stream', Number(body.taille) || 0, req.user.id, new Date().toISOString());
  const piece = db.prepare('SELECT * FROM pieces_jointes WHERE id = ?').get(Number(info.lastInsertRowid));
  return res.status(201).json({ piece });
});

router.delete('/pieces/:id', requireAuth, (req, res) => {
  const info = db.prepare('DELETE FROM pieces_jointes WHERE id = ?').run(Number(req.params.id));
  if (info.changes === 0) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Piece introuvable' } });
  }
  return res.json({ ok: true });
});

export default router;
