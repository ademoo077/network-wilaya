import { buildFilters } from './anomalyQuery.js';
import { ANOMALIE_SELECT, serialize } from './anomalyRead.js';
import { todayAlgiers } from '@anm/shared';

export function listFil(db, params = {}, user = null) {
  const today = todayAlgiers();
  const { clause, values } = buildFilters(params, { user });
  const limit = Math.min(Number(params.limite) || 24, 100);

  const scope = params.jour || 'aujourdhui';
  const scopeSql = scope === 'tout' ? '' : scope === 'traitees' ? ' AND a.date_traitement = @today' : scope === 'maj' ? ' AND date(a.updated_at) = @today' : ' AND a.date_signalement = @today';
  const scopedClause = clause ? clause + scopeSql : `WHERE 1=1${scopeSql}`;
  const scopedValues = { ...values, today };

  // Résumé (sur le scope)
  const resume = db.prepare(`
    SELECT 
      COUNT(*) AS signalees,
      COUNT(CASE WHEN a.priorite = 'urgente' AND a.statut <> 'traite' THEN 1 END) AS urgentes,
      COUNT(CASE WHEN a.statut = 'en_cours' THEN 1 END) AS en_cours,
      COUNT(CASE WHEN a.statut = 'traite' THEN 1 END) AS traite
    FROM anomalies a ${scopedClause}
  `).get(scopedValues);


  // Détermination du groupe
  const groupBy = params.groupe === 'commune' ? 'c.name_fr' : 
                  params.groupe === 'daira' ? 'da.name_fr' :
                  params.groupe === 'agent' ? 'ag.full_name' :
                  params.groupe === 'categorie' ? 'd.name_fr' :
                  params.groupe === 'statut' ? 'a.statut' : 'a.date_signalement';

  // Groupes
  const groups = db.prepare(`
    SELECT ${groupBy} AS cle, COUNT(*) AS total,
      COUNT(CASE WHEN a.statut = 'non_traite' THEN 1 END) AS non_traite,
      COUNT(CASE WHEN a.statut = 'en_cours' THEN 1 END) AS en_cours,
      COUNT(CASE WHEN a.statut = 'traite' THEN 1 END) AS traite
    FROM anomalies a 
    JOIN domaines d ON d.id = a.domaine_id
    JOIN dairas da ON da.id = a.daira_id
    JOIN communes c ON c.id = a.commune_id
    LEFT JOIN agents ag ON ag.id = a.agent_id
    ${scopedClause}
    GROUP BY cle
    ORDER BY cle DESC
    LIMIT 20
  `).all(scopedValues);

  // Items
  const rows = db.prepare(`${ANOMALIE_SELECT} ${scopedClause} ORDER BY a.date_signalement DESC, a.id DESC LIMIT @limit`)
    .all({ ...scopedValues, limit });

  const items = rows.map(row => {
    const s = serialize(row);
    // Photos payload
    const photos = {
      avant: row.photo_avant_id ? { 
        url: `/api/photos/${row.photo_avant_id}/file?taille=moyen`,
        ratio: 1.77
      } : null,
      apres: row.photo_apres_id ? {
        url: `/api/photos/${row.photo_apres_id}/file?taille=moyen`,
        ratio: 1.77
      } : null,
      n: (row.photos_avant_count || 0) + (row.photos_apres_count || 0)
    };
    return { ...s, photos };
  });

  return { 
    resume, 
    groupes: groups.map(g => ({
      cle: g.cle,
      libelle: g.cle || 'Non défini',
      total: g.total,
      par_statut: { non_traite: g.non_traite, en_cours: g.en_cours, traite: g.traite },
      items: items.filter(it => (params.groupe ? String(it[params.groupe] || it.date_signalement) === String(g.cle) : true))
    }))
  };
}
