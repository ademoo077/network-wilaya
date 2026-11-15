import { veilleSourceSchema, zodFields } from '@anm/shared';
import { badRequest, conflict, notFound } from '../utils/errors.js';
import { getBoolParam } from '../services/settings.js';
import { decryptJson, encryptJson, secretsKeyConfigured } from './secrets.js';
import { ConnectorError } from './http.js';
import { connectorFor, availableConnectors } from './connectors/index.js';
import { collectSource, parseSourceConfig } from './collect.js';
import { ensureVeilleJobs, finishJob } from './scheduler.js';

const SECRET_PATTERN = /token|secret|password|cle|key/i;

export function maskConfig(config) {
  if (!config || typeof config !== 'object') return {};
  const output = {};
  for (const [key, value] of Object.entries(config)) {
    if (SECRET_PATTERN.test(key)) {
      const text = String(value || '');
      output[key] = text ? '••••••••' : '';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      output[key] = maskConfig(value);
    } else {
      output[key] = value;
    }
  }
  return output;
}

function readConfig(row) {
  if (!row.config_chiffree) return { ok: true, value: {} };
  try { return { ok: true, value: decryptJson(row.config_chiffree) }; }
  catch { return { ok: false, value: null }; }
}

function sourceView(row, { admin = false, counts } = {}) {
  const config = readConfig(row);
  return {
    id: row.id, type: row.type, nom: row.nom, actif: row.actif, frequence_min: row.frequence_min,
    derniere_execution: row.derniere_execution, dernier_statut: row.dernier_statut,
    dernier_message: row.dernier_message, jeton_expire_le: row.jeton_expire_le,
    quota: row.quota_json ? safeJson(row.quota_json) : null,
    connecteur_disponible: Boolean(connectorFor(row.type)),
    config_masquee: admin && config.ok ? maskConfig(config.value) : undefined,
    config_erreur: admin && !config.ok ? 'Configuration illisible (clé de chiffrement différente ?)' : undefined,
    elements: counts ? counts.total : undefined,
    a_qualifier: counts ? counts.a_qualifier : undefined,
    retenus: counts ? counts.retenus : undefined,
    job: row.job_statut ? {
      statut: row.job_statut, prochaine_execution: row.prochaine_execution,
      tentatives: row.tentatives, erreur_code: row.erreur_code, erreur_message: row.erreur_message,
      nb_collectes: row.nb_collectes, nb_nouveaux: row.nb_nouveaux,
    } : null,
  };
}

function safeJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

export function listSources(db, { admin = false } = {}) {
  const counts = new Map(db.prepare(`SELECT source_id, COUNT(*) AS total,
    SUM(CASE WHEN statut = 'a_qualifier' THEN 1 ELSE 0 END) AS a_qualifier,
    SUM(CASE WHEN statut = 'retenu' THEN 1 ELSE 0 END) AS retenus
    FROM veille_elements GROUP BY source_id`).all().map((row) => [Number(row.source_id), row]));
  const rows = db.prepare(`SELECT s.*, j.statut AS job_statut, j.prochaine_execution, j.tentatives,
      j.erreur_code, j.erreur_message, j.nb_collectes, j.nb_nouveaux
    FROM veille_sources s LEFT JOIN veille_jobs j ON j.source_id = s.id
    ORDER BY s.actif DESC, s.nom COLLATE NOCASE`).all();
  return rows.map((row) => sourceView(row, { admin, counts: counts.get(Number(row.id)) }));
}

export function getSource(db, id, options = {}) {
  const row = db.prepare(`SELECT s.*, j.statut AS job_statut, j.prochaine_execution, j.tentatives,
      j.erreur_code, j.erreur_message, j.nb_collectes, j.nb_nouveaux
    FROM veille_sources s LEFT JOIN veille_jobs j ON j.source_id = s.id WHERE s.id = ?`).get(id);
  if (!row) throw notFound('Source introuvable');
  return sourceView(row, options);
}

function requireSecretsKey() {
  if (!secretsKeyConfigured()) {
    throw badRequest('SECRETS_KEY absent : configurez une clé de 64 caractères hexadécimaux dans .env avant d’enregistrer une source.');
  }
}

function validateConfig(type, config) {
  if (config === undefined) return undefined;
  try { return parseSourceConfig(type, config).data; }
  catch (error) { throw badRequest(error.message, { config: error.message }); }
}

export function createSource(db, input) {
  const parsed = veilleSourceSchema.safeParse(input);
  if (!parsed.success) throw badRequest('Source invalide', zodFields(parsed.error));
  const config = validateConfig(parsed.data.type, parsed.data.config) || {};
  requireSecretsKey();
  const id = Number(db.prepare(`INSERT INTO veille_sources(type, nom, config_chiffree, actif, frequence_min)
    VALUES (?, ?, ?, ?, ?)`).run(parsed.data.type, parsed.data.nom, encryptJson(config),
    parsed.data.actif, parsed.data.frequence_min).lastInsertRowid);
  ensureVeilleJobs(db);
  return getSource(db, id, { admin: true });
}

export function updateSource(db, id, input) {
  const current = db.prepare('SELECT * FROM veille_sources WHERE id = ?').get(id);
  if (!current) throw notFound('Source introuvable');
  const body = { ...input };
  let encrypted = current.config_chiffree;
  if (body.config !== undefined) {
    const existing = readConfig(current);
    if (!existing.ok) throw badRequest('Configuration existante illisible : impossible de la modifier sans la ressaisir entièrement.');
    const incoming = { ...body.config };
    for (const [key, value] of Object.entries(incoming)) {
      if (value === '••••••••') incoming[key] = existing.value[key];
    }
    const merged = { ...existing.value, ...incoming };
    body.config = validateConfig(current.type, merged);
    requireSecretsKey();
    encrypted = encryptJson(body.config);
  }
  const next = {
    nom: body.nom === undefined ? current.nom : body.nom,
    actif: body.actif === undefined ? current.actif : Number(body.actif),
    frequence_min: body.frequence_min === undefined ? current.frequence_min : Number(body.frequence_min),
  };
  if (!String(next.nom || '').trim() || String(next.nom).trim().length < 2) throw badRequest('Nom de source invalide');
  if (!Number.isInteger(next.frequence_min) || next.frequence_min < 5 || next.frequence_min > 10080) {
    throw badRequest('Fréquence invalide (5 à 10080 minutes)');
  }
  if (![0, 1].includes(next.actif)) throw badRequest('État actif invalide');
  db.prepare(`UPDATE veille_sources SET nom = ?, actif = ?, frequence_min = ?, config_chiffree = ?,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`)
    .run(String(next.nom).trim(), next.actif, next.frequence_min, encrypted, id);
  db.prepare(`UPDATE veille_jobs SET statut = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE source_id = ?`)
    .run(next.actif ? 'idle' : 'disabled', id);
  return getSource(db, id, { admin: true });
}

export function deleteSource(db, id) {
  const result = db.prepare('DELETE FROM veille_sources WHERE id = ?').run(id);
  if (!result.changes) throw notFound('Source introuvable');
  return { id };
}

export async function testSource(db, id, deps = {}) {
  const row = db.prepare('SELECT * FROM veille_sources WHERE id = ?').get(id);
  if (!row) throw notFound('Source introuvable');
  try {
    const { connector, data } = parseSourceConfig(row.type, readConfig(row).value);
    if (!connector) return { ok: false, code: 'CONNECTEUR_INDISPONIBLE', message: 'Connecteur non disponible pour ce type.' };
    const result = await connector.tester({ config: data, deps });
    return { ok: true, ...result };
  } catch (error) {
    if (error instanceof ConnectorError) return { ok: false, code: error.code, message: error.message };
    throw error;
  }
}

export async function collectNow(db, id, deps = {}) {
  const row = db.prepare(`SELECT j.*, s.frequence_min FROM veille_jobs j JOIN veille_sources s ON s.id = j.source_id
    WHERE j.source_id = ?`).get(id);
  if (!row) {
    ensureVeilleJobs(db);
    return collectNow(db, id, deps);
  }
  if (!getBoolParam(db, 'veille_activee', false)) {
    throw conflict('VEILLE_INACTIVE', 'Activez la veille dans les paramètres avant de collecter.');
  }
  if (row.statut === 'running' && row.verrou_le && Date.now() - Date.parse(row.verrou_le) < 30 * 60 * 1000) {
    throw conflict('COLLECTE_EN_COURS', 'Une collecte est déjà en cours pour cette source.');
  }
  const job = { ...row, debut: new Date().toISOString(), tentatives: 0 };
  try {
    const outcome = await collectSource(db, job, deps);
    finishJob(db, job, { ok: true, ...outcome });
    return { ok: true, ...outcome };
  } catch (error) {
    const code = error.code || 'COLLECTE_ECHEC';
    finishJob(db, job, { ok: false, errorCode: code, errorMessage: error.message });
    if (error instanceof ConnectorError) return { ok: false, code, message: error.message };
    throw error;
  }
}

export function listRuns(db, sourceId, limit = 20) {
  return db.prepare(`SELECT id, source_id, debut, fin, statut, nb_collectes, nb_nouveaux,
    erreur_code, erreur_message FROM veille_job_runs WHERE source_id = ? ORDER BY id DESC LIMIT ?`)
    .all(sourceId, Math.min(Math.max(Number(limit) || 20, 1), 100));
}

export function connectorCatalog() {
  return availableConnectors();
}
