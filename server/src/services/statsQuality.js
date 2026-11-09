import { addDays, diffDays } from '@anm/shared';
import { buildFilters } from './anomalyQuery.js';
import {
  andClause, one, rows, round1, pct, statusAt, settingNumber,
} from './statsSql.js';

/** Points noirs récurrents — grille ≈ 100 m (3.8). */
export function recurring(db, params, S, E, limit = 10) {
  const base = buildFilters({ ...params, statut: undefined, from: undefined, to: undefined });
  const clause = andClause(base.clause, 'a.gps_lat IS NOT NULL AND a.gps_lng IS NOT NULL');
  const list = rows(db, `WITH pts AS (
      SELECT printf('%.3f,%.3f', a.gps_lat, a.gps_lng) AS cellule,
        a.gps_lat AS lat, a.gps_lng AS lng, a.date_signalement AS date_signalement,
        a.lie_a_id AS lie_a_id, a.type_id AS type_id, a.commune_id AS commune_id,
        ${statusAt()} AS statut_au
      FROM anomalies a ${clause}
    ), agg AS (
      SELECT cellule, COUNT(*) AS total,
        SUM(CASE WHEN statut_au <> 'traite' THEN 1 ELSE 0 END) AS ouvertes,
        MAX(date_signalement) AS derniere_date,
        SUM(CASE WHEN lie_a_id IS NOT NULL THEN 1 ELSE 0 END) AS liees,
        MIN(lat) AS lat, MIN(lng) AS lng
      FROM pts GROUP BY cellule HAVING COUNT(*) >= 2
    ), type_top AS (
      SELECT cellule, type_id,
        ROW_NUMBER() OVER (PARTITION BY cellule ORDER BY n DESC, type_id ASC) AS rn
      FROM (SELECT cellule, type_id, COUNT(*) AS n FROM pts GROUP BY cellule, type_id)
    ), commune_top AS (
      SELECT cellule, commune_id,
        ROW_NUMBER() OVER (PARTITION BY cellule ORDER BY n DESC, commune_id ASC) AS rn
      FROM (SELECT cellule, commune_id, COUNT(*) AS n FROM pts GROUP BY cellule, commune_id)
    )
    SELECT agg.*, t.type_id AS type_id, ty.name_ar AS type_ar, ty.name_fr AS type_fr,
      ct.commune_id AS commune_id, c.name_ar AS commune_ar, c.name_fr AS commune_fr
    FROM agg
    LEFT JOIN type_top t ON t.cellule = agg.cellule AND t.rn = 1
    LEFT JOIN types_anomalie ty ON ty.id = t.type_id
    LEFT JOIN commune_top ct ON ct.cellule = agg.cellule AND ct.rn = 1
    LEFT JOIN communes c ON c.id = ct.commune_id
    ORDER BY agg.total DESC, agg.derniere_date DESC
    LIMIT @limit`, { ...base.values, D: E, limit })
    .map((r) => ({
      cellule: r.cellule,
      lat: r.lat,
      lng: r.lng,
      total: r.total,
      ouvertes: r.ouvertes || 0,
      liees: r.liees || 0,
      derniere_date: r.derniere_date,
      type: { id: r.type_id, name_ar: r.type_ar, name_fr: r.type_fr },
      commune: { id: r.commune_id, name_ar: r.commune_ar, name_fr: r.commune_fr },
    }));
  return { top: list, nouveaux: list.filter((r) => r.total >= 3 && r.derniere_date >= S) };
}

/** Qualité des données (3.9). */
export function quality(db, params, S, E, limit = 30) {
  const base = buildFilters({ ...params, statut: undefined, from: S, to: E });
  const counts = one(db, `SELECT COUNT(*) AS total,
    SUM(CASE WHEN a.gps_lat IS NOT NULL AND a.gps_lng IS NOT NULL THEN 1 ELSE 0 END) AS geo,
    SUM(CASE WHEN a.gps_verifiee = 1 THEN 1 ELSE 0 END) AS sur_place,
    SUM(CASE WHEN a.statut IN ('en_cours', 'traite') THEN 1 ELSE 0 END) AS engages,
    SUM(CASE WHEN a.statut IN ('en_cours', 'traite')
      AND (a.epic_id IS NOT NULL OR (a.intervenant_autre IS NOT NULL AND a.intervenant_autre <> ''))
      THEN 1 ELSE 0 END) AS avec_intervenant
    FROM anomalies a ${base.clause}`, base.values);
  const total = counts.total || 0;
  const geo = counts.geo || 0;
  const surPlace = counts.sur_place || 0;
  const engages = counts.engages || 0;
  const avecIntervenant = counts.avec_intervenant || 0;
  const incomplet = "(a.gps_lat IS NULL OR a.agent_id IS NULL OR NOT EXISTS (SELECT 1 FROM pieces_jointes p WHERE p.anomalie_id = a.id))";
  const aCompleter = rows(db, `SELECT a.id, a.reference, a.date_signalement,
      CASE WHEN a.gps_lat IS NULL THEN 1 ELSE 0 END AS sans_gps,
      CASE WHEN a.agent_id IS NULL THEN 1 ELSE 0 END AS sans_agent,
      CASE WHEN NOT EXISTS (SELECT 1 FROM pieces_jointes p WHERE p.anomalie_id = a.id) THEN 1 ELSE 0 END AS sans_photo
    FROM anomalies a ${andClause(base.clause, incomplet)}
    ORDER BY a.date_signalement ASC, a.id ASC LIMIT @limit`, { ...base.values, limit });

  return {
    total,
    geolocalisees: geo,
    pct_geolocalisees: pct(geo, total),
    confirmees_sur_place: surPlace,
    pct_confirmees_sur_place: pct(surPlace, geo),
    engagees: engages,
    avec_intervenant: avecIntervenant,
    pct_intervenant: pct(avecIntervenant, engages),
    a_completer: aCompleter,
  };
}

/**
 * Faits marquants (3.10) — règles déterministes, aucun modèle.
 * Le contexte contient déjà les calculs de la période.
 */
export function faitsMarquants(db, ctx) {
  const { params, settings, S, E, kpis, objectif, trend, ventilations, delais, qualite, recurrents } = ctx;
  const facts = [];

  // 1. Taux sous l'objectif de plus de 5 points.
  if (objectif.taux_pct !== null && objectif.taux_pct < objectif.cible - 5) {
    facts.push({
      gravite: 'critique',
      code: 'OBJECTIF_NON_ATTEINT',
      fr: `Taux de traitement à ${objectif.taux_pct} % : plus de 5 points sous l'objectif de ${objectif.cible} %.`,
      ar: `نسبة المعالجة ${objectif.taux_pct}٪: أقل بأكثر من 5 نقاط من الهدف ${objectif.cible}٪.`,
      filtre: { statut: 'non_traite', from: S, to: E },
    });
  }

  // 2. Reçues ≥ +25 % vs moyenne des 4 semaines précédentes.
  const serie = trend.serie || [];
  const last = serie[serie.length - 1];
  const previous4 = serie.slice(-5, -1);
  if (last && previous4.length === 4) {
    const average = previous4.reduce((sum, w) => sum + w.recues, 0) / previous4.length;
    if (average > 0 && last.recues >= average * 1.25) {
      const hausse = round1(((last.recues - average) / average) * 100);
      facts.push({
        gravite: 'attention',
        code: 'RECUES_EN_HAUSSE',
        fr: `Reçues en hausse de ${hausse} % (${last.recues} contre ${round1(average)} en moyenne sur 4 semaines).`,
        ar: `ارتفاع الواردات بنسبة ${hausse}٪ (${last.recues} مقابل ${round1(average)} في المتوسط خلال 4 أسابيع).`,
        filtre: { from: last.debut, to: last.fin },
      });
    }
  }

  // 3. Une catégorie concentre plus de 25 % des reçues.
  const totalRecues = kpis.total || 0;
  const topCategorie = (ventilations.domaine || [])[0];
  if (totalRecues > 0 && topCategorie && topCategorie.total / totalRecues > 0.25) {
    const part = round1((topCategorie.total / totalRecues) * 100);
    facts.push({
      gravite: 'attention',
      code: 'CONCENTRATION_CATEGORIE',
      fr: `La catégorie « ${topCategorie.label_fr || topCategorie.label_ar} » concentre ${part} % des reçues (${topCategorie.total}).`,
      ar: `فئة « ${topCategorie.label_ar || topCategorie.label_fr} » تمثل ${part}٪ من الواردات (${topCategorie.total}).`,
      filtre: { domaine: topCategorie.id, from: S, to: E },
    });
  }

  // 4. Daïra en plus forte hausse (≥ 3 et ≥ +25 %) vs période précédente.
  const span = (diffDays(S, E) || 0) + 1;
  const prevStart = addDays(S, -span);
  const prevEnd = addDays(S, -1);
  const prevBase = buildFilters({ ...params, statut: undefined, from: prevStart, to: prevEnd });
  const previous = new Map(rows(db,
    `SELECT a.daira_id AS id, COUNT(*) AS n FROM anomalies a ${prevBase.clause} GROUP BY a.daira_id`,
    prevBase.values).map((r) => [r.id, r.n]));
  let hausse = null;
  for (const row of ventilations.daira || []) {
    const before = previous.get(row.id) || 0;
    if (!before) continue;
    const delta = row.total - before;
    const ratio = delta / before;
    if (delta >= 3 && ratio >= 0.25 && (!hausse || delta > hausse.delta)) {
      hausse = { row, before, delta, ratio };
    }
  }
  if (hausse) {
    facts.push({
      gravite: 'attention',
      code: 'DAIRA_EN_HAUSSE',
      fr: `La daïra « ${hausse.row.label_fr || hausse.row.label_ar} » augmente de ${hausse.delta} reçues (+${round1(hausse.ratio * 100)} %).`,
      ar: `دائرة « ${hausse.row.label_ar || hausse.row.label_fr} » ترتفع بـ ${hausse.delta} واردات (+${round1(hausse.ratio * 100)}٪).`,
      filtre: { daira: hausse.row.id, from: S, to: E },
    });
  }

  // 5. EPIC dont le délai moyen dépasse 1,5 × la cible.
  const slow = (delais.par_epic || []).find(
    (r) => r.moyenne !== null && r.cible_moyenne > 0 && r.moyenne > r.cible_moyenne * 1.5,
  );
  if (slow) {
    facts.push({
      gravite: 'attention',
      code: 'EPIC_LENT',
      fr: `L'EPIC « ${slow.label} » traite en ${slow.moyenne} j en moyenne, soit plus de 1,5 × la cible de ${slow.cible_moyenne} j.`,
      ar: `الهيئة « ${slow.label} » تعالج في ${slow.moyenne} يوم في المتوسط، أي أكثر من 1.5 × الهدف ${slow.cible_moyenne} يوم.`,
      filtre: { epic: slow.id, from: S, to: E },
    });
  }

  // 6 et 10. Seuils calculés en un seul balayage de la population de base.
  const allBase = buildFilters({ ...params, statut: undefined, from: undefined, to: undefined });
  const urgenteTarget = settingNumber(settings.sla_urgente_j, 2);
  const verifTarget = settingNumber(settings.delai_verification_cible_j, 2);
  const seuils = one(db, `SELECT
    SUM(CASE WHEN a.priorite = 'urgente' AND ${statusAt()} <> 'traite'
      AND julianday(@D) - julianday(a.date_signalement) > @sla THEN 1 ELSE 0 END) AS urgentes,
    SUM(CASE WHEN a.verification = 'a_verifier'
      AND julianday(@D) - julianday(a.date_signalement) > @verif THEN 1 ELSE 0 END) AS a_verifier
    FROM anomalies a ${allBase.clause}`,
  { ...allBase.values, D: E, sla: urgenteTarget, verif: verifTarget });
  const urgentes = seuils.urgentes || 0;
  if (urgentes > 0) {
    facts.push({
      gravite: urgentes >= 5 ? 'critique' : 'attention',
      code: 'URGENTES_HORS_SLA',
      fr: `${urgentes} anomalie(s) urgente(s) ouverte(s) au-delà de la cible de ${urgenteTarget} j.`,
      ar: `${urgentes} حالة عاجلة مفتوحة تجاوزت الهدف ${urgenteTarget} يوم.`,
      filtre: { priorite: 'urgente' },
    });
  }

  // 7. Stock en hausse trois semaines consécutives.
  if (trend.tendance_stock === 'hausse') {
    facts.push({
      gravite: 'attention',
      code: 'STOCK_EN_HAUSSE',
      fr: `Stock ouvert en hausse sur trois semaines consécutives (${trend.stock_actuel} fiches ouvertes).`,
      ar: `المخزون المفتوح يرتفع لثلاثة أسابيع متتالية (${trend.stock_actuel} بطاقة مفتوحة).`,
      filtre: { statut: 'non_traite' },
    });
  }

  // 8. Nouveau point noir récurrent (≥ 3 en ~100 m).
  const nouveau = (recurrents.nouveaux || [])[0];
  if (nouveau) {
    facts.push({
      gravite: 'attention',
      code: 'NOUVEAU_POINT_NOIR',
      fr: `Nouveau point noir récurrent : ${nouveau.total} signalements en ~100 m (${nouveau.commune.name_fr || nouveau.commune.name_ar || 'commune inconnue'}).`,
      ar: `نقطة سوداء متكررة جديدة: ${nouveau.total} تبليغات في ~100 متر (${nouveau.commune.name_ar || nouveau.commune.name_fr || 'بلدية غير معروفة'}).`,
      filtre: nouveau.commune.id ? { commune: nouveau.commune.id, from: S, to: E } : null,
    });
  }

  // 9. Géolocalisation sous 90 %.
  if (qualite.pct_geolocalisees !== null && qualite.pct_geolocalisees < 90) {
    facts.push({
      gravite: 'attention',
      code: 'GEOLOCALISATION_FAIBLE',
      fr: `Seulement ${qualite.pct_geolocalisees} % des fiches reçues sont géolocalisées (cible : 90 %).`,
      ar: `فقط ${qualite.pct_geolocalisees}٪ من البطاقات الواردة محددة جغرافياً (الهدف: 90٪).`,
      filtre: { from: S, to: E },
    });
  }

  // 10. « À vérifier » depuis plus de la cible de vérification.
  const aVerifierRetard = seuils.a_verifier || 0;
  if (aVerifierRetard > 0) {
    facts.push({
      gravite: 'attention',
      code: 'VERIFICATION_EN_RETARD',
      fr: `${aVerifierRetard} fiche(s) « à vérifier » depuis plus de ${verifTarget} j.`,
      ar: `${aVerifierRetard} بطاقة «للتحقق» منذ أكثر من ${verifTarget} يوم.`,
      filtre: { verification: 'a_verifier' },
    });
  }

  return facts;
}
