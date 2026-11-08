import { Router } from 'express';
import { reportQuerySchema, snapshotSchema, zodFields } from '@anm/shared';
import { getDb } from '../db/index.js';
import { requireAuth, requireWrite } from '../middleware/auth.js';
import { badRequest } from '../utils/errors.js';
import { audit } from '../services/audit.js';
import {
  weeklyReport, saveSnapshot, listSnapshots, exportWeeklyXlsx,
} from '../services/report.js';

const router = Router();

function parseQuery(req) {
  const parsed = reportQuerySchema.safeParse(req.query);
  if (!parsed.success) throw badRequest('Paramètres invalides', zodFields(parsed.error));
  return parsed.data;
}

router.get('/weekly', requireAuth, (req, res) => {
  const query = parseQuery(req);
  try {
    res.json({ item: weeklyReport(getDb(), query) });
  } catch (error) {
    if (String(error.message).includes('introuvable')) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Version figée introuvable' } });
    }
    throw error;
  }
});

router.get('/weekly/history', requireAuth, (req, res) => {
  res.json({ items: listSnapshots(getDb(), req.query.semaine || null) });
});

router.post('/weekly/snapshot', requireWrite, (req, res) => {
  const parsed = snapshotSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest('Semaine invalide', zodFields(parsed.error));
  const result = saveSnapshot(getDb(), parsed.data.semaine, req.user.id);
  audit(req, 'REPORT_SNAPSHOT', {
    entite: 'rapports_hebdo', entiteId: `${result.semaine_debut}#${result.version}`,
    details: { semaine: result.semaine_debut, version: result.version },
  });
  res.status(201).json({ item: result.report, version: result.version });
});

router.get('/weekly/export', requireAuth, async (req, res, next) => {
  try {
    const query = parseQuery(req);
    const report = weeklyReport(getDb(), query);
    const buffer = await exportWeeklyXlsx(report);
    audit(req, 'EXPORT', { entite: 'rapport_hebdo', details: { semaine: report.semaine.debut, format: 'xlsx' } });
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition', `attachment; filename="synthese-hebdo-${report.semaine.debut}.xlsx"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

export default router;
