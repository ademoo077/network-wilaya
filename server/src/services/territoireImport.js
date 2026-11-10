import { territoireSchema, territoryKey } from '@anm/shared';
import { createRef, updateRef } from './refs.js';

function findExisting(rows, item) {
  const names = [item.name_fr, item.name_ar].map(territoryKey);
  const matches = rows.filter((row) => [row.name_fr, row.name_ar].filter(Boolean).some((value) => names.includes(territoryKey(value))));
  if (matches.length > 1) throw new Error(`Correspondance ambiguë : ${item.name_fr}`);
  return matches[0];
}

function changes(row, item) {
  if (!row) return { name_fr: item.name_fr, name_ar: item.name_ar };
  const swapped = territoryKey(row.name_fr) === territoryKey(item.name_ar)
    && (!row.name_ar || territoryKey(row.name_ar) === territoryKey(item.name_fr));
  if (swapped) return { name_fr: item.name_fr, name_ar: item.name_ar };
  return row.name_ar ? {} : { name_ar: item.name_ar };
}

const summarize = (plans) => ({ total: plans.length, created: plans.filter((row) => !row.existing).length,
  updated: plans.filter((row) => row.existing && Object.keys(row.patch).length).length,
  unchanged: plans.filter((row) => row.existing && !Object.keys(row.patch).length).length });

/** Import explicite et additif : identifiants, désactivations et libellés administrateur conservés. */
export function importTerritoire(db, source, { commit = false } = {}) {
  const rows = territoireSchema.parse(source);
  return db.transaction(() => {
    const dairas = db.prepare('SELECT * FROM dairas').all();
    const communes = db.prepare('SELECT * FROM communes').all();
    const plans = rows.map((item) => {
      const existing = findExisting(dairas, item);
      const children = item.communes.map((commune) => {
        const found = findExisting(communes, commune);
        if (found && found.daira_id !== existing?.id) throw new Error(`Rattachement à vérifier : ${commune.name_fr} → ${item.name_fr}`);
        return { existing: found, patch: changes(found, commune) };
      });
      return { existing, patch: changes(existing, item), children };
    });
    const result = { committed: commit, dairas: summarize(plans), communes: summarize(plans.flatMap((row) => row.children)) };
    if (commit) for (const plan of plans) {
      const daira = apply(db, 'dairas', plan);
      for (const child of plan.children) apply(db, 'communes', child, { daira_id: daira.id });
    }
    return result;
  })();
}

function apply(db, entity, plan, parent = {}) {
  if (!plan.existing) return createRef(db, entity, { ...plan.patch, ...parent });
  if (Object.keys(plan.patch).length) updateRef(db, entity, plan.existing.id, plan.patch);
  return plan.existing;
}
