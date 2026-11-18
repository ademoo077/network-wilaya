import { CATALOGUE } from './catalogue.js';

/** Maximum de KPI dans un bloc */
export const KPI_MAX_ITEMS = 24;

/** Préréglages de KPI disponibles */
export const KPI_PRESETS = {
  essentiel: [
    { id: 'recues', mesure: 'recues', comparaison: 'periode_precedente', ordre: 0 },
    { id: 'traitees', mesure: 'traitees_periode', comparaison: 'periode_precedente', ordre: 1 },
    { id: 'taux_traitement', mesure: 'taux_traitement', comparaison: 'periode_precedente', ordre: 2 },
    { id: 'stock_fin', mesure: 'stock_fin', comparaison: 'periode_precedente', ordre: 3 },
    { id: 'delai_moyen', mesure: 'delai_moyen', comparaison: 'periode_precedente', ordre: 4 },
    { id: 'taux_sla', mesure: 'taux_sla', comparaison: 'periode_precedente', ordre: 5 },
  ],
  pilotage: [
    { id: 'recues', mesure: 'recues', comparaison: 'periode_precedente', ordre: 0 },
    { id: 'traitees', mesure: 'traitees_periode', comparaison: 'periode_precedente', ordre: 1 },
    { id: 'taux_traitement', mesure: 'taux_traitement', comparaison: 'periode_precedente', ordre: 2 },
    { id: 'stock_fin', mesure: 'stock_fin', comparaison: 'periode_precedente', ordre: 3 },
    { id: 'variation_stock', mesure: 'variation_stock', comparaison: 'periode_precedente', ordre: 4 },
    { id: 'delai_moyen', mesure: 'delai_moyen', comparaison: 'periode_precedente', ordre: 5 },
    { id: 'delai_median', mesure: 'delai_median', comparaison: 'periode_precedente', ordre: 6 },
    { id: 'delai_p90', mesure: 'delai_p90', comparaison: 'periode_precedente', ordre: 7 },
    { id: 'taux_sla', mesure: 'taux_sla', comparaison: 'periode_precedente', ordre: 8 },
    { id: 'age_moyen_stock', mesure: 'age_moyen_stock', comparaison: 'periode_precedente', ordre: 9 },
    { id: 'en_retard', mesure: 'en_retard', comparaison: 'periode_precedente', ordre: 10 },
    { id: 'urgentes_ouvertes', mesure: 'urgentes_ouvertes', comparaison: 'periode_precedente', ordre: 11 },
  ],
  delais: [
    { id: 'delai_moyen', mesure: 'delai_moyen', comparaison: 'periode_precedente', ordre: 0 },
    { id: 'delai_median', mesure: 'delai_median', comparaison: 'periode_precedente', ordre: 1 },
    { id: 'delai_p90', mesure: 'delai_p90', comparaison: 'periode_precedente', ordre: 2 },
    { id: 'delai_min', mesure: 'delai_min', comparaison: 'periode_precedente', ordre: 3 },
    { id: 'delai_max', mesure: 'delai_max', comparaison: 'periode_precedente', ordre: 4 },
    { id: 'taux_sla', mesure: 'taux_sla', comparaison: 'periode_precedente', ordre: 5 },
    { id: 'nb_hors_sla', mesure: 'nb_hors_sla', comparaison: 'periode_precedente', ordre: 6 },
  ],
  qualite: [
    { id: 'taux_confirmation', mesure: 'taux_confirmation', comparaison: 'periode_precedente', ordre: 0 },
    { id: 'taux_infirmation', mesure: 'taux_infirmation', comparaison: 'periode_precedente', ordre: 1 },
    { id: 'taux_geolocalisation', mesure: 'taux_geolocalisation', comparaison: 'periode_precedente', ordre: 2 },
    { id: 'taux_gps_confirme', mesure: 'taux_gps_confirme', comparaison: 'periode_precedente', ordre: 3 },
    { id: 'delai_verification_moyen', mesure: 'delai_verification_moyen', comparaison: 'periode_precedente', ordre: 4 },
    { id: 'delai_intervention_moyen', mesure: 'delai_intervention_moyen', comparaison: 'periode_precedente', ordre: 5 },
    { id: 'nb_recurrents', mesure: 'nb_recurrents', comparaison: 'periode_precedente', ordre: 6 },
    { id: 'indice_recurrence', mesure: 'indice_recurrence', comparaison: 'periode_precedente', ordre: 7 },
  ],
  reseaux: [
    { id: 'recues', mesure: 'recues', comparaison: 'periode_precedente', ordre: 0, dataset: 'reseaux_sociaux' },
    { id: 'pages', mesure: 'recues', comparaison: 'periode_precedente', ordre: 1, dataset: 'reseaux_sociaux', filtres: [{ champ: 'type', op: 'eq', valeur: 'page' }] },
    { id: 'profils', mesure: 'recues', comparaison: 'periode_precedente', ordre: 2, dataset: 'reseaux_sociaux', filtres: [{ champ: 'type', op: 'eq', valeur: 'profil' }] },
    { id: 'communes_couvertes', mesure: 'nb_communes_touchees', comparaison: 'periode_precedente', ordre: 3, dataset: 'reseaux_sociaux' },
  ],
};

/** Extrait les KPI d'un bloc, en tolérant l'ancien format multi-mesures */
export function kpisDuBloc(bloc) {
  if (!bloc || !bloc.options?.kpis) {
    return (bloc?.requete?.mesures || []).map((m, i) => ({
      id: `kpi-${i}`,
      mesure: m.id,
      comparaison: bloc?.requete?.comparaison || 'aucune',
      ordre: i,
      ...(bloc?.requete?.periode ? { periode: bloc.requete.periode } : {}),
      ...(bloc?.requete?.filtres ? { filtres: bloc.requete.filtres } : {}),
    }));
  }
  return bloc.options.kpis || [];
}

/** Retourne les requêtes à évaluer pour un bloc KPI (une requête par KPI avec periode/comparaison spécifique) */
export function requetesDuBloc(bloc) {
  const base = bloc?.requete || {};
  const kpis = kpisDuBloc(bloc);
  
  // Si le bloc a ses propres options.kpis (nouveau mode KPI), chaque KPI obtient sa propre requête
  if (bloc?.options?.kpis) {
    return kpis.map((kpi) => ({
      key: kpi.id,
      requete: {
        ...base,
        mesures: [{ id: kpi.mesure }],
        comparaison: kpi.comparaison,
        periode: kpi.periode || base.periode,
        filtres: kpi.filtres || base.filtres,
      },
    }));
  }
  
  // Mode ancien multi-mesures : une seule requête avec toutes les mesures
  return [{
    key: 'kpi',
    requete: {
      ...base,
      mesures: kpis.map((kpi) => ({ id: kpi.mesure })),
    },
  }];
}

/** Valide un bloc KPI (jusqu'à 24 mesures, pas de doublons, mesures connues) */
export function validerKpisBloc(bloc) {
  const kpis = kpisDuBloc(bloc);
  if (kpis.length > KPI_MAX_ITEMS) {
    throw new Error(`Le bloc KPI ne peut pas dépasser ${KPI_MAX_ITEMS} mesures`);
  }
  const ids = new Set();
  for (const kpi of kpis) {
    if (ids.has(kpi.id)) {
      throw new Error(`Identifiant KPI « ${kpi.id} » présent deux fois`);
    }
    ids.add(kpi.id);
    if (!CATALOGUE.mesures[kpi.mesure]) {
      throw new Error(`Mesure inconnue : « ${kpi.mesure} »`);
    }
  }
  return bloc;
}

/** Crée les KPI d'un préréglage, en ajoutant les IDs manquants */
export function creerKpisPreset(key) {
  const preset = KPI_PRESETS[key];
  if (!preset) {
    throw new Error(`Préréglage KPI inconnu : « ${key} »`);
  }
  return preset.map((item) => ({ ...item }));
}