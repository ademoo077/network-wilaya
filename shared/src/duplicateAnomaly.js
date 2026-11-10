/** Une nouvelle fiche issue de la même publication, sans reprendre son traitement ni sa position. */
export function duplicateAnomalyValues(values) {
  return Object.fromEntries(['lien_url', 'plateforme', 'contenu_type', 'date_publication', 'date_publication_estimee',
    'date_signalement', 'daira_id', 'commune_id'].map((key) => [key, values[key]]));
}
