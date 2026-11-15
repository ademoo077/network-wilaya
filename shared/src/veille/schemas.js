import { z } from 'zod';

export const VEILLE_STATUTS = ['nouveau', 'a_qualifier', 'retenu', 'rejete', 'doublon', 'ignore'];
export const VEILLE_CONFIANCES = ['haute', 'moyenne', 'basse'];
export const VEILLE_SOURCE_TYPES = [
  'facebook_page_geree', 'facebook_page_publique', 'capture_assistee', 'rss', 'google_news',
  'youtube', 'instagram', 'telegram', 'import',
];

export const veilleQuerySchema = z.object({
  statut: z.enum(VEILLE_STATUTS).optional(),
  q: z.string().trim().max(200).optional(),
  groupe: z.coerce.number().int().positive().optional(),
  domaine: z.coerce.number().int().positive().optional(),
  commune: z.coerce.number().int().positive().optional(),
  priorite: z.enum(['normale', 'haute', 'urgente']).optional(),
  langue: z.enum(['ar', 'fr', 'mix']).optional(),
  confiance: z.enum(VEILLE_CONFIANCES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
}).passthrough();

export const veilleAnalyseSchema = z.object({
  texte: z.string().trim().min(3, 'Texte trop court').max(10000),
  url: z.string().trim().max(2000).optional().nullable(),
});

export const veilleDecisionSchema = z.object({
  raison: z.string().trim().max(500).optional(),
  commentaire: z.string().trim().max(1000).optional(),
});

export const veilleLexiquePatchSchema = z.object({
  poids: z.coerce.number().int().min(-5).max(5).optional(),
  actif: z.coerce.number().int().min(0).max(1).optional(),
  groupe_id: z.coerce.number().int().positive().nullable().optional(),
  domaine_id: z.coerce.number().int().positive().nullable().optional(),
  type_id: z.coerce.number().int().positive().nullable().optional(),
});

export const veilleAliasSchema = z.object({
  alias: z.string().trim().min(2).max(120),
  commune_id: z.coerce.number().int().positive().nullable().optional(),
  daira_id: z.coerce.number().int().positive().nullable().optional(),
  actif: z.coerce.number().int().min(0).max(1).default(1),
});

export const veilleSourceSchema = z.object({
  type: z.enum(VEILLE_SOURCE_TYPES),
  nom: z.string().trim().min(2).max(200),
  actif: z.coerce.number().int().min(0).max(1).default(1),
  frequence_min: z.coerce.number().int().min(5).max(10080).default(30),
  config: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  config_chiffree: z.string().max(20000).optional(),
});

export const veilleCaptureSchema = z.object({
  url: z.string().trim().max(2000).optional().nullable(),
  page_nom: z.string().trim().max(200).optional().nullable(),
  texte: z.string().trim().min(3).max(10000),
  date_publication: z.string().trim().max(40).optional().nullable(),
  type_media: z.string().trim().max(30).optional().nullable(),
  metriques: z.object({ reactions: z.number().optional(), commentaires: z.number().optional(), partages: z.number().optional() }).optional(),
  gps: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).optional().nullable(),
});
