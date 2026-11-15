import { decryptJson, SecretsError } from './secrets.js';
import { veilleContext } from './context.js';
import { createVeilleElement } from './ingest.js';
import { connectorFor } from './connectors/index.js';
import { ConnectorError } from './http.js';
import { isViral, viraliteScore } from '@anm/shared';

function iso(date = new Date()) { return date.toISOString(); }

function readCursor(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
}

function configErrors(error) {
  return error.issues.map((issue) => `${issue.path.join('.') || 'config'} : ${issue.message}`).join(' ; ');
}

export function sourceConfig(row) {
  if (!row?.config_chiffree) return {};
  try { return decryptJson(row.config_chiffree); } catch (error) {
    if (error instanceof SecretsError) throw new ConnectorError(error.code, error.message);
    throw error;
  }
}

export function parseSourceConfig(type, config) {
  const connector = connectorFor(type);
  if (!connector) return { connector: null, data: config || {} };
  const parsed = connector.schemaConfig.safeParse(config || {});
  if (!parsed.success) throw new ConnectorError('CONFIG_INVALIDE', configErrors(parsed.error));
  return { connector, data: parsed.data };
}

/** Collecte une source : mapping, analyse, dédoublonnage et curseur. */
export async function collectSource(db, job, deps = {}) {
  const source = db.prepare('SELECT * FROM veille_sources WHERE id = ?').get(job.source_id);
  if (!source) throw new ConnectorError('SOURCE_INTROUVABLE', 'Source absente ou supprimée');
  const { connector, data } = parseSourceConfig(source.type, sourceConfig(source));
  if (!connector) throw new ConnectorError('CONNECTEUR_INDISPONIBLE', `Aucun connecteur disponible pour « ${source.type} »`);
  const curseur = readCursor(source.curseur);
  const result = await connector.collecter({
    config: data, curseur, depuis: source.derniere_execution, source, deps,
  });
  const context = veilleContext(db);
  let newCount = 0;
  let collected = 0;
  const prepared = [];
  for (const raw of result.elements || []) {
    collected += 1;
    const mapped = connector.mapper(raw, data);
    if (!mapped || !String(mapped.texte || '').trim()) continue;
    prepared.push(mapped);
  }
  const scores = prepared.map((item) => viraliteScore(item.metriques || {}));
  const hasMetrics = scores.some((score) => score > 0);
  for (const mapped of prepared) {
    const created = createVeilleElement(db, source.id, mapped, {
      context, viral: hasMetrics && isViral(viraliteScore(mapped.metriques || {}), scores),
    });
    if (created.created) newCount += 1;
  }
  const at = iso();
  db.prepare(`UPDATE veille_sources SET curseur = ?, quota_json = ?, jeton_expire_le = COALESCE(?, jeton_expire_le),
    updated_at = ? WHERE id = ?`).run(
    JSON.stringify(result.curseurSuivant || curseur),
    result.quota ? JSON.stringify(result.quota) : source.quota_json,
    result.jetonExpireLe || null, at, source.id,
  );
  return { collected, newCount, notModified: Boolean(result.notModified) };
}
