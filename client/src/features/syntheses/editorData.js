import { api } from '../../api/client.js';

const EVAL_BATCH = 20;

export function flattenBlocs(definition) {
  const blocs = [];
  for (const section of definition?.sections || []) {
    for (const colonne of section.colonnes || []) {
      for (const bloc of colonne || []) blocs.push({ section: section.id, ...bloc });
    }
  }
  return blocs;
}

export function cloneDefinition(value) {
  return JSON.parse(JSON.stringify(value));
}

export function blocPositions(definition) {
  const positions = [];
  for (const section of definition?.sections || []) {
    for (const colonne of section.colonnes || []) {
      for (let index = 0; index < colonne.length; index += 1) positions.push({ colonne, index });
    }
  }
  return positions;
}

export function specsOf(definition) {
  return flattenBlocs(definition).filter((bloc) => bloc.requete)
    .map((bloc) => ({ ...bloc.requete, _blocId: bloc.id }));
}

export async function evaluerSpecs(specs, { periode = null } = {}) {
  const results = {};
  for (let index = 0; index < specs.length; index += EVAL_BATCH) {
    const batch = specs.slice(index, index + EVAL_BATCH);
    const { items } = await api('/syntheses/evaluer', {
      method: 'POST',
      body: { requetes: batch.map(({ _blocId, ...spec }) => (
        periode && (!spec.periode || spec.periode.mode === 'herite') ? { ...spec, periode } : spec
      )) },
    });
    if (!Array.isArray(items) || items.length !== batch.length) throw new Error('Réponse d’évaluation incomplète');
    for (const [offset, item] of items.entries()) results[batch[offset]._blocId] = item;
  }
  return results;
}
