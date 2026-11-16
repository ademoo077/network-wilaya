import { z } from 'zod';
import { DEFAULT_PARAMS, PLATEFORMES, ROLES, STATUTS, VERIFICATIONS } from './constants.js';

const reference = z.object({ id: z.number(), name_fr: z.string().nullable().optional(), name_ar: z.string().nullable().optional() }).passthrough();
const user = z.object({ id: z.number(), username: z.string(), full_name: z.string(), role: z.enum(ROLES), must_change_password: z.number().optional() }).passthrough();
export const authResponseSchema = z.object({ user, csrf: z.string().min(1) });
export const bootstrapResponseSchema = z.object({
  domaines: z.array(reference.extend({ types: z.array(reference).default([]) })).default([]),
  dairas: z.array(reference.extend({ communes: z.array(reference).default([]) })).default([]),
  epics: z.array(reference).default([]), agents: z.array(reference).default([]),
  parametres: z.record(z.union([z.string(), z.number()])).default(DEFAULT_PARAMS),
  taxonomie: z.object({ domaines: z.number(), types: z.number(), ok: z.boolean() }).optional(),
}).transform((value) => ({ ...value, parametres: { ...DEFAULT_PARAMS, ...value.parametres } }));
export const emptyRefs = { domaines: [], dairas: [], epics: [], agents: [], parametres: DEFAULT_PARAMS, taxonomie: {} };
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

export function responseContract(path) {
  const route = path.split('?')[0];
  if (['/auth/me', '/auth/login'].includes(route)) return [authResponseSchema, null];
  if (route === '/ref/bootstrap') return [bootstrapResponseSchema, null];
  if (route === '/setup/status') return [z.object({ referentielTerritorialVide: z.boolean() }).passthrough(), null];
  if (route === '/anomalies') return [anomalyListSchema, emptyAnomalyList];
  if (route === '/veille/elements') return [veilleElementListSchema, { items: [], total: 0, page: 1, pageSize: 25 }];
  if (route === '/veille/status') return [veilleStatusSchema, { item: { activee: false, a_qualifier: 0, retenus: 0, rejetes: 0 } }];
  if (/^\/veille\/elements\/\d+$/.test(route)) return [z.object({ item: veilleElementSchema }), { item: null }];
  if (/^\/veille\/(?:lexique|alias|apprentissages)$/.test(route)) return [items, { items: [] }];
  if (route === '/anomalies/map') return [anomalyMapSchema, { items: [], total: 0, missing: 0 }];
  if (route === '/syntheses/catalogue') return [syntheseCatalogueSchema, emptySyntheseCatalogue];
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
