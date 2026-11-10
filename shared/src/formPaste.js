export function pasteAutofill(result, includeText = true) {
  const items = [];
  const add = (champ, valeur, extra = {}) => items.push({ champ, valeur, source: 'collage', ...extra });
  const link = result.urls.find((url) => url.type === 'social' || url.type === 'autre');
  if (link) {
    add('lien_url', link.normalise); add('plateforme', link.plateforme || 'autre'); add('contenu_type', link.contenuType || 'autre');
  }
  const date = result.dates[0];
  if (date) add('date_publication', date.date, { estimee: date.estimee, source: date.source, onlyEmpty: true });
  if (result.coords.length === 1) {
    const point = result.coords[0]; add('gps', point, { source: point.source, confiance: point.confiance });
  }
  const place = result.urls.find((url) => url.lieu)?.lieu;
  if (place) add('adresse_texte', place, { suggestion: true, source: 'lien_carte' });
  if (includeText && result.texteRestant.length >= 10) add('observations', result.texteRestant);
  return items;
}
