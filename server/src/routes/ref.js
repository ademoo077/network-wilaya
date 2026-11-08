import { Router } from 'express';
import crypto from 'node:crypto';
import multer from 'multer';
import { refSchemas, refUpdateSchemas, refBulkTerritoireSchema, zodFields } from '@anm/shared';
import { getDb } from '../db/index.js';
import { requireAdmin } from '../middleware/auth.js';
import { badRequest, notFound } from '../utils/errors.js';
import { audit } from '../services/audit.js';
import {
  bootstrap, setupStatus, createRef, updateRef, disableRef, findRef, listRef,
  bulkTerritoire, allParams,
} from '../services/refs.js';
import { importRefRows, parseCsv, templateColumns } from '../services/refImport.js';
import { REF_ENTITIES } from '@anm/shared';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.get('/setup/status', (req, res) => {
  res.json(setupStatus(getDb()));
});

router.get('/bootstrap', (req, res) => {
  const payload = bootstrap(getDb());
  const body = JSON.stringify(payload);
  const etag = `"${crypto.createHash('sha1').update(body).digest('hex')}"`;
  res.set('ETag', etag);
  res.set('Cache-Control', 'private, max-age=0, must-revalidate');
  if (req.headers['if-none-match'] === etag) return res.status(304).end();
  res.type('json').send(body);
});

router.get('/params', (req, res) => {
  res.json({ item: allParams(getDb()) });
});

router.post('/bulk-territoire', requireAdmin, (req, res) => {
  const parsed = refBulkTerritoireSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest('Données invalides', zodFields(parsed.error));
  const result = bulkTerritoire(getDb(), parsed.data.texte, Boolean(parsed.data.dryRun));
  if (result.applied) audit(req, 'REF_CREATE', { entite: 'territoire', details: { ...result.totals, ...result } });
  res.json({ item: result });
});

router.get('/:entite', (req, res) => {
  if (!REF_ENTITIES.includes(req.params.entite)) throw notFound('Entité inconnue');
  res.json({ items: listRef(getDb(), req.params.entite) });
});

router.get('/:entite/template', requireAdmin, (req, res) => {
  if (!REF_ENTITIES.includes(req.params.entite)) throw notFound('Entité inconnue');
  const cols = templateColumns(req.params.entite);
  const csv = `\uFEFF${cols.join(',')}\n`;
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="modele-${req.params.entite}.csv"`);
  res.send(csv);
});

router.post('/:entite/import', requireAdmin, upload.single('file'), (req, res) => {
  const { entite } = req.params;
  if (!REF_ENTITIES.includes(entite)) throw notFound('Entité inconnue');
  if (!req.file) throw badRequest('Fichier CSV requis');
  const commit = req.query.commit === '1' || req.body.commit === '1';
  const rows = parseCsv(req.file.buffer);
  const result = importRefRows(getDb(), entite, rows, { commit });
  if (commit) audit(req, 'REF_CREATE', { entite, details: result.summary });
  res.json({ item: result });
});

router.post('/:entite', requireAdmin, (req, res) => {
  const { entite } = req.params;
  if (!REF_ENTITIES.includes(entite)) throw notFound('Entité inconnue');
  const parsed = refSchemas[entite].safeParse(req.body);
  if (!parsed.success) throw badRequest('Données invalides', zodFields(parsed.error));
  const result = createRef(getDb(), entite, parsed.data);
  audit(req, 'REF_CREATE', { entite, entiteId: result.id, details: parsed.data });
  res.status(201).json({ item: findRef(getDb(), entite, result.id) });
});

router.patch('/:entite/:id', requireAdmin, (req, res) => {
  const { entite } = req.params;
  if (!REF_ENTITIES.includes(entite)) throw notFound('Entité inconnue');
  const parsed = refUpdateSchemas[entite].safeParse(req.body);
  if (!parsed.success) throw badRequest('Données invalides', zodFields(parsed.error));
  const id = Number(req.params.id);
  if (!findRef(getDb(), entite, id)) throw notFound('Référentiel introuvable');
  updateRef(getDb(), entite, id, parsed.data);
  audit(req, 'REF_UPDATE', { entite, entiteId: id, details: parsed.data });
  res.json({ item: findRef(getDb(), entite, id) });
});

router.delete('/:entite/:id', requireAdmin, (req, res) => {
  const { entite } = req.params;
  if (!REF_ENTITIES.includes(entite)) throw notFound('Entité inconnue');
  const id = Number(req.params.id);
  if (!findRef(getDb(), entite, id)) throw notFound('Référentiel introuvable');
  disableRef(getDb(), entite, id);
  audit(req, 'REF_DISABLE', { entite, entiteId: id });
  res.json({ item: findRef(getDb(), entite, id), deactivated: true });
});

export default router;
