import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as reportsService from '../services/reportsService.js';

const router = Router();

router.get('/weekly', requireAuth, (req, res) => {
  const weekStart = req.query.week_start || new Date().toISOString().slice(0, 10);
  const report = reportsService.getWeeklyReport(weekStart);
  return res.json({ report });
});

router.post('/weekly/snapshot', requireAuth, (req, res) => {
  const { week_start } = req.body || {};
  const weekStart = week_start || new Date().toISOString().slice(0, 10);
  const report = reportsService.getWeeklyReport(weekStart);
  const snapshotJson = JSON.stringify(report);
  const row = reportsService.saveWeeklySnapshot({ semaine_debut: report.semaine_debut, semaine_fin: report.semaine_fin, snapshotJson, userId: req.user.id });
  return res.status(201).json({ snapshot: row });
});

router.get('/weekly/history', requireAuth, (req, res) => {
  const snapshots = reportsService.listWeeklySnapshots();
  return res.json({ data: snapshots });
});

router.get('/weekly/export', requireAuth, async (req, res) => {
  const format = req.query.format;
  const weekStart = req.query.week_start || new Date().toISOString().slice(0, 10);
  const report = reportsService.getWeeklyReport(weekStart);
  if (format === 'xlsx') {
    const buffer = await reportsService.buildWeeklyReportXlsx(report);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="rapport.xlsx"');
    return res.send(buffer);
  }
  return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Format xlsx attendu' } });
});

export default router;
