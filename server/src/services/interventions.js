import { normalize, interventionWorkflowSchema, readInterventionWorkflow } from '@anm/shared';

export function withWorkflow(row) {
  if (!row) return row;
  const { workflow_json, ...epic } = row;
  return { ...epic, workflow: readInterventionWorkflow(workflow_json) };
}

/** Rattache les missions aux référentiels existants, sans créer de territoire. */
export function importInterventions(db, source, mapping, { commit = false } = {}) {
  const epics = db.prepare('SELECT * FROM epics').all();
  const domains = db.prepare('SELECT id,name_ar FROM domaines').all();
  const types = db.prepare('SELECT id,domaine_id,name_ar FROM types_anomalie').all();
  const plans = mapping.flatMap((entry) => {
    const original = source['المؤسسات']?.find((item) => item['المؤسسة'] === entry.source);
    if (!original) throw new Error(`Missions introuvables : ${entry.source}`);
    const regles = entry.regles.map(({ domaines, types: names = [], ...rule }) => {
      const domaine_ids = domaines.map((name) => {
        const found = domains.find((domain) => domain.name_ar === name);
        if (!found) throw new Error(`Catégorie inconnue : ${name}`);
        return found.id;
      });
      const type_ids = names.flatMap((name) => {
        const found = types.filter((type) => domaine_ids.includes(type.domaine_id) && type.name_ar === name);
        if (!found.length) throw new Error(`Type inconnu : ${name}`);
        return found.map((type) => type.id);
      });
      return { ...rule, domaine_ids, type_ids };
    });
    const workflow = interventionWorkflowSchema.parse({ missions: original['المهام'], perimetres: original['مجال_التدخل'],
      dairas: entry.dairas, coordination: entry.coordination, regles });
    return entry.epics.map((name) => {
      const epic = epics.find((item) => normalize(item.name) === normalize(name));
      if (!epic) throw new Error(`Intervenant à importer au préalable : ${name}`);
      return { id: epic.id, name: epic.name, workflow, existing: Boolean(epic.workflow_json) };
    });
  });
  if (commit) db.transaction(() => {
    const update = db.prepare("UPDATE epics SET workflow_json=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND workflow_json IS NULL");
    const attach = db.prepare('INSERT OR IGNORE INTO epic_domaines(epic_id,domaine_id) VALUES (?,?)');
    for (const plan of plans.filter((item) => !item.existing)) {
      update.run(JSON.stringify(plan.workflow), plan.id);
      for (const rule of plan.workflow.regles) for (const id of rule.domaine_ids) attach.run(plan.id, id);
    }
  })();
  return { total: plans.length, nouveaux: plans.filter((item) => !item.existing).length, existants: plans.filter((item) => item.existing).length, committed: commit };
}
