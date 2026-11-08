export const ROLES = ['admin', 'operateur', 'lecteur'];

export const ROLE_KEYS = {
  admin: 'role.admin',
  operateur: 'role.operateur',
  lecteur: 'role.lecteur',
};

export const PLATEFORMES = [
  'facebook', 'instagram', 'tiktok', 'youtube', 'x', 'whatsapp', 'telegram', 'autre',
];

export const STATUTS = ['non_traite', 'en_cours', 'traite'];
export const VERIFICATIONS = ['a_verifier', 'confirmee', 'infirmee'];
export const PRIORITES = ['normale', 'haute', 'urgente'];
export const GPS_SOURCES = ['manuel', 'lien_carte', 'lien_court', 'legende', 'exif', 'appareil', 'carte', 'voisinage'];
export const CONTENU_TYPES = ['reel', 'video', 'post', 'story', 'short', 'photo', 'autre'];

export const REF_ENTITIES = ['domaines', 'types', 'dairas', 'communes', 'epics', 'agents'];

export const DEFAULT_PARAMS = {
  nom_cellule: 'Cellule technique de numérisation',
  week_start_day: '0',
  delai_retard_jours: '7',
  exiger_verification: '1',
  tile_url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  backup_retention_days: '30',
  gps_bbox: '36.40,2.50,36.95,3.40',
  rayon_doublon_m: '50',
  objectif_taux_traitement: '80',
  sla_urgente_j: '2',
  sla_haute_j: '5',
  sla_normale_j: '10',
  delai_verification_cible_j: '2',
  enrichissement_en_ligne: '0',
  rapport_auto_fige: '1',
  https_actif: '0',
};

export const PUBLIC_PARAMS = [
  'nom_cellule', 'week_start_day', 'tile_url', 'gps_bbox', 'delai_retard_jours',
  'rayon_doublon_m', 'objectif_taux_traitement', 'sla_urgente_j', 'sla_haute_j',
  'sla_normale_j', 'delai_verification_cible_j', 'https_actif',
];

export const PAGE_SIZE_DEFAULT = 25;
export const PAGE_SIZE_MAX = 200;

export const SORTABLE = {
  reference: 'a.reference',
  date_signalement: 'a.date_signalement',
  statut: 'a.statut',
  domaine: 'd.ordre',
  type: 't.ordre',
  daira: 'da.name_fr',
  commune: 'c.name_fr',
  epic: 'e.name',
  priorite: 'a.priorite',
  verification: 'a.verification',
  created_at: 'a.created_at',
};

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_PIECES = 5;
export const MAX_IMPORT_ROWS = 5000;

export const ALLOWED_MIME = {
  'image/png': [[0x89, 0x50, 0x4e, 0x47]],
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]],
};

export const AUDIT_ACTIONS = [
  'LOGIN_OK', 'LOGIN_FAIL', 'LOGOUT', 'PASSWORD_CHANGE',
  'USER_CREATE', 'USER_UPDATE', 'USER_RESET_PASSWORD',
  'ANOMALIE_CREATE', 'ANOMALIE_UPDATE', 'ANOMALIE_STATUT',
  'ANOMALIE_VERIFICATION', 'ANOMALIE_DELETE', 'ANOMALIE_RESTORE',
  'IMPORT_COMMIT', 'EXPORT',
  'REF_CREATE', 'REF_UPDATE', 'REF_DISABLE',
  'PARAM_UPDATE', 'BACKUP_CREATE', 'BACKUP_RESTORE', 'BACKUP_DELETE',
  'REPORT_SNAPSHOT',
  'LIMITES_IMPORT',
];

export const AUDIT_ACTION_KEYS = Object.fromEntries(
  AUDIT_ACTIONS.map((a) => [a, `audit.${a}`]),
);

export const EXPORT_FORMATS = ['xlsx', 'csv'];

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const VERSION = '5.0.0';
