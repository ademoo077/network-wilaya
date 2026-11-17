import { percent, splitPercent } from '@anm/shared';
import { socialFilters, SOCIAL_FROM } from './reseauxSociaux.js';

const COUNTS = `COUNT(*) AS total, COALESCE(SUM(categorie='page'),0) AS pages,
  COALESCE(SUM(categorie='profil'),0) AS profils, COALESCE(SUM(categorie='groupe'),0) AS groupes,
  COALESCE(SUM(categorie='chaine'),0) AS chaines, COALESCE(SUM(categorie='autre'),0) AS autres,
  COALESCE(SUM(actif=1),0) AS actifs, COALESCE(SUM(verification='a_verifier'),0) AS a_verifier,
  COALESCE(SUM(TRIM(nom)=''),0) AS sans_nom,
  COALESCE(SUM(lien_normalise IS NULL OR lien_normalise=''),0) AS sans_lien_normalise`;
const JOIN_COUNTS = `COUNT(f.id) AS total, COALESCE(SUM(f.categorie='page'),0) AS pages,
  COALESCE(SUM(f.categorie='profil'),0) AS profils, COALESCE(SUM(f.categorie='groupe'),0) AS groupes,
  COALESCE(SUM(f.categorie='chaine'),0) AS chaines, COALESCE(SUM(f.categorie='autre'),0) AS autres,
  COALESCE(SUM(f.actif=1),0) AS actifs, COALESCE(SUM(f.verification='a_verifier'),0) AS a_verifier,
  COALESCE(SUM(TRIM(f.nom)=''),0) AS sans_nom,
  COALESCE(SUM(f.lien_normalise IS NULL OR f.lien_normalise=''),0) AS sans_lien_normalise`;

/** Agrégations SQL uniquement ; aucun compteur n'est calculé à partir d'une page de résultats. */
export function statsReseauxSociaux(db, query) {
  const { where, params } = socialFilters(query);
  const cte = `WITH filtered AS (SELECT s.* ${SOCIAL_FROM} ${where})`;
  const resume = db.prepare(`${cte} SELECT ${COUNTS}, COUNT(DISTINCT plateforme) AS reseaux,
    COUNT(DISTINCT daira_id) AS ca_couverts,
    COALESCE(SUM(commune_id IS NULL OR daira_id IS NULL),0) AS sans_rattachement FROM filtered`).get(...params);
  const territoryScope = `${query.daira_id ? 'AND c.daira_id=?' : ''} ${query.commune_id ? 'AND c.id=?' : ''}`;
  const scopeParams = [...(query.daira_id ? [query.daira_id] : []), ...(query.commune_id ? [query.commune_id] : [])];
  const coverage = db.prepare(`${cte} SELECT COUNT(*) AS communes_referentiel,
    COALESCE(SUM(EXISTS(SELECT 1 FROM filtered f WHERE f.commune_id=c.id)),0) AS communes_couvertes,
    COALESCE(SUM(NOT EXISTS(SELECT 1 FROM filtered f WHERE f.commune_id=c.id)),0) AS communes_sans_compte
    FROM communes c WHERE c.actif=1 ${territoryScope}`).get(...params, ...scopeParams);
  const reseaux = db.prepare(`${cte} SELECT plateforme AS key, ${COUNTS} FROM filtered GROUP BY plateforme ORDER BY total DESC, plateforme`).all(...params);
  const types = db.prepare(`${cte} SELECT categorie AS key, ${COUNTS} FROM filtered GROUP BY categorie ORDER BY total DESC, categorie`).all(...params);
  const caScope = `WHERE (da.actif=1 OR EXISTS(SELECT 1 FROM filtered f WHERE f.daira_id=da.id)) ${query.daira_id ? 'AND da.id=?' : ''}
    ${query.commune_id ? 'AND da.id=(SELECT daira_id FROM communes WHERE id=?)' : ''}`;
  const ca = db.prepare(`${cte} SELECT da.id AS id, da.name_fr AS name_fr, da.name_ar AS name_ar,
    ${JOIN_COUNTS}, COUNT(DISTINCT f.commune_id) AS communes FROM dairas da LEFT JOIN filtered f ON f.daira_id=da.id
    ${caScope} GROUP BY da.id
    UNION ALL SELECT NULL AS id, ca_libelle AS name_fr, ca_libelle AS name_ar, ${COUNTS},
    COUNT(DISTINCT NULLIF(commune_libelle,'')) AS communes FROM filtered WHERE daira_id IS NULL GROUP BY ca_libelle
    ORDER BY total DESC, name_fr`).all(...params, ...scopeParams);
  const communes = db.prepare(`${cte} SELECT c.id AS id, c.name_fr AS name_fr, c.name_ar AS name_ar,
    da.id AS daira_id, da.name_fr AS ca_fr, da.name_ar AS ca_ar, ${JOIN_COUNTS}
    FROM communes c JOIN dairas da ON da.id=c.daira_id LEFT JOIN filtered f ON f.commune_id=c.id
    WHERE (c.actif=1 OR EXISTS(SELECT 1 FROM filtered f WHERE f.commune_id=c.id)) ${territoryScope} GROUP BY c.id
    UNION ALL SELECT NULL AS id, commune_libelle AS name_fr, commune_libelle AS name_ar,
    daira_id, COALESCE(da.name_fr,s.ca_libelle) AS ca_fr, COALESCE(da.name_ar,s.ca_libelle) AS ca_ar, ${COUNTS}
    FROM filtered s LEFT JOIN (SELECT id,name_fr,name_ar FROM dairas) da ON da.id=s.daira_id WHERE commune_id IS NULL
    GROUP BY daira_id, ca_libelle, commune_libelle ORDER BY total DESC, name_fr`).all(...params, ...scopeParams);
  const shares = (rows) => {
    const percentages = splitPercent(rows.map((row) => row.total));
    return rows.map((row, index) => ({ ...row, pourcentage: percentages[index] }));
  };
  return { resume: { ...resume, ...coverage, couverture: percent(coverage.communes_couvertes, coverage.communes_referentiel) },
    reseaux: shares(reseaux), types: shares(types), ca: shares(ca), communes };
}
