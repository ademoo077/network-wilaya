import { refLabel } from '../../i18n/index.jsx';

export function anomalyLabel(item, prefix, lang) {
  if (!item) return '—';
  const ar = item[`${prefix}_ar`];
  const fr = item[`${prefix}_fr`];
  return lang === 'fr' ? (fr || ar || '—') : (ar || fr || '—');
}

export function refOptions(items, lang, extra = {}) {
  return items.filter((item) => extra.includeInactive || Number(item.actif) !== 0).map((item) => ({
    value: item.id,
    label: refLabel(item, lang),
    disabled: Number(item.actif) === 0,
  }));
}

export function compactPayload(form) {
  const nullable = ['date_publication', 'adresse_texte', 'lieu_dit', 'agent_id', 'date_verification', 'epic_id', 'intervenant_autre', 'date_intervention', 'date_traitement', 'observations'];
  const ids = ['domaine_id', 'type_id', 'daira_id', 'commune_id', 'agent_id', 'epic_id'];
  const payload = { ...form };
  for (const key of nullable) if (payload[key] === '') payload[key] = null;
  for (const key of ids) if (payload[key] !== null && payload[key] !== '') payload[key] = Number(payload[key]);
  delete payload.gps_text;
  delete payload.pieces;
  return payload;
}

export function formFromItem(item) {
  return {
    plateforme: item.plateforme,
    lien_url: item.lien_url,
    date_publication: item.date_publication || '',
    date_signalement: item.date_signalement,
    domaine_id: String(item.domaine_id),
    type_id: String(item.type_id),
    daira_id: String(item.daira_id),
    commune_id: String(item.commune_id),
    adresse_texte: item.adresse_texte || '',
    lieu_dit: item.lieu_dit || '',
    gps: item.gps,
    gps_text: item.gps ? `${Number(item.gps.lat).toFixed(6)}, ${Number(item.gps.lng).toFixed(6)}` : '',
    priorite: item.priorite,
    observations: item.observations || '',
    verification: item.verification,
    agent_id: item.agent_id ? String(item.agent_id) : '',
    date_verification: item.date_verification || '',
    statut: item.statut,
    epic_id: item.epic_id ? String(item.epic_id) : '',
    intervenant_autre: item.intervenant_autre || '',
    date_intervention: item.date_intervention || '',
    date_traitement: item.date_traitement || '',
    motif: '',
  };
}

const historyKeys = {
  creation: 'field.reference', plateforme: 'field.platform', lien_url: 'field.link',
  date_publication: 'field.publicationDate', date_signalement: 'field.reportDate',
  domaine_id: 'field.category', type_id: 'field.type', daira_id: 'field.daira',
  commune_id: 'field.commune', adresse_texte: 'field.address', lieu_dit: 'field.place',
  gps: 'field.gps', verification: 'field.verification', agent_id: 'field.agent',
  date_verification: 'field.verificationDate', statut: 'field.status', epic_id: 'field.epic',
  intervenant_autre: 'field.otherParty', date_intervention: 'field.interventionDate',
  date_traitement: 'field.treatmentDate', priorite: 'field.priority', observations: 'field.observations',
  suppression: 'common.delete', restauration: 'common.restore',
};

export function historyLabel(field, t) {
  return t(historyKeys[field] || 'common.details');
}
