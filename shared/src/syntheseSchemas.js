/**
 * Schémas zod V8 : spécification de requête et définition de modèle.
 *
 * Toute valeur venant du client est validée ici avant d’atteindre le
 * compilateur SQL : ids, opérateurs, granularités et tris sont des listes
 * blanches issues du catalogue. Aucun fragment SQL n’est accepté.
 */
import { z } from 'zod';
import { dateString } from './schemas.js';
import {
  CATALOGUE, DIMENSION_IDS, FILTER_IDS, GRANULARITE_IDS, MEASURE_IDS, OP_IDS,
  findDimension, measureCompatible,
} from './catalogue.js';
import { GRILLE_COLONNES, GRILLE_HAUTEUR } from './layout.js';
import { validerStyleBloc } from './widgetStyle.js';

const dimensionId = z.preprocess(
  (value) => (typeof value === 'string' ? value.replace(/^t\./, '') : value),
  z.enum(DIMENSION_IDS),
);

export const dimensionRefSchema = z.object({
  champ: dimensionId,
  granularite: z.enum(GRANULARITE_IDS).optional(),
}).strict();

export const mesureRefSchema = z.object({
  id: z.enum(MEASURE_IDS),
  alias: z.string().trim().min(1).max(80).optional(),
  format: z.enum(CATALOGUE.formats_ids).optional(),
}).strict();

export const filtreRefSchema = z.object({
  champ: z.enum(FILTER_IDS),
  op: z.enum(OP_IDS),
  valeur: z.any(),
}).strict();

export const periodeSchema = z.object({
  mode: z.enum(['herite', 'semaine', 'mois', 'plage', 'glissant']),
  debut: dateString.optional(),
  fin: dateString.optional(),
  jours: z.number().int().min(1).max(3660).optional(),
}).strict();

const triSchema = z.object({
  champ: z.string().trim().min(1).max(80),
  dir: z.enum(['asc', 'desc']),
}).strict();

const pivotSchema = z.object({
  lignes: z.array(dimensionRefSchema).max(3),
  colonnes: z.array(dimensionRefSchema).max(2),
  valeurs: z.array(mesureRefSchema).min(1).max(3),
}).strict();

const BASE_TEMPS = ['signalement', 'traitement', 'verification', 'intervention', 'publication'];
const COMPARAISONS = ['aucune', 'periode_precedente', 'meme_periode_n-1', 'moyenne_4', 'periode_libre'];

export const requeteSchema = z.object({
  dataset: z.enum(['anomalies']).optional(),
  mesures: z.array(mesureRefSchema).min(1).max(24),
  dimensions: z.array(dimensionRefSchema).max(3).optional(),
  filtres: z.array(filtreRefSchema).max(30).optional(),
  periode: periodeSchema.optional(),
  base_temps: z.enum(BASE_TEMPS).optional(),
  statut_mode: z.enum(['actuel', 'fin_periode']).optional(),
  comparaison: z.enum(COMPARAISONS).optional(),
  comparaison_debut: dateString.optional(),
  comparaison_fin: dateString.optional(),
  tri: z.array(triSchema).max(5).optional(),
  limite: z.number().int().min(1).max(5000).nullable().optional(),
  regrouper_autres: z.boolean().optional(),
  totaux: z.boolean().optional(),
  inclure_infirmees: z.boolean().optional(),
  inclure_supprimees: z.boolean().optional(),
  pivot: pivotSchema.optional(),
}).strict();

function isScalar(value) {
  return ['string', 'number', 'boolean'].includes(typeof value);
}

function describeFilterError(filtre, message) {
  return `Filtre « ${filtre.champ} » (${filtre.op}) : ${message}`;
}

function validateFilterValue(filtre, ctx) {
  const meta = CATALOGUE.filtres[filtre.champ];
  if (!meta) return;
  if (!meta.ops.includes(filtre.op)) {
    ctx.addIssue({ code: 'custom', message: `Opérateur « ${filtre.op} » interdit pour le filtre « ${filtre.champ} »` });
    return;
  }
  const value = filtre.valeur;
  if (filtre.op === 'is_null') {
    if (typeof value !== 'boolean') ctx.addIssue({ code: 'custom', message: describeFilterError(filtre, 'valeur booléenne attendue') });
    return;
  }
  if (filtre.op === 'in' || filtre.op === 'not_in') {
    if (!Array.isArray(value) || value.length === 0 || value.length > 200 || !value.every(isScalar)) {
      ctx.addIssue({ code: 'custom', message: describeFilterError(filtre, 'liste de 1 à 200 valeurs attendue') });
    }
    return;
  }
  if (filtre.op === 'between') {
    if (!Array.isArray(value) || value.length !== 2 || !value.every(isScalar)) {
      ctx.addIssue({ code: 'custom', message: describeFilterError(filtre, 'deux bornes attendues') });
    }
    return;
  }
  if (filtre.op === 'contains') {
    if (typeof value !== 'string' || value.trim().length === 0 || value.length > 200) {
      ctx.addIssue({ code: 'custom', message: describeFilterError(filtre, 'texte de 1 à 200 caractères attendu') });
    }
    return;
  }
  if (filtre.op === 'eq' || filtre.op === 'gt' || filtre.op === 'gte' || filtre.op === 'lt' || filtre.op === 'lte') {
    if (meta.valueType === 'date') {
      if (!dateString.safeParse(value).success) {
        ctx.addIssue({ code: 'custom', message: describeFilterError(filtre, 'date AAAA-MM-JJ attendue') });
      }
      return;
    }
    if (meta.valueType === 'bool') {
      if (typeof value !== 'boolean') ctx.addIssue({ code: 'custom', message: describeFilterError(filtre, 'booléen attendu') });
      return;
    }
    if (!isScalar(value)) ctx.addIssue({ code: 'custom', message: describeFilterError(filtre, 'valeur scalaire attendue') });
  }
}

export const requeteSchemaStrict = requeteSchema.superRefine((spec, ctx) => {
  const measures = new Set();
  const aliases = new Set();
  for (const mesure of spec.mesures || []) {
    if (measures.has(mesure.id)) ctx.addIssue({ code: 'custom', message: `Mesure « ${mesure.id} » présente deux fois` });
    measures.add(mesure.id);
    const alias = mesure.alias || mesure.id;
    if (aliases.has(alias)) ctx.addIssue({ code: 'custom', message: `Alias « ${alias} » présent deux fois` });
    aliases.add(alias);
  }

  const dimensions = new Set();
  for (const dimension of spec.dimensions || []) {
    const meta = findDimension(dimension.champ);
    if (!meta) continue;
    if (dimensions.has(meta.id)) ctx.addIssue({ code: 'custom', message: `Dimension « ${meta.id} » présente deux fois` });
    dimensions.add(meta.id);
    if (meta.kind === 'time') {
      if (!dimension.granularite) ctx.addIssue({ code: 'custom', message: `Granularité requise pour la dimension « ${meta.id} »` });
    } else if (dimension.granularite) {
      ctx.addIssue({ code: 'custom', message: `Granularité interdite pour la dimension « ${meta.id} »` });
    }
  }

  for (const mesure of spec.mesures || []) {
    for (const dimension of spec.dimensions || []) {
      if (!measureCompatible(mesure.id, dimension.champ)) {
        ctx.addIssue({
          code: 'custom',
          message: `La mesure « ${mesure.id} » n’est pas compatible avec la dimension « ${dimension.champ} »`,
        });
      }
    }
  }

  for (const filtre of spec.filtres || []) validateFilterValue(filtre, ctx);

  if (spec.comparaison === 'periode_libre' && (!spec.comparaison_debut || !spec.comparaison_fin)) {
    ctx.addIssue({ code: 'custom', message: 'La comparaison libre exige une date de début et une date de fin' });
  }

  const fields = new Set([
    ...(spec.mesures || []).map((m) => m.id),
    ...(spec.dimensions || []).map((d) => String(d.champ).replace(/^t\./, '')),
  ]);
  for (const tri of spec.tri || []) {
    if (!fields.has(tri.champ)) {
      ctx.addIssue({ code: 'custom', message: `Tri « ${tri.champ} » absent des mesures et dimensions sélectionnées` });
    }
  }
});

export const BLOC_TYPES = [
  'kpi', 'tableau', 'barres', 'lignes', 'anneau', 'courbe', 'aire', 'pareto',
  'histogramme', 'cascade', 'carte_thermique', 'radar', 'nuage', 'treemap',
  'entonnoir', 'texte', 'liste_fiches', 'classement', 'chronologie',
  'separateur', 'signature', 'legende', 'annexe', 'avant_apres', 'registre',
];

/** Blocs de mise en page : ils n’exécutent aucune requête. */
export const BLOCS_SANS_REQUETE = ['texte', 'separateur', 'signature', 'legende', 'annexe', 'registre'];

export const syntheseBlocSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]{1,64}$/, 'Identifiant de bloc invalide'),
  type: z.enum(BLOC_TYPES),
  titre: z.string().max(200).optional(),
  requete: requeteSchemaStrict.optional(),
  options: z.record(z.any()).optional(),
}).strict().superRefine((bloc, ctx) => {
  if (!BLOCS_SANS_REQUETE.includes(bloc.type) && !bloc.requete) {
    ctx.addIssue({
      code: 'custom',
      path: ['requete'],
      message: `Le bloc « ${bloc.type} » exige une requête`,
    });
  }
});

/** Alias V8.2 : un « widget » de synthèse est exactement un bloc V8. */
export const syntheseWidgetSchema = syntheseBlocSchema;

export const syntheseSectionSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]{1,64}$/, 'Identifiant de section invalide'),
  titre: z.string().max(200).optional(),
  colonnes: z.array(z.array(syntheseBlocSchema).max(60)).max(12),
}).strict();

export const syntheseLayoutWidgetSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]{1,64}$/, 'Identifiant de widget invalide'),
  x: z.number().int().min(0).max(GRILLE_COLONNES - 1),
  y: z.number().int().min(0).max(400),
  w: z.number().int().min(1).max(GRILLE_COLONNES),
  h: z.number().int().min(1).max(40),
  saut_page: z.boolean().optional(),
}).strict().superRefine((widget, ctx) => {
  if (widget.x + widget.w > GRILLE_COLONNES) {
    ctx.addIssue({ code: 'custom', path: ['w'], message: 'Le widget dépasse les 12 colonnes' });
  }
});

export const syntheseLayoutV1Schema = z.object({
  schema_version: z.literal(1),
  colonnes: z.literal(GRILLE_COLONNES).optional(),
  hauteur_ligne: z.literal(GRILLE_HAUTEUR).optional(),
  compactage: z.boolean().optional(),
  widgets: z.array(syntheseLayoutWidgetSchema).max(60),
}).strict();

/** V15 — flux à largeurs en colonnes. L'ordre du tableau est l'ordre de lecture. */
export const syntheseLayoutFluxWidgetSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]{1,64}$/, 'Identifiant de widget invalide'),
  ordre: z.number().int().min(0).max(60),
  largeur: z.union([
    z.literal(3), z.literal(4), z.literal(6), z.literal(8), z.literal(9), z.literal(12),
  ]),
  hauteur: z.union([
    z.literal('auto'),
    z.object({ min: z.number().int().min(1).max(40), max: z.number().int().min(1).max(40) }).strict().refine(
      (value) => value.max >= value.min, { message: 'La hauteur maximale doit dépasser la minimale' },
    ),
  ]),
  saut_page: z.boolean().optional(),
}).strict();

export const syntheseLayoutFluxSchema = z.object({
  schema_version: z.literal(2),
  colonnes: z.literal(12).optional(),
  widgets: z.array(syntheseLayoutFluxWidgetSchema).max(60),
}).strict();

export const syntheseLayoutSchema = z.union([syntheseLayoutV1Schema, syntheseLayoutFluxSchema]);

export const syntheseDefinitionMetaSchema = z.object({
  gabarit: z.boolean().optional(),
  formats: z.array(z.enum(['a5', 'a4', 'a3', 'letter'])).max(4).optional(),
  structure: z.array(z.string().max(80)).max(12).optional(),
}).strict();

export const syntheseDefinitionSchema = z.object({
  schema_version: z.literal(1),
  sections: z.array(syntheseSectionSchema).max(60),
  layout: syntheseLayoutSchema.optional(),
  meta: syntheseDefinitionMetaSchema.optional(),
}).strict();

/** Corps de création/mise à jour d’un modèle. Les modèles système ne sont pas créés par l’API. */
export const syntheseModelePayloadSchema = z.object({
  nom: z.string().trim().min(1, 'Nom requis').max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  portee: z.enum(['prive', 'equipe']).optional(),
  definition: syntheseDefinitionSchema,
  version: z.number().int().min(1).optional(),
}).strict();

/** Valide et normalise une requête ; lève une Error lisible en cas de refus. */
export function validerRequete(spec, options = {}) {
  const result = requeteSchemaStrict.safeParse(spec);
  if (!result.success) {
    const first = result.error.issues[0];
    const error = new Error(first?.message || 'Requête invalide');
    error.code = 'SYNTHESE_REQUETE_INVALIDE';
    error.fields = { requete: first?.path?.join('.') || '' };
    throw error;
  }
  if (result.data.inclure_supprimees && options.allowDeleted !== true) {
    const error = new Error('La consultation des fiches supprimées est réservée à l’administration');
    error.code = 'SYNTHESE_PERMISSION';
    throw error;
  }
  return result.data;
}

/** Valide une définition de modèle (≤ 60 blocs, requêtes incluses). */
export function validerDefinition(definition) {
  const result = syntheseDefinitionSchema.safeParse(definition);
  if (!result.success) {
    const first = result.error.issues[0];
    const error = new Error(first?.message || 'Définition de modèle invalide');
    error.code = 'SYNTHESE_DEFINITION_INVALIDE';
    error.fields = { definition: first?.path?.join('.') || '' };
    throw error;
  }
  const blocs = result.data.sections.reduce((n, section) => n + section.colonnes.reduce((m, col) => m + col.length, 0), 0);
  if (blocs > 60) {
    const error = new Error('Un modèle est limité à 60 blocs');
    error.code = 'SYNTHESE_DEFINITION_INVALIDE';
    throw error;
  }
  if (result.data.layout) {
    // Style de bloc : alignement, densité et accent (valeurs fermées, catalogue V11).
  for (const section of result.data.sections) {
    for (const colonne of section.colonnes) {
      for (const bloc of colonne) {
        try {
          validerStyleBloc(bloc);
        } catch (error) {
          const erreur = new Error(error.message);
          erreur.code = 'SYNTHESE_DEFINITION_INVALIDE';
          erreur.fields = { definition: 'style' };
          throw erreur;
        }
      }
    }
  }
  const ids = new Set();
    for (const section of result.data.sections) {
      for (const colonne of section.colonnes) {
        for (const bloc of colonne) {
          if (ids.has(bloc.id)) {
            const error = new Error(`Bloc « ${bloc.id} » présent deux fois`);
            error.code = 'SYNTHESE_DEFINITION_INVALIDE';
            error.fields = { definition: 'sections' };
            throw error;
          }
          ids.add(bloc.id);
        }
      }
    }
    for (const widget of result.data.layout.widgets) {
      if (!ids.has(widget.id)) {
        const error = new Error(`Widget « ${widget.id} » absent des blocs`);
        error.code = 'SYNTHESE_DEFINITION_INVALIDE';
        error.fields = { definition: 'layout' };
        throw error;
      }
    }
  }
  return result.data;
}
