export const QUICK_VIEWS = [
  { id: 'all', label: 'list.all', filters: {} },
  { id: 'a_verifier', label: 'verification.a_verifier', filters: { verification: 'a_verifier' } },
  { id: 'non_traite', label: 'status.non_traite', filters: { statut: 'non_traite' } },
  { id: 'en_cours', label: 'status.en_cours', filters: { statut: 'en_cours' } },
  { id: 'traite', label: 'status.traite', filters: { statut: 'traite' } },
  { id: 'urgentes', label: 'priority.urgente', filters: { priorite: 'urgente', ouvertes: 1 } },
  { id: 'retard', label: 'list.late', filters: { retard: 1 } },
];
export const QUICK_FILTER_KEYS = ['statut', 'verification', 'priorite', 'ouvertes', 'retard'];
