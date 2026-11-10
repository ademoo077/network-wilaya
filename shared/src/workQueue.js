/**
 * File de travail « À faire » : une seule définition partagée par l'API,
 * la page dédiée et la cloche de notifications.
 */
export const WORK_QUEUES = [
  { id: 'verification_retard', label: 'work.verification', filters: { verification_retard: 1 }, gravite: 'attention' },
  { id: 'sla_depassee', label: 'work.urgent', filters: { sla_depassee: 1 }, gravite: 'critique' },
  { id: 'incompletes', label: 'work.incomplete', filters: { incompletes: 1 }, gravite: 'attention' },
  { id: 'sans_photo', label: 'work.noPhoto', filters: { sans_photo: 1 }, gravite: 'info' },
  { id: 'urgentes', label: 'dashboard.urgentOpen', filters: { priorite: 'urgente', ouvertes: 1 }, gravite: 'critique' },
  { id: 'retard', label: 'list.late', filters: { retard: 1 }, gravite: 'attention' },
];

/** Alerte systeme : jamais comptee dans la file des anomalies. */
export const WORK_SYSTEM_ALERTS = ['sauvegarde_manquante', 'certificat_expire'];

export function queueFilterKeys() {
  return [...new Set(WORK_QUEUES.flatMap((queue) => Object.keys(queue.filters)))];
}
