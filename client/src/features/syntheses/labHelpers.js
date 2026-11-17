import {
  CATALOGUE, addDays, isDateString, measureCompatible, todayAlgiers,
} from '@anm/shared';

export const MAX_MESURES = 4;
export const MAX_DIMENSIONS = 3;
export const MAX_FILTRES = 30;

const COMPARAISONS = ['aucune', 'periode_precedente', 'meme_periode_n-1', 'moyenne_4', 'periode_libre'];
const PERIODES = ['semaine', 'mois', 'glissant', 'plage'];

/** Libellé d’une entrée du catalogue, avec repli sûr si la traduction manque. */
export function catalogueLabel(item, lang) {
  if (!item) return '—';
  return lang === 'ar'
    ? (item.label_ar || item.label_fr || item.id || '—')
    : (item.label_fr || item.label_ar || item.id || '—');
}

function refName(item, lang) {
  if (!item) return '—';
  if (item.full_name) return item.full_name;
  return lang === 'ar'
    ? (item.name_ar || item.name_fr || '—')
    : (item.name_fr || item.name_ar || '—');
}

export function createDefaultDraft(weekRange = null) {
  const today = todayAlgiers();
  return {
    mesures: [{ id: 'recues' }],
    dimensions: [],
    filtres: [],
    periode: weekRange
      ? { mode: 'plage', debut: weekRange.debut, fin: weekRange.fin }
      : { mode: 'glissant', jours: 30, debut: addDays(today, -29), fin: today },
    comparaison: 'aucune',
    comparaison_debut: weekRange ? addDays(weekRange.debut, -30) : addDays(today, -59),
    comparaison_fin: weekRange ? addDays(weekRange.debut, -1) : addDays(today, -30),
    statut_mode: 'actuel',
    limite: '',
    regrouper_autres: true,
    totaux: true,
    inclure_infirmees: false,
  };
}

export function filterInitialValue(meta, op) {
  if (op === 'is_null') return true;
  if (op === 'in' || op === 'not_in') return [];
  if (op === 'between') return ['', ''];
  if (meta?.valueType === 'bool') return true;
  return '';
}

export function createFilterDraft(champ) {
  const meta = CATALOGUE.filtres[champ];
  const op = meta?.ops[0] || 'in';
  return { champ, op, value: filterInitialValue(meta, op) };
}

function scalarValue(valueType, value) {
  if (valueType === 'id') {
    const number = Number(value);
    return Number.isFinite(number) ? number : value;
  }
  if (valueType === 'bool') return value === true || value === 1 || value === '1' || value === 'true';
  return typeof value === 'string' ? value.trim() : value;
}

function filterValuePayload(meta, filtre) {
  if (filtre.op === 'is_null') return Boolean(filtre.value);
  if (filtre.op === 'in' || filtre.op === 'not_in') {
    const values = Array.isArray(filtre.value) ? filtre.value : [filtre.value];
    return values.filter((value) => value !== '' && value !== null && value !== undefined)
      .map((value) => scalarValue(meta.valueType, value));
  }
  if (filtre.op === 'between') {
    return (Array.isArray(filtre.value) ? filtre.value : [filtre.value])
      .map((value) => String(value ?? '').trim());
  }
  if (filtre.op === 'contains') return String(filtre.value ?? '').trim();
  return scalarValue(meta.valueType, filtre.value);
}

function buildPeriode(periode) {
  if (periode.mode === 'glissant') return { mode: 'glissant', jours: Number(periode.jours) };
  if (periode.mode === 'plage') return { mode: 'plage', debut: periode.debut, fin: periode.fin };
  return { mode: periode.mode };
}

/** Construit une requête V8 sans jamais accepter de SQL libre. */
export function buildRequete(draft) {
  const mesures = draft.mesures.map((mesure) => {
    const out = { id: mesure.id };
    if (mesure.alias?.trim()) out.alias = mesure.alias.trim();
    if (mesure.format && CATALOGUE.formats_ids.includes(mesure.format)) out.format = mesure.format;
    return out;
  });
  const dimensions = draft.dimensions.map((dimension) => {
    const meta = CATALOGUE.dimensions[dimension.champ];
    const out = { champ: dimension.champ };
    if (meta?.kind === 'time') out.granularite = dimension.granularite || 'jour';
    return out;
  });
  const filtres = draft.filtres.map((filtre) => {
    const meta = CATALOGUE.filtres[filtre.champ];
    return meta
      ? { champ: filtre.champ, op: filtre.op, valeur: filterValuePayload(meta, filtre) }
      : null;
  }).filter(Boolean);

  const requete = {
    dataset: 'anomalies',
    mesures,
    dimensions,
    filtres,
    periode: buildPeriode(draft.periode),
    statut_mode: draft.statut_mode,
    comparaison: draft.comparaison,
    limite: draft.limite === '' || draft.limite === null || draft.limite === undefined
      ? null
      : Number(draft.limite),
    regrouper_autres: Boolean(draft.regrouper_autres),
    totaux: Boolean(draft.totaux),
    inclure_infirmees: Boolean(draft.inclure_infirmees),
  };
  if (draft.comparaison === 'periode_libre') {
    requete.comparaison_debut = draft.comparaison_debut;
    requete.comparaison_fin = draft.comparaison_fin;
  }
  return requete;
}

function draftFilter(filtre) {
  const meta = CATALOGUE.filtres[filtre.champ];
  const op = meta?.ops.includes(filtre.op) ? filtre.op : meta?.ops[0] || filtre.op;
  let value = filtre.valeur;
  if (op === 'in' || op === 'not_in') {
    value = Array.isArray(value)
      ? value.map((item) => String(item))
      : value === null || value === undefined || value === '' ? [] : [String(value)];
  } else if (op === 'between') {
    value = Array.isArray(value) ? value.map((item) => String(item ?? '')) : ['', ''];
  } else if (op === 'is_null') {
    value = value !== false;
  } else if (meta?.valueType === 'bool') {
    value = value === true || value === 1 || value === '1' || value === 'true';
  } else {
    value = value === null || value === undefined ? '' : String(value);
  }
  return { champ: filtre.champ, op, value };
}

/** Transforme une requête de modèle en brouillon éditable par le Laboratoire. */
export function draftFromRequete(requete) {
  const base = createDefaultDraft();
  const periode = { ...base.periode, ...(requete?.periode || {}) };
  if (!PERIODES.includes(periode.mode)) periode.mode = periode.debut && periode.fin ? 'plage' : 'glissant';
  if (periode.mode === 'glissant' && !Number.isFinite(Number(periode.jours))) periode.jours = 30;
  return {
    ...base,
    mesures: (requete?.mesures || []).map((mesure) => ({
      id: mesure.id,
      alias: mesure.alias || '',
      format: mesure.format || '',
    })),
    dimensions: (requete?.dimensions || []).map((dimension) => {
      const meta = CATALOGUE.dimensions[dimension.champ];
      return {
        champ: dimension.champ,
        granularite: meta?.kind === 'time' ? (dimension.granularite || 'jour') : undefined,
      };
    }),
    filtres: (requete?.filtres || []).map(draftFilter),
    periode,
    comparaison: COMPARAISONS.includes(requete?.comparaison) ? requete.comparaison : 'aucune',
    comparaison_debut: requete?.comparaison_debut || base.comparaison_debut,
    comparaison_fin: requete?.comparaison_fin || base.comparaison_fin,
    statut_mode: requete?.statut_mode === 'fin_periode' ? 'fin_periode' : 'actuel',
    limite: requete?.limite === null || requete?.limite === undefined ? '' : String(requete.limite),
    regrouper_autres: requete?.regrouper_autres !== false,
    totaux: requete?.totaux !== false,
    inclure_infirmees: requete?.inclure_infirmees === true,
  };
}

/** Première requête d’une définition de modèle (le Laboratoire édite un bloc à la fois). */
export function firstRequete(modele) {
  for (const section of modele?.definition?.sections || []) {
    for (const colonne of section.colonnes || []) {
      for (const bloc of colonne || []) {
        if (bloc?.requete) return bloc.requete;
      }
    }
  }
  return null;
}

function filterError(label, t) {
  return t('lab.validationFilter', { label });
}

/** Validation lisible côté client ; le serveur revalide de toute façon. */
export function validateDraft(draft, t) {
  const errors = [];
  const measures = draft.mesures.filter((mesure) => mesure?.id);
  if (!measures.length || measures.length !== draft.mesures.length) errors.push(t('lab.validationMesure'));
  if (draft.mesures.length > MAX_MESURES) errors.push(t('lab.maxMeasures'));
  const measureIds = new Set();
  for (const mesure of measures) {
    if (!CATALOGUE.mesures[mesure.id]) errors.push(t('lab.validationMesureInconnue', { id: mesure.id }));
    if (measureIds.has(mesure.id)) errors.push(t('lab.validationMesureDuplicate', { id: mesure.id }));
    measureIds.add(mesure.id);
  }

  const dimensions = draft.dimensions.filter((dimension) => dimension?.champ);
  if (draft.dimensions.some((dimension) => !dimension?.champ)) errors.push(t('lab.validationDimension'));
  if (draft.dimensions.length > MAX_DIMENSIONS) errors.push(t('lab.maxDimensions'));
  const dimensionIds = new Set();
  for (const dimension of dimensions) {
    const meta = CATALOGUE.dimensions[dimension.champ];
    if (!meta) errors.push(t('lab.validationDimensionInconnue', { id: dimension.champ }));
    if (dimensionIds.has(dimension.champ)) errors.push(t('lab.validationDimensionDuplicate', { id: dimension.champ }));
    dimensionIds.add(dimension.champ);
    if (meta?.kind === 'time' && !CATALOGUE.granularites[dimension.granularite]) {
      errors.push(t('lab.validationGranularity', { label: catalogueLabel(meta, 'fr') }));
    }
  }
  for (const mesure of measures) {
    for (const dimension of dimensions) {
      if (CATALOGUE.mesures[mesure.id] && CATALOGUE.dimensions[dimension.champ] && !measureCompatible(mesure.id, dimension.champ)) {
        errors.push(t('lab.validationCompatibility', {
          mesure: catalogueLabel(CATALOGUE.mesures[mesure.id], 'fr'),
          dimension: catalogueLabel(CATALOGUE.dimensions[dimension.champ], 'fr'),
        }));
      }
    }
  }

  const periode = draft.periode || {};
  if (!PERIODES.includes(periode.mode)) errors.push(t('lab.validationPeriod'));
  if (periode.mode === 'glissant') {
    const jours = Number(periode.jours);
    if (!Number.isInteger(jours) || jours < 1 || jours > 3660) errors.push(t('lab.validationPeriodDays'));
  }
  if (periode.mode === 'plage') {
    if (!isDateString(periode.debut) || !isDateString(periode.fin)) errors.push(t('lab.validationPeriod'));
    else if (periode.debut > periode.fin) errors.push(t('lab.validationPeriodOrder'));
  }

  if (!COMPARAISONS.includes(draft.comparaison)) errors.push(t('lab.validationComparison'));
  if (draft.comparaison === 'periode_libre') {
    if (!isDateString(draft.comparaison_debut) || !isDateString(draft.comparaison_fin)) errors.push(t('lab.validationComparison'));
    else if (draft.comparaison_debut > draft.comparaison_fin) errors.push(t('lab.validationComparisonOrder'));
  }

  if (draft.limite !== '' && draft.limite !== null && draft.limite !== undefined) {
    const limite = Number(draft.limite);
    if (!Number.isInteger(limite) || limite < 1 || limite > 5000) errors.push(t('lab.validationLimit'));
  }
  if (!['actuel', 'fin_periode'].includes(draft.statut_mode)) errors.push(t('lab.validationStatusMode'));

  if (draft.filtres.length > MAX_FILTRES) errors.push(t('lab.validationFilterCount', { count: MAX_FILTRES }));
  for (const filtre of draft.filtres) {
    const meta = CATALOGUE.filtres[filtre.champ];
    if (!meta) {
      errors.push(t('lab.validationFilterUnknown', { id: filtre.champ }));
      continue;
    }
    const label = catalogueLabel(meta, 'fr');
    if (!meta.ops.includes(filtre.op)) {
      errors.push(filterError(label, t));
      continue;
    }
    const value = filtre.value;
    if (filtre.op === 'is_null') {
      if (typeof value !== 'boolean') errors.push(filterError(label, t));
      continue;
    }
    if (filtre.op === 'in' || filtre.op === 'not_in') {
      const values = Array.isArray(value) ? value : [];
      if (!values.length || values.length > 200 || values.some((item) => item === '' || item === null || item === undefined)) {
        errors.push(filterError(label, t));
      }
      continue;
    }
    if (filtre.op === 'between') {
      if (!Array.isArray(value) || value.length !== 2 || !value.every(isDateString)) errors.push(filterError(label, t));
      continue;
    }
    if (filtre.op === 'contains') {
      if (typeof value !== 'string' || !value.trim() || value.length > 200) errors.push(filterError(label, t));
      continue;
    }
    if (meta.valueType === 'date') {
      if (!isDateString(value)) errors.push(t('lab.validationFilterDate', { label }));
    } else if (meta.valueType === 'bool') {
      if (typeof value !== 'boolean') errors.push(filterError(label, t));
    } else if (value === '' || value === null || value === undefined) {
      errors.push(filterError(label, t));
    }
  }

  return [...new Set(errors)];
}

function uniqueRefs(entries) {
  const seen = new Set();
  return entries.filter(({ item }) => {
    const key = String(item?.id ?? '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Options de filtres construites depuis les référentiels déjà chargés par l’application. */
export function filterConfigsFromRefs(refs, lang, t) {
  const entries = {
    domaine: (refs.domaines || []).map((item) => ({ item })),
    type: (refs.domaines || []).flatMap((parent) => (parent.types || []).map((item) => ({ item, parent }))),
    daira: (refs.dairas || []).map((item) => ({ item })),
    commune: (refs.dairas || []).flatMap((parent) => (parent.communes || []).map((item) => ({ item, parent }))),
    epic: (refs.epics || []).map((item) => ({ item })),
    agent: (refs.agents || []).map((item) => ({ item })),
  };

  return Object.values(CATALOGUE.filtres).map((meta) => {
    let options = [];
    if (meta.valueType === 'id') {
      options = uniqueRefs(entries[meta.id] || []).map(({ item, parent }) => ({
        value: String(item.id),
        label: parent ? `${refName(parent, lang)} › ${refName(item, lang)}` : refName(item, lang),
      }));
    } else if (meta.valueType === 'enum') {
      options = (meta.valeurs || []).map((valeur) => ({
        value: String(valeur.id),
        label: catalogueLabel(valeur, lang),
      }));
    } else if (meta.valueType === 'bool') {
      options = [
        { value: 'true', label: t('common.yes') },
        { value: 'false', label: t('common.no') },
      ];
    }
    return { ...meta, label: catalogueLabel(meta, lang), options };
  });
}
