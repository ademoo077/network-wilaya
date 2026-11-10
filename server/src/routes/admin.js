import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { X509Certificate } from 'node:crypto';
import { formatDateTime, VERSION } from '@anm/shared';
import { config } from '../config/index.js';
import { getDb } from '../db/index.js';
import { runMigrations } from '../db/migrate.js';
import { requireAdmin } from '../middleware/auth.js';
import { setMaintenance } from '../middleware/maintenance.js';
import { asyncHandler, badRequest, notFound } from '../utils/errors.js';
import { audit, listAudit } from '../services/audit.js';
import {
  listBackups, createBackup, requireBackupName, restoreBackup, schemaVersion,
} from '../services/backups.js';
import { getParams } from '../services/settings.js';
import { checkConnectivity } from '../services/connectivity.js';

const router = Router();
router.use(requireAdmin);
router.post('/connectivity', asyncHandler(async (_req, res) => res.json(await checkConnectivity())));
router.get('/health', (_req, res) => {
  let certificate = null;
  if (config.https && fs.existsSync(config.httpsCert)) {
    try { certificate = new X509Certificate(fs.readFileSync(config.httpsCert)).validTo; } catch { certificate = 'TLS_ERROR'; }
  }
  res.json({ version: VERSION, integrity: getDb().pragma('integrity_check', { simple: true }),
    size: fs.existsSync(config.dbPath) ? fs.statSync(config.dbPath).size : 0, https: config.https, certificate,
    backup: listBackups(config.backupDir)[0]?.nom || null });
});

function backupPath(nom) {
  const safe = requireBackupName(nom);
  if (!safe) throw badRequest('Nom de sauvegarde invalide');
  const file = path.join(config.backupDir, safe);
  if (!fs.existsSync(file)) throw notFound('Sauvegarde introuvable');
  return { safe, file };
}

router.get('/backups', (_req, res) => {
  const db = getDb();
  res.json({
    items: listBackups(config.backupDir),
    schemaVersion: schemaVersion(db),
    retentionDays: Number(getParams(db).backup_retention_days) || 30,
  });
});

router.post('/backups', asyncHandler(async (req, res) => {
  const backup = await createBackup(getDb(), config.backupDir, 'manuelle');
  audit(req, 'BACKUP_CREATE', { entite: 'sauvegardes', entiteId: backup.nom, details: { taille: backup.taille } });
  res.status(201).json({ item: backup });
}));

router.get('/backups/:nom/download', (req, res, next) => {
  const { safe, file } = backupPath(req.params.nom);
  res.download(file, safe, (error) => { if (error) next(error); });
});

router.delete('/backups/:nom', (req, res) => {
  const { safe, file } = backupPath(req.params.nom);
  fs.unlinkSync(file);
  audit(req, 'BACKUP_DELETE', { entite: 'sauvegardes', entiteId: safe });
  res.json({ ok: true, nom: safe });
});

router.post('/backups/:nom/restore', asyncHandler(async (req, res) => {
  const { safe } = backupPath(req.params.nom);
  if (req.body?.confirm !== 'RESTAURER') {
    throw badRequest('Saisissez « RESTAURER » pour confirmer la restauration', { confirm: 'Confirmation requise' });
  }
  setMaintenance(true);
  try {
    const result = await restoreBackup(getDb(), {
      backupDir: config.backupDir,
      dbPath: config.dbPath,
      name: safe,
      migrate: (db) => runMigrations(db, { logger: console }),
    });
    audit(req, 'BACKUP_RESTORE', { entite: 'sauvegardes', entiteId: safe, details: result });
    res.json({ item: result });
  } catch (error) {
    try {
      audit(req, 'BACKUP_RESTORE', { entite: 'sauvegardes', entiteId: safe, details: { error: error.message } });
    } catch { /* la base peut être indisponible */ }
    throw error;
  } finally {
    setMaintenance(false);
  }
}));

router.get('/audit', (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 25));
  const { rows, total } = listAudit(getDb(), {
    action: req.query.action || null,
    user: req.query.user || null,
    from: req.query.from || null,
    to: req.query.to || null,
    page,
    pageSize,
  });
  res.json({ items: rows, page, pageSize, total });
});

router.get('/audit/export', (req, res) => {
  const { rows } = listAudit(getDb(), {
    action: req.query.action || null,
    user: req.query.user || null,
    from: req.query.from || null,
    to: req.query.to || null,
    page: 1,
    pageSize: 100000,
  });
  const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const header = ['Date', 'Utilisateur', 'Action', 'Entité', 'Identifiant', 'Détail', 'IP'];
  const lines = [header.map(escape).join(';')];
  for (const row of rows) {
    lines.push([
      formatDateTime(row.at), row.username || '', row.action, row.entite || '',
      row.entite_id || '', row.details_json || '', row.ip || '',
    ].map(escape).join(';'));
  }
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', 'attachment; filename="journal-audit.csv"');
  res.send(`\uFEFF${lines.join('\r\n')}`);
});

export default router;
