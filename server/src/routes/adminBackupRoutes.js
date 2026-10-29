import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import * as backupService from '../services/backupService.js';
import { logAudit } from '../services/auditService.js';

const router = Router();

router.post('/', requireAuth, requireAdmin, (req, res) => {
  const backup = backupService.createBackup();
  logAudit({ userId: req.user.id, action: 'BACKUP_CREATE', entite: 'backup', entiteId: backup.filename, details: backup, ip: req.ip });
  return res.status(201).json({ backup });
});

router.get('/', requireAuth, requireAdmin, (req, res) => res.json({ data: backupService.listBackups() }));

router.post('/restore', requireAuth, requireAdmin, (req, res) => {
  const { filename } = req.body || {};
  if (!filename) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'filename requis' } });
  }
  const result = backupService.restoreBackup(filename);
  logAudit({ userId: req.user.id, action: 'BACKUP_RESTORE', entite: 'backup', entiteId: result.filename, details: result, ip: req.ip });
  return res.json({ backup: result });
});

export default router;
