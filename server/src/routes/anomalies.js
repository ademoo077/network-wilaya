import { Router } from 'express';
import multer from 'multer';
import {
  anomalieCreateSchema, anomaliePatchSchema, anomalieQuerySchema, statutChangeSchema,
  verificationChangeSchema, bulkStatutSchema, importCommitSchema, zodFields,
  nearbyQuerySchema,
} from '@anm/shared';
import { getDb } from '../db/index.js';
import { requireAuth, requireAdmin, requireWrite } from '../middleware/auth.js';
import { asyncHandler, badRequest } from '../utils/errors.js';
import { audit } from '../services/audit.js';
import { getBoolParam } from '../services/settings.js';
import { getAnomalie, listAnomalies, getHistorique, listCorbeille } from '../services/anomalyRead.js';
import {
  createAnomalie, updateAnomalie, deleteAnomalie, restoreAnomalie, bulkStatut, checkLink,
} from '../services/anomalies.js';
import { exportAnomalies } from '../services/export.js';
import {
  previewImport, commitImport, importTemplate, importErrorsCsv,
} from '../services/importAnomalies.js';
import { savePiece } from '../services/attachments.js';
import { nearbyAnomalies } from '../services/geoLocation.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });

const settings = () => ({ exigerVerification: getBoolParam(getDb(), 'exiger_verification', true) });
const parse = (schema, body) => {
  const result = schema.safeParse(body);
  if (!result.success) throw badRequest('Données invalides', zodFields(result.error));
  return result.data;
};

router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  const parsed = anomalieQuerySchema.safeParse(req.query);
  if (!parsed.success) throw badRequest('Filtres invalides', zodFields(parsed.error));
  const params = parsed.data;
  const isTrash = req.query.corbeille === '1';
  if (isTrash && req.user.role !== 'admin') {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Corbeille réservée aux administrateurs' } });
  }
  const result = isTrash ? listCorbeille(db, params) : listAnomalies(db, params);
  res.json(result);
});

router.get('/check-link', requireAuth, (req, res) => {
  res.json({ item: checkLink(getDb(), req.query.url) });
});

router.get('/nearby', requireAuth, (req, res) => {
  const parsed = nearbyQuerySchema.safeParse(req.query);
  if (!parsed.success) throw badRequest('Position ou rayon invalide', zodFields(parsed.error));
  res.json({ items: nearbyAnomalies(getDb(), parsed.data) });
});

router.get('/export', requireAuth, asyncHandler(async (req, res) => {
  const parsed = anomalieQuerySchema.safeParse(req.query);
  if (!parsed.success) throw badRequest('Filtres invalides', zodFields(parsed.error));
  const format = req.query.format === 'csv' ? 'csv' : 'xlsx';
  const result = await exportAnomalies(getDb(), parsed.data, format);
  audit(req, 'EXPORT', { entite: 'anomalies', details: { format, lignes: result.count, filtres: parsed.data } });
  res.set('Content-Type', result.contentType);
  res.set('Content-Disposition', `attachment; filename="${result.filename}"`);
  res.send(result.buffer);
}));

router.get('/import/template', requireAuth, (req, res) => {
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', 'attachment; filename="modele-import-anomalies.csv"');
  res.send(importTemplate());
});

router.post('/import/preview', requireWrite, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw badRequest('Fichier CSV ou XLSX requis');
  const result = await previewImport(getDb(), req.file, req.user, settings());
  res.json({ item: result });
}));

router.post('/import/commit', requireWrite, asyncHandler(async (req, res) => {
  const data = parse(importCommitSchema, req.body);
  const result = await commitImport(getDb(), data.importId, data.mode, req.user, settings());
  audit(req, 'IMPORT_COMMIT', { entite: 'anomalies', details: result.summary });
  res.json({ item: result });
}));

router.get('/import/report/:importId', requireWrite, (req, res) => {
  const csv = importErrorsCsv(req.params.importId);
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="rapport-import-${req.params.importId}.csv"`);
  res.send(csv);
});

router.post('/bulk-statut', requireWrite, (req, res) => {
  const data = parse(bulkStatutSchema, req.body);
  const result = bulkStatut(getDb(), data, req.user.id, settings());
  audit(req, 'ANOMALIE_STATUT', { entite: 'anomalies', details: { bulk: true, ids: data.ids, statut: data.statut, ok: result.ok.length, echecs: result.echecs.length } });
  res.json({ item: result });
});

router.post('/', requireWrite, (req, res) => {
  const data = parse(anomalieCreateSchema, req.body);
  const item = createAnomalie(getDb(), data, req.user.id, settings());
  audit(req, 'ANOMALIE_CREATE', { entite: 'anomalies', entiteId: item.id, details: { reference: item.reference } });
  res.status(201).json({ item });
});

router.get('/:id', requireAuth, (req, res) => {
  const item = getAnomalie(getDb(), Number(req.params.id));
  if (!item) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Anomalie introuvable' } });
  res.json({ item });
});

router.get('/:id/historique', requireAuth, (req, res) => {
  const item = getAnomalie(getDb(), Number(req.params.id));
  if (!item) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Anomalie introuvable' } });
  res.json({ items: getHistorique(getDb(), Number(req.params.id)) });
});

router.patch('/:id', requireWrite, (req, res) => {
  const data = parse(anomaliePatchSchema, req.body);
  const { item, changes } = updateAnomalie(getDb(), Number(req.params.id), data, req.user.id, settings());
  const action = changes.some((c) => c.champ === 'statut') ? 'ANOMALIE_STATUT'
    : changes.some((c) => c.champ === 'verification') ? 'ANOMALIE_VERIFICATION' : 'ANOMALIE_UPDATE';
  audit(req, action, { entite: 'anomalies', entiteId: item.id, details: { champs: changes.map((c) => c.champ) } });
  res.json({ item });
});

router.post('/:id/statut', requireWrite, (req, res) => {
  const data = parse(statutChangeSchema, req.body);
  const { item, changes } = updateAnomalie(getDb(), Number(req.params.id), data, req.user.id, settings());
  audit(req, 'ANOMALIE_STATUT', { entite: 'anomalies', entiteId: item.id, details: { statut: data.statut, champs: changes.map((c) => c.champ) } });
  res.json({ item });
});

router.post('/:id/verification', requireWrite, (req, res) => {
  const data = parse(verificationChangeSchema, req.body);
  const { item, changes } = updateAnomalie(getDb(), Number(req.params.id), data, req.user.id, settings());
  audit(req, 'ANOMALIE_VERIFICATION', { entite: 'anomalies', entiteId: item.id, details: { verification: data.verification, champs: changes.map((c) => c.champ) } });
  res.json({ item });
});

router.delete('/:id', requireAdmin, (req, res) => {
  const result = deleteAnomalie(getDb(), Number(req.params.id), req.user.id, req.body?.motif || null);
  audit(req, 'ANOMALIE_DELETE', { entite: 'anomalies', entiteId: result.id });
  res.json({ ok: true, item: result });
});

router.post('/:id/restore', requireAdmin, (req, res) => {
  const item = restoreAnomalie(getDb(), Number(req.params.id), req.user.id);
  audit(req, 'ANOMALIE_RESTORE', { entite: 'anomalies', entiteId: item.id });
  res.json({ item });
});

router.post('/:id/pieces', requireWrite, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw badRequest('Fichier requis');
  const item = await savePiece(getDb(), Number(req.params.id), req.file, req.user.id);
  res.status(201).json({ item });
}));

router.get('/:id/pieces', requireAuth, (req, res) => {
  const items = getDb().prepare('SELECT id, nom_original, mime, taille, created_at FROM pieces_jointes WHERE anomalie_id = ? ORDER BY id').all(Number(req.params.id));
  res.json({ items });
});

export default router;
