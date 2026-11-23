import { buildFilters } from './anomalyQuery.js';
import { ANOMALIE_SELECT, serialize } from './anomalyRead.js';
import { todayAlgiers } from '@anm/shared';

export function listFil(db, params = {}, user = null) {
  const { clause, values } = buildFilters(params, { user });
  const limit = Math.min(Number(params.limite) || 24, 100);

  // Résumé (toujours sur le scope filtré)
  const resume = db.prepare(`
    SELECT 
      COUNT(*) AS signalees,
      COUNT(CASE WHEN a.priorite = 'urgente' AND a.statut <> 'traite' THEN 1 END) AS urgentes,
      COUNT(CASE WHEN a.statut = 'en_cours' THEN 1 END) AS en_cours,
      COUNT(CASE WHEN a.statut = 'traite' THEN 1 END) AS traite
    FROM anomalies a ${clause}
  `).get(values);

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
    ${clause}
    GROUP BY cle
    ORDER BY cle DESC
    LIMIT 20
  `).all(values);

  // Items (pour le premier groupe ou global si pagination)
  // On simplifie pour la Phase 1 : on renvoie les N premières anomalies
  const rows = db.prepare(`${ANOMALIE_SELECT} ${clause} ORDER BY a.date_signalement DESC, a.id DESC LIMIT @limit`)
    .all({ ...values, limit });

  const items = rows.map(row => {
    const s = serialize(row);
    // Photos payload minimaliste selon SPEC
    const photos = {
      avant: row.photo_avant_id ? { 
        url: `/api/photos/${row.photo_avant_id}/file`,
        flou: row.apercu_flou_avant, // On l'ajoutera au SELECT si possible
        ratio: 1.77
      } : null,
      n: row.pieces_count
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
