export const QUICK_VIEWS = [
  { id: 'all', label: 'list.all', filters: {} },
  { id: 'non_traite', label: 'status.non_traite', filters: { statut: 'non_traite' } },
  { id: 'en_cours', label: 'status.en_cours', filters: { statut: 'en_cours' } },
  { id: 'traite', label: 'status.traite', filters: { statut: 'traite' } },
  { id: 'urgentes', label: 'priority.urgente', filters: { priorite: 'urgente', ouvertes: 1 } },
  { id: 'retard', label: 'list.late', filters: { retard: 1 } },
  { id: 'non_affectees', label: 'list.nonAffectees', filters: { sans_agent: 1 } },
  { id: 'mes_anomalies', label: 'list.mesAnomalies', filters: { mes: 1 } },
];
export const QUICK_FILTER_KEYS = ['statut', 'priorite', 'ouvertes', 'retard', 'sans_agent', 'mes'];

/** Préréglages de période : la valeur est la largeur de la fenêtre en jours (1 = aujourd’hui). */
export const PERIOD_OPTIONS = [
  { value: '', label: 'list.periodAll' },
  { value: '1', label: 'list.periodToday' },
  { value: '7', label: 'list.period7' },
  { value: '30', label: 'list.period30' },
  { value: '90', label: 'list.period90' },
];
