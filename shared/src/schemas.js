import { z } from 'zod';
import { interventionWorkflowSchema } from './interventions.js';
import {
  CONTENU_TYPES, DATE_RE, GPS_SOURCES, PLATEFORMES, PRIORITES, ROLES, STATUTS, VERIFICATIONS,
} from './constants.js';
import { isDateString } from './dates.js';

export const dateString = z.string().regex(DATE_RE, 'Date attendue au format AAAA-MM-JJ').refine(isDateString, 'Date invalide');
export const optionalDate = dateString.nullable().optional();
export const idSchema = z.coerce.number().int().positive();
export const optionalId = z.coerce.number().int().positive().nullable().optional();

/** Booléen de requête : accepte true/false, 1/0, oui/non, on/off. */
export const booleanFlag = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'oui', 'yes', 'on'].includes(String(value).toLowerCase());
}, z.boolean().optional());

export function passwordErrors(password, username = '') {
  const errors = [];
  if (!password || password.length < 10) errors.push('Au moins 10 caractères');
  if (!/[A-Za-z]/.test(password || '')) errors.push('Au moins une lettre');
  if (!/[0-9]/.test(password || '')) errors.push('Au moins un chiffre');
  if (username && String(password).toLowerCase() === String(username).toLowerCase()) {
    errors.push('Différent de l’identifiant');
  }
  return errors;
}

export const passwordSchema = z.string().superRefine((value, ctx) => {
  for (const message of passwordErrors(value)) ctx.addIssue({ code: 'custom', message });
});

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Identifiant requis').max(64),
  password: z.string().min(1, 'Mot de passe requis').max(200),
});

export const changePasswordSchema = z.object({
  current: z.string().min(1, 'Mot de passe actuel requis'),
  next: passwordSchema,
});

export const gpsSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
}).nullable();

const baseAnomalie = {
  plateforme: z.enum(PLATEFORMES).optional(),
  lien_url: z.string().trim().min(1, 'Lien requis').max(2000),
  date_publication: optionalDate,
  date_signalement: dateString.optional(),
  domaine_id: idSchema,
  type_id: idSchema,
  daira_id: idSchema,
  commune_id: idSchema,
  adresse_texte: z.string().max(500).nullable().optional(),
  lieu_dit: z.string().max(300).nullable().optional(),
  gps: gpsSchema.optional(),
  gps_source: z.enum(GPS_SOURCES).nullable().optional(),
  gps_precision_m: z.coerce.number().int().min(0).max(1000000).nullable().optional(),
  gps_verifiee: z.coerce.number().int().min(0).max(1).optional(),
  lie_a_id: optionalId,
  contenu_type: z.enum(CONTENU_TYPES).nullable().optional(),
  date_publication_estimee: z.coerce.number().int().min(0).max(1).optional(),
  legende: z.string().max(10000).nullable().optional(),
  auteur_publication: z.string().max(500).nullable().optional(),
  priorite: z.enum(PRIORITES).optional(),
  observations: z.string().max(5000).nullable().optional(),
  verification: z.enum(VERIFICATIONS).optional(),
  agent_id: optionalId,
  date_verification: optionalDate,
  statut: z.enum(STATUTS).optional(),
  epic_id: optionalId,
  intervenant_autre: z.string().max(200).nullable().optional(),
  date_intervention: optionalDate,
  date_traitement: optionalDate,
  veille_element_id: optionalId,
  sans_photo_motif: z.string().trim().max(1000).nullable().optional(),
};

export const anomalieCreateSchema = z.object({
  ...baseAnomalie,
  motif: z.string().trim().max(1000).optional(),
  force_duplicate: z.boolean().optional(),
});

export const anomaliePatchSchema = z.object({
  ...baseAnomalie,
  version: idSchema,
  motif: z.string().trim().max(1000).optional(),
  force_duplicate: z.boolean().optional(),
}).partial().extend({ version: idSchema });

export const statutChangeSchema = z.object({
  version: idSchema,
  statut: z.enum(STATUTS),
  epic_id: optionalId,
  intervenant_autre: z.string().max(200).nullable().optional(),
  date_intervention: optionalDate,
  date_traitement: optionalDate,
  motif: z.string().trim().max(1000).optional(),
  sans_photo_motif: z.string().trim().max(1000).nullable().optional(),
});

export const verificationChangeSchema = z.object({
  version: idSchema,
  verification: z.enum(VERIFICATIONS),
  agent_id: optionalId,
  date_verification: optionalDate,
  motif: z.string().trim().max(1000).optional(),
});

export const bulkStatutSchema = z.object({
  ids: z.array(idSchema).min(1).max(200),
  statut: z.enum(STATUTS),
  epic_id: optionalId,
  intervenant_autre: z.string().max(200).nullable().optional(),
  date_intervention: optionalDate,
  date_traitement: optionalDate,
  motif: z.string().trim().max(1000).optional(),
});

export const anomalieQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  statut: z.enum(STATUTS).optional(),
  verification: z.enum(VERIFICATIONS).optional(),
  domaine: optionalId, type: optionalId, daira: optionalId, commune: optionalId,
  epic: optionalId, agent: optionalId, plateforme: z.enum(PLATEFORMES).optional(),
  priorite: z.enum(PRIORITES).optional(),
  from: optionalDate, to: optionalDate,
  gps: z.enum(['absent', 'present']).optional(),
  ouvertes: booleanFlag, retard: booleanFlag, verification_retard: booleanFlag, sla_depassee: booleanFlag,
  incompletes: booleanFlag, sans_photo: booleanFlag, sans_agent: booleanFlag, lie_a: optionalId,
  include_infirmees: booleanFlag,
  page: z.coerce.number().int().min(1).max(100000).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
  sort: z.enum(['reference', 'date_signalement', 'statut', 'domaine', 'type', 'daira', 'commune', 'epic', 'priorite', 'verification', 'created_at']).optional(),
  dir: z.enum(['asc', 'desc']).optional(),
});

const nameFr = z.string().trim().max(200).nullable().optional();
const nameAr = z.string().trim().max(200).nullable().optional();

export const refSchemas = {
  domaines: z.object({
    name_ar: z.string().trim().min(1, 'Nom arabe requis').max(200),
    name_fr: nameFr,
    ordre: z.coerce.number().int().min(0).max(9999).optional(),
    actif: z.coerce.number().int().min(0).max(1).optional(),
  }),
  types: z.object({
    domaine_id: idSchema,
    name_ar: z.string().trim().min(1, 'Nom arabe requis').max(200),
    name_fr: nameFr,
    ordre: z.coerce.number().int().min(0).max(9999).optional(),
    actif: z.coerce.number().int().min(0).max(1).optional(),
  }),
  dairas: z.object({
    name_fr: z.string().trim().min(1, 'Nom français requis').max(200),
    name_ar: nameAr,
    actif: z.coerce.number().int().min(0).max(1).optional(),
  }),
  communes: z.object({
    daira_id: idSchema,
    name_fr: z.string().trim().min(1, 'Nom français requis').max(200),
    name_ar: nameAr,
    actif: z.coerce.number().int().min(0).max(1).optional(),
  }),
  epics: z.object({
    name: z.string().trim().min(1, 'Nom requis').max(200),
    sigle: z.string().trim().max(40).nullable().optional(),
    contact_nom: z.string().trim().max(200).nullable().optional(),
    contact_tel: z.string().trim().max(40).nullable().optional(),
    actif: z.coerce.number().int().min(0).max(1).optional(),
    domaine_ids: z.array(idSchema).max(200).optional(),
    workflow: interventionWorkflowSchema.nullable().optional(),
  }),
  agents: z.object({
    full_name: z.string().trim().min(1, 'Nom requis').max(200),
    grade: z.string().trim().max(200).nullable().optional(),
    email: z.preprocess((value) => value === '' ? null : value, z.string().trim().email('Adresse e-mail invalide').max(254).nullable().optional()),
    matricule: z.string().trim().max(60).nullable().optional(),
    telephone: z.string().trim().max(40).nullable().optional(),
    zone_daira_id: optionalId,
    actif: z.coerce.number().int().min(0).max(1).optional(),
  }),
};

export const refUpdateSchemas = Object.fromEntries(
  Object.entries(refSchemas).map(([key, schema]) => [key, schema.partial()]),
);

export const sansSuiteSchema = z.object({
  version: idSchema,
  motif: z.string().trim().max(1000),
});

export const settingsSchema = z.object({
  nom_cellule: z.string().trim().min(1).max(120),
  week_start_day: z.coerce.number().int().min(0).max(6),
  delai_retard_jours: z.coerce.number().int().min(1).max(365),
  exiger_verification: z.coerce.number().int().min(0).max(1),
  tile_url: z.string().trim().url().refine((v) => v.includes('{z}') && v.includes('{x}') && v.includes('{y}'), 'Modèle de tuiles invalide'),
  backup_retention_days: z.coerce.number().int().min(1).max(3650),
  gps_bbox: z.string().trim().regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/, 'Format : lat_min,lng_min,lat_max,lng_max'),
  rayon_doublon_m: z.coerce.number().int().min(1).max(5000).optional(),
  objectif_taux_traitement: z.coerce.number().min(0).max(100).optional(),
  sla_urgente_j: z.coerce.number().int().min(0).max(365).optional(),
  sla_haute_j: z.coerce.number().int().min(0).max(365).optional(),
  sla_normale_j: z.coerce.number().int().min(0).max(365).optional(),
  delai_verification_cible_j: z.coerce.number().int().min(0).max(365).optional(),
  enrichissement_en_ligne: z.coerce.number().int().min(0).max(1).optional(),
  resolution_liens: z.enum(['cartes', 'tous', 'aucune']).optional(),
  enrichissement_metadonnees: z.coerce.number().int().min(0).max(1).optional(),
  rapport_auto_fige: z.coerce.number().int().min(0).max(1).optional(),
  https_actif: z.coerce.number().int().min(0).max(1).optional(),
  veille_activee: z.coerce.number().int().min(0).max(1).optional(),
  veille_conservation_jours: z.coerce.number().int().min(1).max(3650).optional(),
  veille_seuil_suggestion: z.coerce.number().int().min(1).max(100).optional(),
  veille_seuil_pertinent: z.coerce.number().int().min(1).max(100).optional(),
  veille_filtre_geo: z.enum(['strict', 'source_ou_lieu', 'aucun']).optional(),
  veille_pseudonymiser_auteurs: z.coerce.number().int().min(0).max(1).optional(),
  veille_stocker_auteur: z.coerce.number().int().min(0).max(1).optional(),
  veille_fenetre_doublon_h: z.coerce.number().int().min(1).max(720).optional(),
});

export const userCreateSchema = z.object({
  username: z.string().trim().min(3, '3 caractères minimum').max(32).regex(/^[A-Za-z0-9_.-]+$/, 'Lettres, chiffres, . _ - uniquement'),
  full_name: z.string().trim().min(1, 'Nom requis').max(120),
  role: z.enum(ROLES),
  password: passwordSchema,
});

export const userUpdateSchema = z.object({
  full_name: z.string().trim().min(1).max(120).optional(),
  role: z.enum(ROLES).optional(),
  actif: z.coerce.number().int().min(0).max(1).optional(),
});

export const statsQuerySchema = anomalieQuerySchema.extend({
  all_periods: booleanFlag,
  include_empty: booleanFlag,
  by: z.enum(['domaine', 'type', 'daira', 'commune', 'epic', 'agent', 'plateforme', 'priorite']).optional(),
  granularity: z.enum(['week']).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export const refBulkTerritoireSchema = z.object({
  texte: z.string().min(1, 'Texte requis').max(200000),
  dryRun: z.boolean().optional(),
});

export const importCommitSchema = z.object({
  importId: z.string().min(8).max(120),
  mode: z.enum(['valid_only', 'all_or_nothing']),
});

const emptyToUndefined = (value) => (value === '' || value === null ? undefined : value);

/** Options facultatives d'un aperçu d'import (statuts « Traité » / « En cours »). */
export const importPreviewOptionsSchema = z.object({
  agent_id: z.preprocess(emptyToUndefined, optionalId),
  epic_id: z.preprocess(emptyToUndefined, optionalId),
}).strict();

export const snapshotSchema = z.object({ semaine: dateString });

export const reportQuerySchema = z.object({
  semaine: optionalDate,
  source: z.enum(['live', 'snapshot']).optional(),
  version: z.coerce.number().int().min(1).optional(),
  include_infirmees: booleanFlag,
});

export const smartPasteSchema = z.object({
  texte: z.string().min(1, 'Texte requis').max(200000),
});

export const geoLocateSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
}).refine((value) => value.lat !== 0 || value.lng !== 0, 'La position 0,0 est invalide');

export const nearbyQuerySchema = geoLocateSchema.and(z.object({
  radius: z.coerce.number().min(1).max(5000).optional(),
  type: optionalId,
  domaine: optionalId,
  exclude: optionalId,
}));

export function zodFields(error) {
  const fields = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}
