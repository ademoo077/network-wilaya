import { getParams } from '../services/settings.js';

const DAY_MS = 86400000;

function iso(date = new Date()) { return date.toISOString(); }

function startOfDay(date) {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

function dayKey(date) { return iso(date).slice(0, 10); }

function ratio(part, total) {
  return total > 0 ? Math.round((Number(part) / Number(total)) * 1000) / 1000 : null;
}

function median(values) {
  const clean = values.map(Number).filter((value) => Number.isFinite(value) && value >= 0).sort((a, b) => a - b);
  if (!clean.length) return null;
  const middle = Math.floor(clean.length / 2);
  const value = clean.length % 2 ? clean[middle] : (clean[middle - 1] + clean[middle]) / 2;
  return Math.round(value * 10) / 10;
}

function parseDate(value) {
  if (!value) return null;
  const time = Date.parse(String(value).length === 10 ? `${value}T00:00:00.000Z` : value);
  return Number.isFinite(time) ? time : null;
}

function delayHours(from, to) {
  const start = parseDate(from);
  const end = parseDate(to);
  if (start === null || end === null || end < start) return null;
  return (end - start) / 3600000;
}

function fillDays(rows, days, now) {
  const byDay = new Map(rows.map((row) => [row.jour, row]));
  const result = [];
  const end = startOfDay(now);
  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(end.getTime() - index * DAY_MS);
    const key = dayKey(date);
    const row = byDay.get(key) || {};
    result.push({
      jour: key,
      collectes: Number(row.collectes || 0),
      pertinents: Number(row.pertinents || 0),
      retenus: Number(row.retenus || 0),
      rejetes: Number(row.rejetes || 0),
    });
  }
  return result;
}

export function computePeaks(db, { now, jours = 35 }) {
  const from = iso(new Date(startOfDay(now).getTime() - jours * DAY_MS));
  const rows = db.prepare(`SELECT vs.groupe_id, vs.commune_id, substr(e.collecte_le, 1, 10) AS jour, COUNT(*) AS total,
      g.name_fr AS groupe_fr, g.name_ar AS groupe_ar, c.name_fr AS commune_fr, c.name_ar AS commune_ar
    FROM veille_elements e
    JOIN veille_suggestions vs ON vs.element_id = e.id AND vs.rang = 1
    JOIN groupes_domaines g ON g.id = vs.groupe_id
    JOIN communes c ON c.id = vs.commune_id
    WHERE e.collecte_le >= ? AND vs.groupe_id IS NOT NULL AND vs.commune_id IS NOT NULL
    GROUP BY vs.groupe_id, vs.commune_id, jour`).all(from);
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.groupe_id}|${row.commune_id}`;
    if (!groups.has(key)) {
      groups.set(key, {
        groupe_id: row.groupe_id, commune_id: row.commune_id,
        groupe_fr: row.groupe_fr, groupe_ar: row.groupe_ar, commune_fr: row.commune_fr, commune_ar: row.commune_ar,
        counts: new Map(),
      });
    }
    groups.get(key).counts.set(row.jour, Number(row.total || 0));
  }
  const end = startOfDay(now);
  const peaks = [];
  for (const group of groups.values()) {
    const recent = [];
    const baseline = [];
    for (let index = 0; index < 7; index += 1) {
      recent.push(group.counts.get(dayKey(new Date(end.getTime() - index * DAY_MS))) || 0);
    }
    for (let index = 7; index < 35; index += 1) {
      baseline.push(group.counts.get(dayKey(new Date(end.getTime() - index * DAY_MS))) || 0);
    }
    const recentTotal = recent.reduce((sum, value) => sum + value, 0);
    const recentMean = recentTotal / recent.length;
    const baselineMean = baseline.reduce((sum, value) => sum + value, 0) / baseline.length;
    const variance = baseline.reduce((sum, value) => sum + (value - baselineMean) ** 2, 0) / Math.max(1, baseline.length - 1);
    const deviation = Math.sqrt(variance);
    const z = deviation > 0 ? (recentMean - baselineMean) / deviation : 0;
    if (recentTotal >= 3 && z >= 2) {
      peaks.push({
        groupe_id: group.groupe_id, groupe_fr: group.groupe_fr, groupe_ar: group.groupe_ar,
        commune_id: group.commune_id, commune_fr: group.commune_fr, commune_ar: group.commune_ar,
        total_7j: recentTotal, moyenne_28j: Math.round(baselineMean * 100) / 100, z: Math.round(z * 100) / 100,
      });
    }
  }
  peaks.sort((a, b) => b.z - a.z || b.total_7j - a.total_7j);
  return peaks.slice(0, 5);
}

/** Agrégats Veille bornés à une semaine du rapport hebdomadaire. */
export function veilleWeekly(db, { start, end } = {}) {
  if (!start || !end) return null;
  const params = getParams(db);
  const seuil = Number(params.veille_seuil_pertinent || 2);
  const endExclusive = iso(new Date(startOfDay(new Date(`${end}T00:00:00.000Z`)).getTime() + DAY_MS));
  const totals = db.prepare(`SELECT COUNT(*) AS total,
      SUM(CASE WHEN score >= @seuil THEN 1 ELSE 0 END) AS pertinents,
      SUM(CASE WHEN statut = 'retenu' THEN 1 ELSE 0 END) AS retenus,
      SUM(CASE WHEN statut = 'rejete' THEN 1 ELSE 0 END) AS rejetes,
      SUM(CASE WHEN statut = 'ignore' THEN 1 ELSE 0 END) AS ignores,
      SUM(CASE WHEN statut = 'a_qualifier' THEN 1 ELSE 0 END) AS a_qualifier,
      SUM(CASE WHEN anomalie_id IS NOT NULL THEN 1 ELSE 0 END) AS convertis
    FROM veille_elements WHERE collecte_le >= @S AND collecte_le < @E`).get({ S: start, E: endExclusive, seuil });
  const groupes = db.prepare(`SELECT g.id, g.name_fr, g.name_ar, COUNT(*) AS total,
      SUM(CASE WHEN e.statut = 'retenu' THEN 1 ELSE 0 END) AS retenus
    FROM veille_elements e
    JOIN veille_suggestions vs ON vs.element_id = e.id AND vs.rang = 1
    JOIN groupes_domaines g ON g.id = vs.groupe_id
    WHERE e.collecte_le >= @S AND e.collecte_le < @E
    GROUP BY g.id ORDER BY total DESC, g.name_fr COLLATE NOCASE LIMIT 5`).all({ S: start, E: endExclusive });
  const communes = db.prepare(`SELECT c.id, c.name_fr, c.name_ar, COUNT(*) AS total,
      SUM(CASE WHEN e.statut = 'retenu' THEN 1 ELSE 0 END) AS retenus
    FROM veille_elements e
    JOIN veille_suggestions vs ON vs.element_id = e.id AND vs.rang = 1
    JOIN communes c ON c.id = vs.commune_id
    WHERE e.collecte_le >= @S AND e.collecte_le < @E
    GROUP BY c.id ORDER BY total DESC, c.name_fr COLLATE NOCASE LIMIT 5`).all({ S: start, E: endExclusive });
  const evenements = db.prepare(`SELECT ev.id, ev.debut, ev.fin, ev.nb_elements, ev.nb_sources, ev.score, ev.priorite,
      g.name_fr AS groupe_fr, g.name_ar AS groupe_ar, c.name_fr AS commune_fr, c.name_ar AS commune_ar
    FROM veille_evenements ev
    LEFT JOIN groupes_domaines g ON g.id = ev.groupe_id
    LEFT JOIN communes c ON c.id = ev.commune_id
    WHERE ev.debut < @E AND ev.fin >= @S
    ORDER BY ev.nb_sources DESC, ev.score DESC, ev.debut ASC LIMIT 5`).all({ S: start, E: endExclusive });
  const reactionRows = db.prepare(`SELECT date_publication, traite_le FROM veille_elements
    WHERE collecte_le >= @S AND collecte_le < @E AND traite_le IS NOT NULL AND date_publication IS NOT NULL LIMIT 5000`)
    .all({ S: start, E: endExclusive });
  const retenus = Number(totals.retenus || 0);
  return {
    periode: { debut: start, fin: end },
    totaux: {
      collectes: Number(totals.total || 0),
      pertinents: Number(totals.pertinents || 0),
      retenus,
      rejetes: Number(totals.rejetes || 0),
      ignores: Number(totals.ignores || 0),
      a_qualifier: Number(totals.a_qualifier || 0),
      convertis: Number(totals.convertis || 0),
    },
    qualite: {
      precision_estimee: ratio(retenus, retenus + Number(totals.rejetes || 0)),
      rappel_estime: ratio(retenus, retenus + Number(totals.ignores || 0)),
      delai_median_heures: median(reactionRows.map((row) => delayHours(row.date_publication, row.traite_le))),
    },
    groupes,
    communes,
    evenements,
  };
}

/** Agrégations SQL du tableau de veille (aucune boucle sur les lignes côté client). */
export function veilleDashboard(db, { days = 30, now = new Date() } = {}) {
  const params = getParams(db);
  const seuil = Number(params.veille_seuil_pertinent || 2);
  const periode = Math.max(1, Math.min(365, Number(days) || 30));
  const from = iso(new Date(startOfDay(now).getTime() - (periode - 1) * DAY_MS));

  const totaux = db.prepare(`SELECT COUNT(*) AS total,
      SUM(CASE WHEN score >= ? THEN 1 ELSE 0 END) AS pertinents,
      SUM(CASE WHEN statut = 'retenu' THEN 1 ELSE 0 END) AS retenus,
      SUM(CASE WHEN statut = 'rejete' THEN 1 ELSE 0 END) AS rejetes,
      SUM(CASE WHEN statut = 'ignore' THEN 1 ELSE 0 END) AS ignores,
      SUM(CASE WHEN statut = 'a_qualifier' THEN 1 ELSE 0 END) AS a_qualifier,
      SUM(CASE WHEN anomalie_id IS NOT NULL THEN 1 ELSE 0 END) AS convertis
    FROM veille_elements WHERE collecte_le >= ?`).get(seuil, from);
  const total = Number(totaux.total || 0);
  const parJour = db.prepare(`SELECT substr(collecte_le, 1, 10) AS jour, COUNT(*) AS collectes,
      SUM(CASE WHEN score >= ? THEN 1 ELSE 0 END) AS pertinents,
      SUM(CASE WHEN statut = 'retenu' THEN 1 ELSE 0 END) AS retenus,
      SUM(CASE WHEN statut = 'rejete' THEN 1 ELSE 0 END) AS rejetes
    FROM veille_elements WHERE collecte_le >= ? GROUP BY jour ORDER BY jour`).all(seuil, from);
  const parSource = db.prepare(`SELECT s.id, s.nom, s.type, s.actif,
      COUNT(e.id) AS collectes,
      SUM(CASE WHEN e.score >= ? THEN 1 ELSE 0 END) AS pertinents,
      SUM(CASE WHEN e.statut = 'retenu' THEN 1 ELSE 0 END) AS retenus,
      SUM(CASE WHEN e.statut = 'a_qualifier' THEN 1 ELSE 0 END) AS a_qualifier
    FROM veille_sources s LEFT JOIN veille_elements e ON e.source_id = s.id AND e.collecte_le >= ?
    GROUP BY s.id ORDER BY collectes DESC, s.nom COLLATE NOCASE`).all(seuil, from);
  const parGroupe = db.prepare(`SELECT g.id, g.name_fr, g.name_ar, COUNT(*) AS collectes,
      SUM(CASE WHEN e.statut = 'retenu' THEN 1 ELSE 0 END) AS retenus
    FROM veille_elements e
    JOIN veille_suggestions vs ON vs.element_id = e.id AND vs.rang = 1
    JOIN groupes_domaines g ON g.id = vs.groupe_id
    WHERE e.collecte_le >= ? GROUP BY g.id ORDER BY collectes DESC LIMIT 12`).all(from);
  const parCommune = db.prepare(`SELECT c.id, c.name_fr, c.name_ar, COUNT(*) AS collectes,
      SUM(CASE WHEN e.statut = 'retenu' THEN 1 ELSE 0 END) AS retenus
    FROM veille_elements e
    JOIN veille_suggestions vs ON vs.element_id = e.id AND vs.rang = 1
    JOIN communes c ON c.id = vs.commune_id
    WHERE e.collecte_le >= ? GROUP BY c.id ORDER BY collectes DESC LIMIT 12`).all(from);
  const viral = db.prepare(`SELECT e.id, e.page_nom, e.url, e.texte, e.date_publication, e.viralite, e.priorite,
      vs.groupe_id, vs.commune_id, g.name_fr AS groupe_fr, g.name_ar AS groupe_ar
    FROM veille_elements e
    LEFT JOIN veille_suggestions vs ON vs.element_id = e.id AND vs.rang = 1
    LEFT JOIN groupes_domaines g ON g.id = vs.groupe_id
    WHERE e.collecte_le >= ? AND e.viralite IS NOT NULL
    ORDER BY e.viralite DESC, e.id DESC LIMIT 5`).all(from);
  const evenements = db.prepare(`SELECT ev.id, ev.debut, ev.fin, ev.nb_elements, ev.nb_sources, ev.priorite,
      g.name_fr AS groupe_fr, g.name_ar AS groupe_ar, c.name_fr AS commune_fr, c.name_ar AS commune_ar
    FROM veille_evenements ev LEFT JOIN groupes_domaines g ON g.id = ev.groupe_id
    LEFT JOIN communes c ON c.id = ev.commune_id
    WHERE ev.fin >= ? ORDER BY ev.nb_sources DESC, ev.score DESC LIMIT 5`).all(from);
  const sante = db.prepare(`SELECT s.id, s.nom, s.type, s.actif, s.derniere_execution, s.dernier_statut,
      s.dernier_message, s.jeton_expire_le, j.statut AS job_statut, j.erreur_code, j.erreur_message,
      j.prochaine_execution
    FROM veille_sources s LEFT JOIN veille_jobs j ON j.source_id = s.id
    ORDER BY s.actif DESC, s.nom COLLATE NOCASE`).all();
  const reactionRows = db.prepare(`SELECT date_publication, traite_le FROM veille_elements
    WHERE collecte_le >= ? AND traite_le IS NOT NULL AND date_publication IS NOT NULL LIMIT 5000`).all(from);
  const traitementRows = db.prepare(`SELECT a.date_traitement, e.traite_le FROM veille_elements e
    JOIN anomalies a ON a.id = e.anomalie_id
    WHERE e.collecte_le >= ? AND e.traite_le IS NOT NULL AND a.date_traitement IS NOT NULL LIMIT 5000`).all(from);

  return {
    periode: { jours: periode, du: from, au: iso(now) },
    totaux: {
      collectes: total,
      pertinents: Number(totaux.pertinents || 0),
      retenus: Number(totaux.retenus || 0),
      rejetes: Number(totaux.rejetes || 0),
      ignores: Number(totaux.ignores || 0),
      a_qualifier: Number(totaux.a_qualifier || 0),
      convertis: Number(totaux.convertis || 0),
    },
    qualite: {
      precision_estimee: ratio(totaux.retenus, Number(totaux.retenus || 0) + Number(totaux.rejetes || 0)),
      rappel_estime: ratio(totaux.retenus, Number(totaux.retenus || 0) + Number(totaux.ignores || 0)),
      conversion: ratio(totaux.convertis, totaux.retenus),
      delai_median_heures: median(reactionRows.map((row) => delayHours(row.date_publication, row.traite_le))),
      delai_traitement_heures: median(traitementRows.map((row) => delayHours(row.traite_le, row.date_traitement))),
    },
    par_jour: fillDays(parJour, periode, now),
    par_source: parSource,
    par_groupe: parGroupe,
    par_commune: parCommune,
    viral,
    evenements,
    pics: computePeaks(db, { now }),
    sante_sources: sante,
  };
}
