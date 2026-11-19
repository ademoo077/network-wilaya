import { QUICK_FILTER_KEYS, todayAlgiers } from '@anm/shared';
import { buildFilters } from './anomalyQuery.js';
import { queueConditions } from './queueFilters.js';

export function anomalyCounts(db, filters = {}, user = null) {
  const base = { ...filters };
  for (const key of QUICK_FILTER_KEYS) delete base[key];
  const { clause, values } = buildFilters(base);
  const late = queueConditions().retard;
  const agentId = user?.agent_id ?? null;
  return db.prepare(`SELECT COUNT(*) AS "all",
    COUNT(CASE WHEN a.statut = 'non_traite' THEN 1 END) AS non_traite,
    COUNT(CASE WHEN a.statut = 'en_cours' THEN 1 END) AS en_cours,
    COUNT(CASE WHEN a.statut = 'traite' THEN 1 END) AS traite,
    COUNT(CASE WHEN a.priorite = 'urgente' AND a.statut <> 'traite' THEN 1 END) AS urgentes,
    COUNT(CASE WHEN ${late} THEN 1 END) AS retard,
    COUNT(CASE WHEN a.agent_id IS NULL THEN 1 END) AS non_affectees,
    COUNT(CASE WHEN ${agentId ? 'a.agent_id = @agentId' : '0'} THEN 1 END) AS mes_anomalies FROM anomalies a ${clause}`)
    .get({ ...values, filterToday: todayAlgiers(), agentId });
}
