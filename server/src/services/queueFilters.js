import { DEFAULT_PARAMS, todayAlgiers } from '@anm/shared';

const threshold = (key) => `COALESCE((SELECT CAST(valeur AS REAL) FROM parametres WHERE cle = '${key}'), ${Number(DEFAULT_PARAMS[key])})`;

/** Conditions SQL partagées par les listes, les compteurs et la file de travail. */
export function queueConditions(table = 'a') {
  const age = `(julianday(@filterToday) - julianday(${table}.date_signalement))`;
  const open = `${table}.statut <> 'traite'`;
  const noPhoto = `NOT EXISTS (SELECT 1 FROM pieces_jointes qp WHERE qp.anomalie_id = ${table}.id AND qp.mime LIKE 'image/%')`;
  return {
    ouvertes: open,
    retard: `${open} AND ${age} > ${threshold('delai_retard_jours')}`,
    verification_retard: `${table}.verification = 'a_verifier' AND ${age} > ${threshold('delai_verification_cible_j')}`,
    sla_depassee: `${open} AND ${age} > CASE ${table}.priorite WHEN 'urgente' THEN ${threshold('sla_urgente_j')} WHEN 'haute' THEN ${threshold('sla_haute_j')} ELSE ${threshold('sla_normale_j')} END`,
    incompletes: `(${table}.gps_lat IS NULL OR ${table}.agent_id IS NULL OR ${noPhoto})`,
    sans_photo: noPhoto, sans_agent: `${table}.agent_id IS NULL`,
  };
}
export function addQueueFilters(params, table, where, values) {
  const conditions = queueConditions(table);
  for (const key of Object.keys(conditions)) if (params[key]) {
    where.push(`(${conditions[key]})`);
    if (conditions[key].includes('@filterToday')) values.filterToday = todayAlgiers();
  }
  if (params.lie_a) { where.push(`(${table}.id = @parent OR ${table}.lie_a_id = @parent)`); values.parent = params.lie_a; }
}
