import fs from 'node:fs';
import { X509Certificate } from 'node:crypto';
import { WORK_QUEUES, todayAlgiers } from '@anm/shared';
import { buildFilters } from './anomalyQuery.js';
import { config } from '../config/index.js';
import { hasAutoBackupToday } from './backups.js';

function queueCounts(db) {
  const counts = {};
  for (const queue of WORK_QUEUES) {
    const { clause, values } = buildFilters(queue.filters);
    counts[queue.id] = db.prepare(`SELECT COUNT(*) AS n FROM anomalies a ${clause}`)
      .get({ ...values, filterToday: todayAlgiers() }).n;
  }
  return counts;
}

/** Certificat HTTPS : date d'expiration lisible, ou null si HTTP. */
export function certificateExpiry() {
  if (!config.https || !fs.existsSync(config.httpsCert)) return null;
  try { return new X509Certificate(fs.readFileSync(config.httpsCert)).validTo; } catch { return 'TLS_ERROR'; }
}

function systemAlerts(user) {
  if (user.role !== 'admin') return {};
  const expiry = certificateExpiry();
  const expiring = typeof expiry === 'string' && expiry !== 'TLS_ERROR'
    ? new Date(expiry).getTime() - Date.now() < 30 * 86400000 : false;
  return {
    sauvegarde_manquante: hasAutoBackupToday(config.backupDir) ? 0 : 1,
    certificat_expire: expiring || expiry === 'TLS_ERROR' ? 1 : 0,
  };
}

/**
 * File de travail calculée à la volée (aucune table dédiée) : les compteurs
 * proviennent des mêmes conditions SQL que la liste filtrée correspondante.
 */
export function workQueue(db, user) {
  const counts = queueCounts(db);
  return {
    items: WORK_QUEUES.map((queue) => ({
      id: queue.id,
      label: queue.label,
      gravite: queue.gravite,
      filters: queue.filters,
      count: counts[queue.id] || 0,
    })),
    alertes: systemAlerts(user),
    total: Object.values(counts).reduce((sum, value) => sum + value, 0),
    calcule_le: new Date().toISOString(),
  };
}
