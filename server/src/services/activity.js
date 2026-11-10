/** La limite porte sur des actions complètes, jamais sur un sous-ensemble de champs. */
export function activite(db, limit = 10) {
  const rows = db.prepare(`WITH actions AS (
    SELECT MAX(h.id) AS id, h.anomalie_id, h.user_id, substr(h.at, 1, 16) AS minute,
      MAX(h.at) AS at,
      json_group_array(DISTINCT json_object('champ', h.champ, 'ancienne_valeur', h.ancienne_valeur,
        'nouvelle_valeur', h.nouvelle_valeur, 'motif', h.motif)) AS changements_json
    FROM anomalie_historique h JOIN anomalies a ON a.id = h.anomalie_id AND a.deleted_at IS NULL
    GROUP BY h.anomalie_id, h.user_id, substr(h.at, 1, 16)
    ORDER BY at DESC, id DESC LIMIT ?
  ) SELECT actions.*, a.reference, u.full_name AS user_nom, u.username AS user_username
    FROM actions JOIN anomalies a ON a.id = actions.anomalie_id
    LEFT JOIN users u ON u.id = actions.user_id ORDER BY actions.at DESC, actions.id DESC`).all(limit);
  return rows.map(({ changements_json, ...row }) => {
    const changements = JSON.parse(changements_json);
    const modifications = changements.filter((change) => change.champ !== 'creation').length;
    return { ...row, ...(changements.length === 1 ? changements[0] : {}), modifications, changements };
  });
}
