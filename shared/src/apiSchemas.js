import { z } from 'zod';
import { DEFAULT_PARAMS, PLATEFORMES, ROLES, STATUTS, VERIFICATIONS } from './constants.js';
import { COMPTE_SOCIAL_TYPES, COMPTE_SOCIAL_VERIFICATIONS } from './reseauxSociaux.js';

const reference = z.object({ id: z.number(), name_fr: z.string().nullable().optional(), name_ar: z.string().nullable().optional() }).passthrough();
const user = z.object({ id: z.number(), username: z.string(), full_name: z.string(), role: z.enum(ROLES), must_change_password: z.number().optional() }).passthrough();
export const authResponseSchema = z.object({ user, csrf: z.string().min(1) });
export const bootstrapResponseSchema = z.object({
  domaines: z.array(reference.extend({ types: z.array(reference).default([]) })).default([]),
  dairas: z.array(reference.extend({ communes: z.array(reference).default([]) })).default([]),
  epics: z.array(reference).default([]), agents: z.array(reference).default([]),
  affectations: z.array(z.object({ daira_id: z.number(), agent_id: z.number(), role: z.enum(['titulaire', 'suppleant']),
    full_name: z.string(), grade: z.string().nullable().optional(), matricule: z.string().nullable().optional() }).passthrough()).default([]),
  parametres: z.record(z.union([z.string(), z.number()])).default(DEFAULT_PARAMS),
  taxonomie: z.object({ domaines: z.number(), types: z.number(), ok: z.boolean() }).optional(),
}).transform((value) => ({ ...value, parametres: { ...DEFAULT_PARAMS, ...value.parametres } }));
export const emptyRefs = { domaines: [], dairas: [], epics: [], agents: [], affectations: [], parametres: DEFAULT_PARAMS, taxonomie: {} };
export const anomalyResponseSchema = z.object({
  id: z.number(), reference: z.string(), version: z.number(), lien_url: z.string(),
  plateforme: z.enum(PLATEFORMES), statut: z.enum(STATUTS), verification: z.enum(VERIFICATIONS),
  gps: z.object({ lat: z.number(), lng: z.number() }).nullable(),
}).passthrough();
export const anomalyListSchema = z.object({ items: z.array(anomalyResponseSchema), total: z.number(), page: z.number(), pageSize: z.number() }).passthrough();
export const emptyAnomalyList = { items: [], total: 0, page: 1, pageSize: 25 };
export const anomalyMapSchema = z.object({ items: z.array(z.object({ id: z.number(), reference: z.string(),
  statut: z.enum(STATUTS), gps: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }),
}).passthrough()), missing: z.number().nonnegative(), total: z.number().nonnegative() });
const items = z.object({ items: z.array(z.object({}).passthrough()) }).passthrough();
const photoPairPieceSchema = z.object({
  id: z.number().int().positive(), anomalie_id: z.number().int().positive(),
  role: z.enum(['avant', 'apres', 'autre']), thumb_url: z.string().nullable(), url: z.string(),
}).passthrough();
export const photoPairsSchema = z.object({
  items: z.array(z.object({
    anomalie_id: z.number().int().positive(), reference: z.string(),
    date_signalement: z.string().nullable().optional(),
    date_intervention: z.string().nullable().optional(),
    date_traitement: z.string().nullable(),
    daira: z.object({ fr: z.string(), ar: z.string() }).passthrough().nullable().optional(),
    commune: z.object({ fr: z.string(), ar: z.string() }).passthrough().nullable().optional(),
    intervenant: z.string().nullable().optional(),
    avant: photoPairPieceSchema, apres: photoPairPieceSchema,
  }).passthrough()),
}).passthrough();
export const veilleElementSchema = z.object({
  id: z.number(), texte: z.string(), statut: z.string(), priorite: z.string(),
  score: z.number(), confiance: z.string().nullable().optional(),
}).passthrough();
export const veilleElementListSchema = z.object({
  items: z.array(veilleElementSchema), total: z.number(), page: z.number(), pageSize: z.number(),
}).passthrough();
export const veilleStatusSchema = z.object({
  item: z.object({ activee: z.boolean(), a_qualifier: z.number(), retenus: z.number(), rejetes: z.number() }).passthrough(),
}).passthrough();

export const compteSocialResponseSchema = z.object({
  id: z.number().int().positive(), version: z.number().int().positive(), nom: z.string(), lien_url: z.string(),
  plateforme: z.enum(PLATEFORMES), categorie: z.enum(COMPTE_SOCIAL_TYPES),
  daira_id: z.number().nullable(), commune_id: z.number().nullable(), ca_libelle: z.string(), commune_libelle: z.string(),
  verification: z.enum(COMPTE_SOCIAL_VERIFICATIONS), actif: z.number().int().min(0).max(1), observations: z.string(),
  origine: z.enum(['manuel', 'excel']), created_at: z.string(), updated_at: z.string(),
}).passthrough();
export const compteSocialItemSchema = z.object({ item: compteSocialResponseSchema });
export const reseauxSociauxListSchema = z.object({ items: z.array(compteSocialResponseSchema), total: z.number().int().nonnegative(), page: z.number(), pageSize: z.number() });
const socialCounts = z.object({ total: z.number().nonnegative(), pages: z.number().nonnegative(), profils: z.number().nonnegative(),
  groupes: z.number().nonnegative(), chaines: z.number().nonnegative(), autres: z.number().nonnegative(),
  actifs: z.number().nonnegative(), a_verifier: z.number().nonnegative(),
  sans_nom: z.number().nonnegative().optional(), sans_lien_normalise: z.number().nonnegative().optional() }).passthrough();
const socialShare = socialCounts.extend({ key: z.string(), pourcentage: z.number().min(0).max(100).nullable() });
export const reseauxSociauxStatsSchema = z.object({ item: z.object({
  resume: socialCounts.extend({ reseaux: z.number().nonnegative(), communes_couvertes: z.number().nonnegative(), ca_couverts: z.number().nonnegative(),
    sans_rattachement: z.number().nonnegative(), communes_referentiel: z.number().nonnegative(), communes_sans_compte: z.number().nonnegative(),
    couverture: z.number().min(0).max(100).nullable() }),
  reseaux: z.array(socialShare), types: z.array(socialShare),
  ca: z.array(socialCounts.extend({ id: z.number().nullable(), name_fr: z.string().nullable(), name_ar: z.string().nullable(),
    communes: z.number().nonnegative(), pourcentage: z.number().min(0).max(100).nullable() })),
  communes: z.array(socialCounts.extend({ id: z.number().nullable(), name_fr: z.string().nullable(), name_ar: z.string().nullable(),
    daira_id: z.number().nullable(), ca_fr: z.string().nullable(), ca_ar: z.string().nullable() })),
}) });
export const reseauxSociauxImportPreviewSchema = z.object({ item: z.object({
  importId: z.string().uuid(), expiresAt: z.string(), fichier: z.string(), feuille: z.literal('LIEN'),
  summary: z.object({ total: z.number(), nouveaux: z.number(), existants: z.number(), doublons: z.number(), erreurs: z.number(), sans_lien: z.number(), a_verifier: z.number() }),
  rows: z.array(z.object({ ligne: z.number(), colonne: z.string(), nom: z.string(), lien_url: z.string(),
    plateforme: z.enum(PLATEFORMES), categorie: z.enum(COMPTE_SOCIAL_TYPES), ca_libelle: z.string(), commune_libelle: z.string(),
    statut: z.enum(['nouveau', 'existant', 'doublon', 'erreur']), messages: z.array(z.string()), erreur: z.string().nullable(),
  }).passthrough()),
}).passthrough() });
export const reseauxSociauxImportResultSchema = z.object({ item: z.object({ created: z.number().nonnegative(), skipped: z.number().nonnegative(),
  deja_applique: z.boolean(), errors: z.array(z.object({ ligne: z.number(), colonne: z.string(), message: z.string() })) }).passthrough() });
export const reseauxSociauxImportCancelSchema = z.object({ item: z.object({ annule: z.literal(true), importId: z.string().uuid() }) });
export const compteSocialBatchResultSchema = z.object({ item: z.object({
  created: z.number().int().nonnegative(), ids: z.array(z.number().int().positive()),
  errors: z.array(z.object({ index: z.number().int().nonnegative(), message: z.string(), fields: z.record(z.string()).optional() })),
}) });
export const compteSocialMergeResultSchema = z.object({ item: z.object({
  sourceId: z.number().int().positive(), cibleId: z.number().int().positive(),
  champs: z.array(z.string()), cible: compteSocialResponseSchema,
}) });
export const compteSocialHistorySchema = z.object({ item: z.object({
  id: z.number().int().positive(), action: z.string(), details: z.unknown().nullable(),
  username: z.string().nullable(), at: z.string(),
}).passthrough() });
export const compteSocialHistoryListSchema = z.object({ items: z.array(compteSocialHistorySchema.shape.item), total: z.number().int().nonnegative() });
export const compteSocialActionResultSchema = z.object({ item: compteSocialResponseSchema });

// V14 — sélection de la page depuis l'URL (répertoire comptes_sociaux, sans table parallèle).
const identifiantSourceSchema = z.object({
  id: z.number().int().positive(), source_id: z.number().int().positive(),
  reseau: z.string(), type: z.enum(['slug', 'id', 'handle', 'canal']),
  valeur: z.string(), valeur_norm: z.string(),
}).passthrough();
export const sourcePageSchema = compteSocialResponseSchema.extend({
  identifiants: z.array(identifiantSourceSchema).default([]),
});
export const sourceRechercheSchema = z.object({ items: z.array(sourcePageSchema) }).passthrough();
export const sourceIdentificationSchema = z.object({
  reseau: z.string(), contenu_type: z.string(), statut: z.enum(['identifie', 'indetermine']),
  identifiants: z.array(z.object({ type: z.enum(['slug', 'id', 'handle', 'canal']), valeur: z.string() })),
  page_url: z.string().nullable(),
  correspondance: sourcePageSchema.nullable(),
  supprimee: sourcePageSchema.nullable().optional(),
  similaires: z.array(sourcePageSchema),
  resolution: z.object({ tentee: z.boolean(), ok: z.boolean() }).passthrough(),
}).passthrough();
export const sourceRapideResultSchema = z.object({
  item: sourcePageSchema, statut: z.number().int(), concurrence: z.boolean().optional(), alias: z.boolean().optional(),
}).passthrough();
export const sourceIdentifiantsResultSchema = z.object({ item: sourcePageSchema });

const syntheseEntry = z.object({ id: z.string() }).passthrough();
export const syntheseCatalogueSchema = z.object({
  version: z.string(), datasets: z.array(syntheseEntry), dimensions: z.array(syntheseEntry),
  mesures: z.array(syntheseEntry), filtres: z.array(syntheseEntry), formats: z.array(syntheseEntry),
  granularites: z.array(syntheseEntry), ops: z.array(syntheseEntry),
}).passthrough();
export const emptySyntheseCatalogue = {
  version: '', datasets: [], dimensions: [], mesures: [], filtres: [], formats: [], granularites: [], ops: [],
};
export const syntheseModelSchema = z.object({
  id: z.number(), nom: z.string(), description: z.string().nullable().optional(),
  portee: z.enum(['prive', 'equipe', 'systeme']), proprietaire_id: z.number().nullable().optional(),
  schema_version: z.number(), version: z.number(), cle_systeme: z.string().nullable().optional(),
  definition: z.object({}).passthrough(), est_proprietaire: z.boolean().optional(),
  modifiable: z.boolean().optional(),
}).passthrough();
export const syntheseModelListSchema = z.object({ items: z.array(syntheseModelSchema) }).passthrough();
const syntheseValeur = z.union([z.number(), z.null()]);
export const syntheseResultSchema = z.object({
  colonnes: z.object({
    dimensions: z.array(z.object({
      id: z.string(), label_fr: z.string(), label_ar: z.string(), type: z.string(),
      granularite: z.string().nullable().optional(),
    }).passthrough()),
    mesures: z.array(z.object({
      id: z.string(), label_fr: z.string(), label_ar: z.string(), format: z.string(),
    }).passthrough()),
  }).passthrough(),
  lignes: z.array(z.object({
    dimensions: z.array(z.object({
      id: z.string(), key: z.union([z.string(), z.number(), z.null()]),
      label_fr: z.string(), label_ar: z.string(),
    }).passthrough()),
    valeurs: z.record(syntheseValeur),
    autre: z.boolean().optional(),
  }).passthrough()),
  totaux: z.object({ valeurs: z.record(syntheseValeur) }).passthrough().nullable(),
  meta: z.object({}).passthrough(),
}).passthrough();
export const syntheseBatchSchema = z.object({ items: z.array(syntheseResultSchema) }).passthrough();
export const syntheseEditionSchema = z.object({
  id: z.number(), modele_id: z.number(), modele_nom: z.string().nullable().optional(),
  periode: z.object({ debut: z.string(), fin: z.string() }).passthrough(),
  parametres: z.object({}).passthrough(),
  version: z.number(), statut: z.enum(['brouillon', 'relu', 'valide', 'fige']),
  figee_le: z.string().nullable().optional(),
  catalogue_version: z.string().nullable().optional(),
  data_version: z.number().nullable().optional(),
  genere_par: z.number().nullable().optional(),
  created_at: z.string(), updated_at: z.string(),
  a_snapshot: z.boolean(), snapshot: z.object({}).passthrough().nullable(),
}).passthrough();
export const syntheseEditionListSchema = z.object({ items: z.array(syntheseEditionSchema) }).passthrough();
export const syntheseNumeroSchema = z.object({ item: z.object({
  reference: z.string(), sequence: z.number().int().nonnegative(), annee: z.string(),
}).passthrough() }).passthrough();
export const syntheseCharteSchema = z.object({ item: z.object({
  verrouille: z.boolean(), palette: z.array(z.string()), polices: z.array(z.string()),
  motif: z.string(), updatedBy: z.number().nullable().optional(), updatedAt: z.string(),
}).passthrough() }).passthrough();
export const syntheseSourceSchema = z.object({ item: z.object({
  id: z.number(), domaine: z.string(), created_at: z.string(),
}).passthrough() }).passthrough();
export const syntheseSourceListSchema = z.object({ items: z.array(z.object({
  id: z.number(), domaine: z.string(), created_at: z.string(),
}).passthrough()) }).passthrough();

const importPreviewRow = z.object({
  ligne: z.number().int().positive(), statut: z.enum(['ok', 'warning', 'error']),
  messages: z.array(z.string()).default([]),
  raw: z.object({}).passthrough(),
  resolved: z.object({
    date: z.string().nullable().optional(), statut: z.enum(STATUTS),
    statut_source: z.enum(STATUTS).nullable().optional(),
    categorie: z.string().nullable().optional(), type: z.string().nullable().optional(),
    daira: z.string().nullable().optional(), commune: z.string().nullable().optional(),
    type_approx: z.boolean().optional(),
  }).passthrough(),
  data: z.object({}).passthrough().optional(),
}).passthrough();

export const anomaliesImportPreviewSchema = z.object({ item: z.object({
  importId: z.string().min(8), fileName: z.string(), sheetName: z.string().nullable().optional(),
  summary: z.object({
    total: z.number().int().nonnegative(), ok: z.number().int().nonnegative(),
    warning: z.number().int().nonnegative(), error: z.number().int().nonnegative(),
  }).passthrough(),
  rows: z.array(importPreviewRow),
}).passthrough() });

export const anomaliesImportResultSchema = z.object({ item: z.object({
  importId: z.string(), created: z.number().int().nonnegative(), skipped: z.number().int().nonnegative(),
  errors: z.array(z.object({ ligne: z.number(), messages: z.array(z.string()) }).passthrough()),
  summary: z.object({}).passthrough(),
}).passthrough() });


export function responseContract(path) {
  const route = path.split('?')[0];
  if (['/auth/me', '/auth/login'].includes(route)) return [authResponseSchema, null];
  if (route === '/ref/bootstrap') return [bootstrapResponseSchema, null];
  if (route === '/reseaux/identifier') return [sourceIdentificationSchema, null];
  if (route === '/reseaux/recherche') return [sourceRechercheSchema, { items: [] }];
  if (/^\/reseaux\/\d+\/identifiants$/.test(route)) return [sourceIdentifiantsResultSchema, { item: null }];
  if (route === '/reseaux-sociaux') return [reseauxSociauxListSchema, null];
  if (route === '/reseaux-sociaux/stats') return [reseauxSociauxStatsSchema, { item: null }];
  if (route === '/reseaux-sociaux/lot') return [compteSocialBatchResultSchema, { item: { created: 0, ids: [], errors: [] } }];
  if (route === '/reseaux-sociaux/fusion') return [compteSocialMergeResultSchema, null];
  if (/^\/reseaux-sociaux\/\d+\/historique$/.test(route)) return [compteSocialHistoryListSchema, { items: [], total: 0 }];
  if (/\/reseaux-sociaux\/\d+\/(?:restaurer|controle)$/.test(route)) return [compteSocialActionResultSchema, { item: null }];
  if (/^\/reseaux-sociaux\/\d+$/.test(route)) return [compteSocialItemSchema, { item: null }];
  if (route === '/photos/paires') return [photoPairsSchema, { items: [] }];
  if (route === '/setup/status') return [z.object({ referentielTerritorialVide: z.boolean() }).passthrough(), null];
  if (route === '/anomalies') return [anomalyListSchema, emptyAnomalyList];
  if (route === '/veille/elements') return [veilleElementListSchema, { items: [], total: 0, page: 1, pageSize: 25 }];
  if (route === '/veille/status') return [veilleStatusSchema, { item: { activee: false, a_qualifier: 0, retenus: 0, rejetes: 0 } }];
  if (/^\/veille\/elements\/\d+$/.test(route)) return [z.object({ item: veilleElementSchema }), { item: null }];
  if (/^\/veille\/(?:lexique|alias|apprentissages)$/.test(route)) return [items, { items: [] }];
  if (route === '/anomalies/map') return [anomalyMapSchema, { items: [], total: 0, missing: 0 }];
  if (route === '/syntheses/catalogue') return [syntheseCatalogueSchema, emptySyntheseCatalogue];
  if (route === '/syntheses/charte') return [syntheseCharteSchema, null];
  if (route === '/syntheses/numero') return [syntheseNumeroSchema, null];
  if (/^\/syntheses\/sources(?:\/\d+)?$/.test(route)) return [syntheseSourceListSchema, null];
  if (route === '/syntheses/modeles') return [syntheseModelListSchema, { items: [] }];
  if (/^\/syntheses\/modeles\/\d+$/.test(route)) return [z.object({ item: syntheseModelSchema }), { item: null }];
  if (route === '/syntheses/editions') return [syntheseEditionListSchema, { items: [] }];
  if (/^\/syntheses\/editions\/\d+$/.test(route)) return [z.object({ item: syntheseEditionSchema }), { item: null }];
  if (route === '/views') return [items, { items: [] }];
  if (route === '/work') return [z.object({ item: z.object({ total: z.number().nonnegative(), items: z.array(z.object({}).passthrough()).default([]), alertes: z.object({}).passthrough().default({}) }).passthrough() }), { item: { total: 0, items: [], alertes: {} } }];
  if (/^\/anomalies\/\d+$/.test(route)) return [z.object({ item: anomalyResponseSchema }), { item: null }];
  if (route === '/stats/group') return [z.object({ item: z.object({ rows: z.array(z.object({ id: z.union([z.number(), z.string()]).nullable(), total: z.number() }).passthrough()), totals: z.object({}).passthrough() }).passthrough() }), { item: { rows: [], totals: {} } }];
  if (/\/(?:historique|pieces|activite|timeline|nearby|client-errors)$/.test(route) || route === '/users') return [items, { items: [] }];
  return [z.object({}).passthrough(), {}];
}
