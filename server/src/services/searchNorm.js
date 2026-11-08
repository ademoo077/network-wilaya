import { normalize } from '@anm/shared';

export const SEARCH_NORM_SQL = `
  SELECT a.id, a.reference, a.lien_url, a.adresse_texte, a.lieu_dit, a.observations,
         a.intervenant_autre,
         d.name_ar AS domaine_ar, d.name_fr AS domaine_fr,
         t.name_ar AS type_ar, t.name_fr AS type_fr,
         da.name_ar AS daira_ar, da.name_fr AS daira_fr,
         c.name_ar AS commune_ar, c.name_fr AS commune_fr,
         e.name AS epic_name, ag.full_name AS agent_name
  FROM anomalies a
  JOIN domaines d ON d.id = a.domaine_id
  JOIN types_anomalie t ON t.id = a.type_id
  JOIN dairas da ON da.id = a.daira_id
  JOIN communes c ON c.id = a.commune_id
  LEFT JOIN epics e ON e.id = a.epic_id
  LEFT JOIN agents ag ON ag.id = a.agent_id
`;

export function searchNormFromRow(row) {
  return normalize([
    row.reference,
    row.lien_url,
    row.adresse_texte,
    row.lieu_dit,
    row.observations,
    row.intervenant_autre,
    row.domaine_ar, row.domaine_fr,
    row.type_ar, row.type_fr,
    row.daira_ar, row.daira_fr,
    row.commune_ar, row.commune_fr,
    row.epic_name, row.agent_name,
  ].filter(Boolean).join(' '));
}

/** Recalcule search_norm pour les lignes correspondant au filtre (tâche de renommage). */
export function recalcSearchNorm(db, where = '1=1', params = []) {
  const rows = db.prepare(`${SEARCH_NORM_SQL} WHERE ${where}`).all(...params);
  const update = db.prepare('UPDATE anomalies SET search_norm = ? WHERE id = ?');
  const tx = db.transaction(() => {
    for (const row of rows) update.run(searchNormFromRow(row), row.id);
  });
  tx();
  return rows.length;
}

export function searchNormForAnomaly(db, id) {
  const row = db.prepare(`${SEARCH_NORM_SQL} WHERE a.id = ?`).get(id);
  return row ? searchNormFromRow(row) : '';
}
