import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import * as anomalyService from '../services/anomalyService.js';

const router = Router();

router.get('/export', requireAuth, requireAdmin, async (req, res) => {
  const format = req.query.format;
  if (format === 'xlsx') {
    const buffer = await anomalyService.buildAnomaliesXlsx();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="anomalies.xlsx"');
    return res.send(Buffer.from(buffer));
  }
  if (format === 'csv') {
    const csv = anomalyService.anomaliesToCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="anomalies.csv"');
    return res.send(csv);
  }
  return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Format xlsx ou csv attendu' } });
});

export default router;
