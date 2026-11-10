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

export function responseContract(path) {
  const route = path.split('?')[0];
  if (['/auth/me', '/auth/login'].includes(route)) return [authResponseSchema, null];
  if (route === '/ref/bootstrap') return [bootstrapResponseSchema, null];
  if (route === '/setup/status') return [z.object({ referentielTerritorialVide: z.boolean() }).passthrough(), null];
  if (route === '/anomalies') return [anomalyListSchema, emptyAnomalyList];
  if (route === '/anomalies/map') return [anomalyMapSchema, { items: [], total: 0, missing: 0 }];
  if (route === '/views') return [items, { items: [] }];
  if (route === '/work') return [z.object({ item: z.object({ total: z.number().nonnegative(), items: z.array(z.object({}).passthrough()).default([]), alertes: z.object({}).passthrough().default({}) }).passthrough() }), { item: { total: 0, items: [], alertes: {} } }];
  if (/^\/anomalies\/\d+$/.test(route)) return [z.object({ item: anomalyResponseSchema }), { item: null }];
  if (route === '/stats/group') return [z.object({ item: z.object({ rows: z.array(z.object({ id: z.union([z.number(), z.string()]).nullable(), total: z.number() }).passthrough()), totals: z.object({}).passthrough() }).passthrough() }), { item: { rows: [], totals: {} } }];
  if (/\/(?:historique|pieces|activite|timeline|nearby|client-errors)$/.test(route) || route === '/users') return [items, { items: [] }];
  return [z.object({}).passthrough(), {}];
}
