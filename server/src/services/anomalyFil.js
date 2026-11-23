import { buildFilters } from './anomalyQuery.js';
import { ANOMALIE_SELECT, serialize } from './anomalyRead.js';
import { todayAlgiers } from '@anm/shared';

export function listFil(db, params = {}, user = null) {
  const today = todayAlgiers();
  const { clause, values } = buildFilters(params, { user });
  const limit = Math.min(Number(params.limite) || 24, 100);

  const scope = params.jour || 'aujourdhui';
  const dateField = scope === 'traitees' ? 'a.date_traitement' : scope === 'maj' ? 'date(a.updated_at)' : 'a.date_signalement';
  const scopeSql = scope === 'tout' ? '' : scope === 'traitees' ? " AND a.statut = 'traite'" : scope === 'maj' ? ' AND date(a.updated_at) = @today' : ' AND a.date_signalement = @today';
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
                  params.groupe === 'statut' ? 'a.statut' : dateField;

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
  const orderBy = scope === 'traitees' ? 'a.date_traitement DESC, a.id DESC' : scope === 'maj' ? 'a.updated_at DESC, a.id DESC' : 'a.date_signalement DESC, a.id DESC';
  const rows = db.prepare(`${ANOMALIE_SELECT} ${scopedClause} ORDER BY ${orderBy} LIMIT @limit`)
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

  const dateKey = scope === 'traitees' ? 'date_traitement' : scope === 'maj' ? 'updated_at' : 'date_signalement';
  const groupKey = (it) => {
    if (params.groupe === 'commune') return it.commune_fr || it.commune_ar;
    if (params.groupe === 'daira') return it.daira_fr || it.daira_ar;
    if (params.groupe === 'agent') return it.agent_nom;
    if (params.groupe === 'categorie') return it.categorie_fr || it.categorie_ar;
    if (params.groupe === 'statut') return it.statut;
    const v = it[dateKey];
    return typeof v === 'string' && v.length > 10 ? v.slice(0, 10) : v;
  };

  return {
    resume,
    groupes: groups.map(g => ({
      cle: g.cle,
      libelle: g.cle || 'Non défini',
      total: g.total,
      par_statut: { non_traite: g.non_traite, en_cours: g.en_cours, traite: g.traite },
      items: items.filter(it => String(groupKey(it) ?? '') === String(g.cle ?? ''))
    }))
  };
}
