import { anomalieCreateSchema, zodFields } from './schemas.js';
import { normaliserUrl } from './url.js';
import { todayAlgiers } from './dates.js';
import { needsAnomalyReason, validateAnomalyState } from './anomalyState.js';
import { codesExigences } from './statut.js';

export function formPayload(values) {
  const payload = { ...values }; delete payload.gps_text;
  for (const key of ['date_publication', 'adresse_texte', 'lieu_dit', 'agent_id', 'agent_source', 'agent_motif', 'date_verification', 'epic_id', 'intervenant_autre',
    'date_intervention', 'date_traitement', 'observations', 'gps_source', 'sans_photo_motif', 'source_reseau_id']) if (payload[key] === '') payload[key] = null;
  for (const key of ['domaine_id', 'type_id', 'daira_id', 'commune_id', 'agent_id', 'epic_id', 'source_reseau_id']) {
    if (payload[key] !== null && payload[key] !== '') payload[key] = Number(payload[key]);
  }
  return payload;
}
export function formNeedsReason(values, original) {
  return needsAnomalyReason(values, original);
}
export function validateForm(values, original) {
  const parsed = anomalieCreateSchema.safeParse(formPayload(values));
  const errors = parsed.success ? {} : Object.fromEntries(Object.keys(zodFields(parsed.error)).map((key) => [key, 'validation.invalid']));
  for (const key of ['lien_url', 'domaine_id', 'type_id', 'daira_id', 'commune_id', 'date_signalement']) if (!values[key]) errors[key] = 'validation.required';
  if (values.lien_url && !normaliserUrl(values.lien_url).ok) errors.lien_url = 'lien.invalide';
  const today = todayAlgiers();
  for (const key of ['date_publication', 'date_signalement', 'date_intervention', 'date_traitement', 'date_verification']) if (values[key] > today) errors[key] = 'validation.future';
  if (values.date_publication && values.date_publication > values.date_signalement) errors.date_publication = 'validation.dateOrder';
  try { validateAnomalyState(values, { previous: original, motif: values.motif }); }
  catch (error) {
    const messages = { VERIFICATION_REQUISE: 'form.requirement', AGENT_REQUIS: 'validation.required', INTERVENANT_REQUIS: 'form.requirement',
      MOTIF_REQUIS: 'validation.required', ORDRE_DATES: 'validation.dateOrder', DATE_FUTURE: 'validation.future' };
    for (const key of Object.keys(error.fields || {})) errors[key] = messages[error.code] || 'validation.invalid';
  }
  const codes = codesExigences(values.statut);
  if (codes.includes('intervenant') && !values.epic_id && !values.intervenant_autre && !errors.epic_id) errors.epic_id = 'form.requirement';
  if (codes.includes('date_traitement') && !values.date_traitement && !errors.date_traitement) errors.date_traitement = 'form.requirement';
  if (values.agent_source === 'manuel' && values.agent_id && !values.agent_motif?.trim()) errors.agent_motif = 'validation.required';
  if (formNeedsReason(values, original) && !values.motif?.trim()) errors.motif = 'validation.required';
  return errors;
}
