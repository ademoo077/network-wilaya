/**
 * Correspondance liste blanche : chaque `id` du catalogue V8 possède ici une
 * expression SQL fixe. Le compilateur ne concatène jamais de valeur cliente.
 */

/** Statut d’une fiche à une date paramétrée (`D` par défaut, `D0` pour le stock début). */
export function statusAt(alias = 'a', param = 'D') {
  return `CASE
    WHEN ${alias}.date_traitement IS NOT NULL AND ${alias}.date_traitement <= @${param} THEN 'traite'
    WHEN ${alias}.date_intervention IS NOT NULL AND ${alias}.date_intervention <= @${param} THEN 'en_cours'
    ELSE 'non_traite' END`;
}

export const DELAY = '(julianday(a.date_traitement) - julianday(a.date_signalement))';
export const DELAY_VERIFICATION = '(julianday(a.date_verification) - julianday(a.date_signalement))';
export const DELAY_INTERVENTION = '(julianday(a.date_intervention) - julianday(a.date_verification))';
export const SLA_TARGET = "CASE a.priorite WHEN 'urgente' THEN @slaUrgente WHEN 'haute' THEN @slaHaute ELSE @slaNormale END";
export const GPS_PRESENT = 'a.gps_lat IS NOT NULL AND a.gps_lng IS NOT NULL';
export const HAS_ATTACHMENT = 'EXISTS (SELECT 1 FROM pieces_jointes p WHERE p.anomalie_id = a.id)';
export const SOURCE_SAISIE = `CASE
  WHEN a.veille_element_id IS NOT NULL THEN 'veille'
  WHEN a.lie_a_id IS NOT NULL THEN 'duplication'
  ELSE 'manuelle' END`;

const boolCase = (condition) => `CASE WHEN ${condition} THEN 1 ELSE 0 END`;

export const JOINS = {
  domaine: ['JOIN domaines j_domaine ON j_domaine.id = a.domaine_id'],
  groupe: [
    'JOIN domaines j_domaine_g ON j_domaine_g.id = a.domaine_id',
    'LEFT JOIN groupes_domaines j_groupe ON j_groupe.id = j_domaine_g.groupe_id',
  ],
  type: ['JOIN types_anomalie j_type ON j_type.id = a.type_id'],
  daira: ['JOIN dairas j_daira ON j_daira.id = a.daira_id'],
  commune: ['JOIN communes j_commune ON j_commune.id = a.commune_id'],
  epic: ['LEFT JOIN epics j_epic ON j_epic.id = a.epic_id'],
  agent: ['LEFT JOIN agents j_agent ON j_agent.id = a.agent_id'],
  saisi_par: ['LEFT JOIN users j_saisi ON j_saisi.id = a.saisi_par'],
};

/** Champs utilisables comme dimension (clé de regroupement + libellés). */
export const DIMENSION_FIELDS = {
  domaine: { key: 'a.domaine_id', joins: JOINS.domaine, labelFr: 'j_domaine.name_fr', labelAr: 'j_domaine.name_ar' },
  groupe: { key: 'j_groupe.id', joins: JOINS.groupe, labelFr: 'j_groupe.name_fr', labelAr: 'j_groupe.name_ar' },
  type: { key: 'a.type_id', joins: JOINS.type, labelFr: 'j_type.name_fr', labelAr: 'j_type.name_ar' },
  daira: { key: 'a.daira_id', joins: JOINS.daira, labelFr: 'j_daira.name_fr', labelAr: 'j_daira.name_ar' },
  commune: { key: 'a.commune_id', joins: JOINS.commune, labelFr: 'j_commune.name_fr', labelAr: 'j_commune.name_ar' },
  cellule_100m: { key: "printf('%.3f_%.3f', a.gps_lat, a.gps_lng)", joins: [] },
  epic: { key: 'a.epic_id', joins: JOINS.epic, labelFr: 'j_epic.name', labelAr: 'j_epic.name' },
  agent: { key: 'a.agent_id', joins: JOINS.agent, labelFr: 'j_agent.full_name', labelAr: 'j_agent.full_name' },
  saisi_par: { key: 'a.saisi_par', joins: JOINS.saisi_par, labelFr: 'j_saisi.full_name', labelAr: 'j_saisi.full_name' },
  verification: { key: 'a.verification', joins: [] },
  priorite: { key: 'a.priorite', joins: [] },
  plateforme: { key: 'a.plateforme', joins: [] },
  contenu_type: { key: 'a.contenu_type', joins: [] },
  source_saisie: { key: SOURCE_SAISIE, joins: [] },
  gps: { key: boolCase(GPS_PRESENT), joins: [] },
  gps_source: { key: 'a.gps_source', joins: [] },
  gps_verifiee: { key: 'a.gps_verifiee', joins: [] },
  recurrent: { key: boolCase('a.lie_a_id IS NOT NULL'), joins: [] },
  a_pieces_jointes: { key: boolCase(HAS_ATTACHMENT), joins: [] },
  en_retard: { key: boolCase(`${statusAt('a', 'D')} <> 'traite' AND a.date_signalement < @cutoff`), joins: [] },
  hors_sla: { key: boolCase(`a.date_traitement IS NOT NULL AND ${DELAY} > ${SLA_TARGET}`), joins: [] },
  tranche_age: {
    key: `CASE
      WHEN ${statusAt('a', 'D')} = 'traite' THEN NULL
      WHEN (julianday(@D) - julianday(a.date_signalement)) <= 7 THEN '0-7'
      WHEN (julianday(@D) - julianday(a.date_signalement)) <= 14 THEN '8-14'
      WHEN (julianday(@D) - julianday(a.date_signalement)) <= 30 THEN '15-30'
      ELSE '>30' END`,
    joins: [],
  },
  tranche_delai: {
    key: `CASE
      WHEN a.date_traitement IS NULL THEN 'na'
      WHEN ${DELAY} <= 2 THEN '0-2'
      WHEN ${DELAY} <= 7 THEN '3-7'
      WHEN ${DELAY} <= 14 THEN '8-14'
      WHEN ${DELAY} <= 30 THEN '15-30'
      ELSE '>30' END`,
    joins: [],
  },
};

/** Champs utilisables comme filtre (expression + jointures éventuelles). */
export const FILTER_FIELDS = {
  domaine: { expr: 'a.domaine_id', joins: [] },
  groupe: { expr: 'j_groupe.id', joins: JOINS.groupe },
  type: { expr: 'a.type_id', joins: [] },
  daira: { expr: 'a.daira_id', joins: [] },
  commune: { expr: 'a.commune_id', joins: [] },
  epic: { expr: 'a.epic_id', joins: [] },
  agent: { expr: 'a.agent_id', joins: [] },
  saisi_par: { expr: 'a.saisi_par', joins: [] },
  verification: { expr: 'a.verification', joins: [] },
  priorite: { expr: 'a.priorite', joins: [] },
  plateforme: { expr: 'a.plateforme', joins: [] },
  contenu_type: { expr: 'a.contenu_type', joins: [] },
  source_saisie: { expr: SOURCE_SAISIE, joins: [] },
  gps_source: { expr: 'a.gps_source', joins: [] },
  gps: { expr: boolCase(GPS_PRESENT), joins: [] },
  gps_verifiee: { expr: 'a.gps_verifiee', joins: [] },
  recurrent: { expr: boolCase('a.lie_a_id IS NOT NULL'), joins: [] },
  a_pieces_jointes: { expr: boolCase(HAS_ATTACHMENT), joins: [] },
  en_retard: { expr: boolCase(`${statusAt('a', 'D')} <> 'traite' AND a.date_signalement < @cutoff`), joins: [] },
  hors_sla: { expr: boolCase(`a.date_traitement IS NOT NULL AND ${DELAY} > ${SLA_TARGET}`), joins: [] },
  urgentes: { expr: boolCase("a.priorite = 'urgente'"), joins: [] },
  tranche_age: { expr: DIMENSION_FIELDS.tranche_age.key, joins: [] },
  tranche_delai: { expr: DIMENSION_FIELDS.tranche_delai.key, joins: [] },
  signalement: { expr: 'a.date_signalement', joins: [] },
  traitement: { expr: 'a.date_traitement', joins: [] },
  date_verification: { expr: 'a.date_verification', joins: [] },
  intervention: { expr: 'a.date_intervention', joins: [] },
  publication: { expr: 'a.date_publication', joins: [] },
  q: { expr: 'a.search_norm', joins: [], text: true },
};
