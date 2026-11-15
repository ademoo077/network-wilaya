import { getParams } from '../services/settings.js';

export function veilleContext(db) {
  const lexicon = db.prepare(`SELECT id, terme, terme_norm, langue, role, groupe_id, domaine_id, type_id,
      poids, actif, origine, vus, acceptes, rejetes FROM veille_lexique WHERE actif = 1`).all();
  const groups = db.prepare('SELECT id, name_fr, name_ar FROM groupes_domaines').all();
  const groupNames = new Map(groups.map((group) => [Number(group.id), group.name_fr]));
  const risqueGroupIds = groups.filter((group) => ['Risques naturels', 'Bâtiments et habitat'].includes(group.name_fr))
    .map((group) => Number(group.id));
  const communes = db.prepare('SELECT id, daira_id, name_fr, name_ar FROM communes WHERE actif = 1').all();
  const aliases = db.prepare('SELECT id, alias, alias_norm, commune_id, daira_id, actif FROM veille_alias_lieux WHERE actif = 1').all();
  return { lexicon, groups, groupNames, risqueGroupIds, communes, aliases, params: getParams(db) };
}

export function groupNameOf(context, suggestion) {
  return suggestion?.groupe_id ? context.groupNames.get(Number(suggestion.groupe_id)) || '' : '';
}

export function seuils(context) {
  return {
    suggestion: Number(context.params.veille_seuil_suggestion || 4),
    pertinent: Number(context.params.veille_seuil_pertinent || 2),
  };
}
