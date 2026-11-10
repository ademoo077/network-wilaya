import { z } from 'zod';
import { territoryKey } from './territory.js';

const text = z.string().trim().min(1).max(1000);
const ids = z.array(z.number().int().positive()).max(200);
export const interventionWorkflowSchema = z.object({
  missions: z.array(text).max(50).default([]),
  perimetres: z.array(text).max(30).default([]),
  dairas: z.array(z.string().trim().min(1).max(200)).max(100).default([]),
  coordination: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
  regles: z.array(z.object({
    domaine_ids: ids, type_ids: ids.default([]),
    note_fr: z.string().trim().max(1000).default(''), note_ar: z.string().trim().max(1000).default(''),
    conditionnelle: z.boolean().default(false),
  })).max(100).default([]),
});

export function readInterventionWorkflow(value) {
  try { return interventionWorkflowSchema.safeParse(typeof value === 'string' ? JSON.parse(value) : value).data ?? null; }
  catch { return null; }
}

const includesId = (ids, id) => (ids ?? []).some((value) => String(value) === String(id));

/** Aide à l'affectation : classe les choix, sans affecter ni interdire une fiche. */
export function interventionCandidates(refs, values = {}) {
  const daira = refs.dairas?.find((item) => String(item.id) === String(values.daira_id));
  const names = [daira?.name_ar, daira?.name_fr].filter(Boolean).map(territoryKey);
  return (refs.epics ?? []).map((epic) => {
    const workflow = epic.workflow;
    const competent = includesId(epic.domaine_ids, values.domaine_id);
    const restricted = Boolean(workflow?.dairas?.length);
    const outside = restricted && names.length > 0 && !workflow.dairas.some((name) => names.includes(territoryKey(name)));
    const rules = (workflow?.regles ?? []).filter((rule) => includesId(rule.domaine_ids, values.domaine_id));
    const matching = rules.filter((rule) => !rule.type_ids.length || !values.type_id || includesId(rule.type_ids, values.type_id));
    const typeMismatch = rules.length > 0 && matching.length === 0;
    const conditional = (restricted && names.length === 0) || matching.some((rule) => rule.conditionnelle);
    const proposed = competent && !outside && !typeMismatch && Number(epic.actif) !== 0;
    const state = outside ? 'outside' : !proposed ? 'other' : conditional ? 'conditional' : 'recommended';
    return { epic, state, proposed, notes: matching, score: proposed ? conditional ? 1 : 2 : 0 };
  }).sort((a, b) => b.score - a.score || a.epic.name.localeCompare(b.epic.name));
}
