import {
  analyserTexte, detectLanguage, geoFilterAllows, normalizeForMatch, resolveTerritory, simhash64,
} from '@anm/shared';
import { groupNameOf, seuils } from './context.js';

export function analyserElement(raw, context, { viral = false } = {}) {
  const texte = String(raw.texte || '').trim().slice(0, 10000);
  const langue = detectLanguage(texte);
  const analysis = analyserTexte(texte, context.lexicon, {
    seuils: seuils(context),
    viral,
    risqueGroupIds: context.risqueGroupIds,
    groupName: (suggestion) => groupNameOf(context, suggestion),
  });
  const territory = resolveTerritory({
    text: texte, geo: raw.gps || null, aliases: context.aliases, communes: context.communes,
    sourceCommuneId: raw.source_commune_id || null,
  });
  const geoAllowed = geoFilterAllows(territory, context.params.veille_filtre_geo || 'source_ou_lieu');
  return {
    texte,
    texte_norm: normalizeForMatch(texte),
    langue,
    simhash: simhash64(texte),
    score: analysis.score,
    confiance: analysis.confidence,
    priorite: analysis.priorite,
    urgent: analysis.urgent,
    suggestions: analysis.suggestions.map((suggestion) => ({ ...suggestion, source_geo: territory?.source_geo || null })),
    correspondances: analysis.matches,
    territoire: territory,
    geo_allowed: geoAllowed,
    statut: !geoAllowed ? 'ignore' : analysis.confidence ? 'a_qualifier' : 'ignore',
    raison_rejet: !geoAllowed ? 'hors_zone' : null,
  };
}

export function saveAnalysis(db, elementId, analysis) {
  db.transaction(() => {
    db.prepare(`UPDATE veille_elements SET texte_norm = ?, langue = ?, score = ?, confiance = ?,
      priorite = ?, simhash = ?, statut = ?, raison_rejet = ?,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`)
      .run(analysis.texte_norm, analysis.langue, analysis.score, analysis.confiance,
        analysis.priorite, analysis.simhash, analysis.statut, analysis.raison_rejet, elementId);
    db.prepare('DELETE FROM veille_correspondances WHERE element_id = ?').run(elementId);
    db.prepare('DELETE FROM veille_suggestions WHERE element_id = ?').run(elementId);
    const insertMatch = db.prepare(`INSERT OR IGNORE INTO veille_correspondances
      (element_id, terme_id, occurrences, poids_total) VALUES (?, ?, ?, ?)`);
    for (const match of analysis.correspondances) {
      if (!match.id) continue;
      insertMatch.run(elementId, match.id, match.occurrences, Number(match.poids || 0) * Math.min(match.occurrences, 2));
    }
    const insertSuggestion = db.prepare(`INSERT INTO veille_suggestions
      (element_id, rang, groupe_id, domaine_id, type_id, score, commune_id, daira_id, priorite, source_geo, raisons_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    analysis.suggestions.forEach((suggestion, index) => {
      insertSuggestion.run(elementId, index + 1, suggestion.groupe_id || null, suggestion.domaine_id || null,
        suggestion.type_id || null, suggestion.score, analysis.territoire?.commune_id || null,
        analysis.territoire?.daira_id || null, analysis.priorite, suggestion.source_geo || null,
        JSON.stringify(suggestion.raisons || []));
    });
  })();
  return analysis;
}
