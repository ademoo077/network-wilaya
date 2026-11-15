import { getBoolParam } from '../services/settings.js';
import { refreshAlerts } from './alerts.js';

const STALE_LOCK_MS = 30 * 60 * 1000;

function iso(date = new Date()) { return date.toISOString(); }

export function ensureVeilleJobs(db) {
  return db.prepare(`INSERT OR IGNORE INTO veille_jobs(source_id, statut, prochaine_execution)
    SELECT id, CASE WHEN actif = 1 THEN 'idle' ELSE 'disabled' END,
           strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM veille_sources`).run().changes;
}

export function claimNextJob(db, owner, now = new Date()) {
  const at = iso(now);
  const stale = iso(new Date(now.getTime() - STALE_LOCK_MS));
  return db.transaction(() => {
    const row = db.prepare(`SELECT j.*, s.type AS source_type, s.nom AS source_nom, s.frequence_min,
        s.config_chiffree, s.curseur
      FROM veille_jobs j JOIN veille_sources s ON s.id = j.source_id
      WHERE s.actif = 1 AND j.statut <> 'running' AND j.prochaine_execution <= ?
        AND (j.verrou_le IS NULL OR j.verrou_le < ?)
      ORDER BY j.prochaine_execution, j.id LIMIT 1`).get(at, stale);
    if (!row) return null;
    db.prepare(`UPDATE veille_jobs SET statut = 'running', debut = ?, verrou_par = ?, verrou_le = ?,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`).run(at, owner, at, row.id);
    return { ...row, statut: 'running', debut: at, verrou_par: owner };
  })();
}

export function finishJob(db, job, outcome, now = new Date()) {
  const at = iso(now);
  const attempts = outcome.ok ? 0 : Number(job.tentatives || 0) + 1;
  const delaySec = outcome.ok ? Math.max(60, Number(job.frequence_min || 30) * 60)
    : Math.min(3600, 30 * (2 ** (attempts - 1)));
  const next = iso(new Date(now.getTime() + delaySec * 1000));
  db.transaction(() => {
    db.prepare(`UPDATE veille_jobs SET statut = ?, fin = ?, nb_collectes = ?, nb_nouveaux = ?,
      erreur_code = ?, erreur_message = ?, tentatives = ?, prochaine_execution = ?,
      verrou_par = NULL, verrou_le = NULL, updated_at = ? WHERE id = ?`)
      .run(outcome.ok ? 'success' : 'backoff', at, outcome.collected || 0, outcome.newCount || 0,
        outcome.errorCode || null, outcome.errorMessage || null, attempts, next, at, job.id);
    db.prepare(`UPDATE veille_sources SET derniere_execution = ?, dernier_statut = ?, dernier_message = ?,
      updated_at = ? WHERE id = ?`)
      .run(at, outcome.ok ? 'ok' : 'erreur', outcome.errorMessage || null, at, job.source_id);
    db.prepare(`INSERT INTO veille_job_runs(source_id, debut, fin, statut, nb_collectes, nb_nouveaux,
      erreur_code, erreur_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(job.source_id, job.debut || at, at, outcome.ok ? 'success' : 'error',
        outcome.collected || 0, outcome.newCount || 0, outcome.errorCode || null, outcome.errorMessage || null);
  })();
  return { attempts, next };
}

export function scheduleSourceNow(db, sourceId, now = new Date()) {
  return db.prepare(`UPDATE veille_jobs SET prochaine_execution = ?, statut = 'idle', tentatives = 0,
    erreur_code = NULL, erreur_message = NULL, updated_at = ? WHERE source_id = ?`)
    .run(iso(now), iso(now), sourceId).changes;
}

export async function runDueJobs(db, { owner = 'veille', collect, now = new Date(), max = 5, logger = console } = {}) {
  ensureVeilleJobs(db);
  const results = [];
  for (let index = 0; index < max; index += 1) {
    const job = claimNextJob(db, owner, now);
    if (!job) break;
    let outcome;
    try {
      const value = collect ? await collect(job) : { collected: 0, newCount: 0 };
      outcome = { ok: true, collected: value?.collected || 0, newCount: value?.newCount || 0, ...value };
    } catch (error) {
      outcome = { ok: false, errorCode: error?.code || 'COLLECTE_ECHEC', errorMessage: error?.message || 'Erreur de collecte' };
      logger.warn?.(`Veille ${job.source_nom || job.source_id} : ${outcome.errorMessage}`);
    }
    results.push({ job, outcome, timing: finishJob(db, job, outcome, now) });
  }
  return results;
}

export function startVeilleScheduler({ db, collect, logger = console, intervalMs = 60_000, auto = true } = {}) {
  const tick = () => {
    if (!getBoolParam(db, 'veille_activee', false)) return;
    runDueJobs(db, { owner: 'planificateur', collect, logger })
      .then(() => refreshAlerts(db))
      .catch((error) => logger.warn?.(`Planificateur Veille : ${error.message}`));
  };
  if (auto) {
    const timer = setInterval(tick, intervalMs);
    timer.unref?.();
    tick();
    return () => clearInterval(timer);
  }
  return () => {};
}
