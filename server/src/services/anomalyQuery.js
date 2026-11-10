import { escapeLike, normalize, SORTABLE } from '@anm/shared';
import { addQueueFilters } from './queueFilters.js';

/**
 * Construit la clause WHERE commune aux listes et statistiques.
 * deleted_at IS NULL est centralisé ici (sauf corbeille explicite).
 */
export function buildFilters(params = {}, options = {}) {
  const table = options.table || 'a';
  const where = [];
  const values = {};
  if (options.trash) where.push(`${table}.deleted_at IS NOT NULL`);
  else if (!options.includeDeleted) where.push(`${table}.deleted_at IS NULL`);
  if (!params.include_infirmees) where.push(`${table}.verification <> 'infirmee'`);

  const direct = [
    ['statut', 'statut'], ['verification', 'verification'], ['domaine', 'domaine_id'],
    ['type', 'type_id'], ['daira', 'daira_id'], ['commune', 'commune_id'],
    ['epic', 'epic_id'], ['agent', 'agent_id'], ['plateforme', 'plateforme'], ['priorite', 'priorite'],
  ];
  for (const [param, column] of direct) {
    const value = params[param];
    if (value === undefined || value === null || value === '') continue;
    where.push(`${table}.${column} = @${param}`);
    values[param] = value;
  }
  if (params.from) { where.push(`${table}.date_signalement >= @from`); values.from = params.from; }
  if (params.to) { where.push(`${table}.date_signalement <= @to`); values.to = params.to; }
  if (params.gps === 'absent') where.push(`${table}.gps_lat IS NULL`);
  if (params.gps === 'present') where.push(`${table}.gps_lat IS NOT NULL AND ${table}.gps_lng IS NOT NULL`);
  addQueueFilters(params, table, where, values);
  if (params.date_traitement_from) { where.push(`${table}.date_traitement >= @dtFrom`); values.dtFrom = params.date_traitement_from; }
  if (params.date_traitement_to) { where.push(`${table}.date_traitement <= @dtTo`); values.dtTo = params.date_traitement_to; }

  const words = normalize(params.q || '').split(' ').filter(Boolean).slice(0, 12);
  words.forEach((word, index) => {
    const key = `q${index}`;
    where.push(`${table}.search_norm LIKE @${key} ESCAPE '\\'`);
    values[key] = `%${escapeLike(word)}%`;
  });

  return { clause: where.length ? `WHERE ${where.join(' AND ')}` : '', values };
}

export function orderBy(sort, dir) {
  const column = SORTABLE[sort] || SORTABLE.date_signalement;
  const direction = dir === 'asc' ? 'ASC' : 'DESC';
  return `ORDER BY ${column} ${direction}, a.id ${direction}`;
}
