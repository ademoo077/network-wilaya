import { getDb } from './db/index.js';
import { runMigrations, ensureTaxonomy, ensureDomainGroups } from './db/migrate.js';
import { ensureAdmin } from './db/admin.js';
import { ensureDailyBackup, applyRetention } from './services/backups.js';
import { config, ensureDirs } from './config/index.js';
import { logger } from './utils/logger.js';

export async function prepareDatabase({ db = getDb(), seed = true, backup = true, log = logger } = {}) {
  ensureDirs();
  runMigrations(db, { logger: log });
  const taxonomy = seed ? ensureTaxonomy(db, config.seedCsv, { logger: log }) : null;
  const groups = seed ? ensureDomainGroups(db, config.groupsCsv, { logger: log }) : null;
  db.prepare(`INSERT INTO parametres(cle,valeur) VALUES ('https_actif',?)
              ON CONFLICT(cle) DO UPDATE SET valeur=excluded.valeur`).run(config.https ? '1' : '0');
  // Corrige l'ancien fond OSM bloqué par la politique d'utilisation des tuiles.
  const oldTile = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const newTile = 'https://tile.openstreetmap.de/{z}/{x}/{y}.png';
  const tile = db.prepare('SELECT valeur FROM parametres WHERE cle = ?').get('tile_url');
  if (tile?.valeur === oldTile) {
    db.prepare('UPDATE parametres SET valeur = ? WHERE cle = ?').run(newTile, 'tile_url');
    log.info?.('Paramètre tile_url mis à jour (ancien fond OSM bloqué remplacé)');
  }
  const admin = await ensureAdmin(db, config, log);
  if (backup) {
    try {
      const created = await ensureDailyBackup(db, config.backupDir);
      if (created) {
        applyRetention(config.backupDir, Number(db.prepare("SELECT valeur FROM parametres WHERE cle='backup_retention_days'").get()?.valeur || 30));
        log.info?.(`Sauvegarde automatique : ${created.nom}`);
      }
    } catch (error) {
      log.warn?.(`Sauvegarde automatique impossible : ${error.message}`);
    }
  }
  return { taxonomy, groups, admin };
}

export function startBackgroundJobs(db = getDb(), log = logger) {
  const cleanup = () => {
    try {
      const res = db.prepare("DELETE FROM sessions WHERE expires_at < strftime('%Y-%m-%dT%H:%M:%fZ','now')").run();
      if (res.changes) log.info?.(`Sessions expirées supprimées : ${res.changes}`);
    } catch (error) {
      log.warn?.(`Nettoyage sessions : ${error.message}`);
    }
  };
  cleanup();
  const sessionTimer = setInterval(cleanup, 60 * 60 * 1000);
  const dailyTimer = setInterval(async () => {
    try {
      const created = await ensureDailyBackup(db, config.backupDir);
      if (created) log.info?.(`Sauvegarde automatique : ${created.nom}`);
    } catch (error) {
      log.warn?.(`Sauvegarde quotidienne : ${error.message}`);
    }
  }, 6 * 60 * 60 * 1000);
  return () => { clearInterval(sessionTimer); clearInterval(dailyTimer); };
}
