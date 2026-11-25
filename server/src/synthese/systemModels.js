/**
 * Modèles système V8 (§ 8).
 *
 * Semés au démarrage de façon idempotente : un modèle système est mis à jour
 * par sa clé `cle_systeme` sans jamais toucher aux copies (clé nulle). Les
 * requêtes utilisent `periode.mode = 'herite'` : une édition injecte sa propre
 * plage au moment du calcul, ce qui garantit que la période choisie pilote
 * tous les blocs.
 */
import { CATALOGUE, convertirEnFlux, validerDefinition } from '@anm/shared';

const MAX_PERIODE = { mode: 'herite' };

function q(mesures, dimensions = [], extra = {}) {
  return {
    dataset: 'anomalies',
    mesures: mesures.map((id) => ({ id })),
    dimensions,
    filtres: [],
    periode: MAX_PERIODE,
    totaux: true,
    ...extra,
  };
}

function bloc(id, type, titre, requete, options) {
  const value = { id, type };
  if (titre) value.titre = titre;
  if (requete) value.requete = requete;
  if (options) value.options = options;
  return value;
}

function section(id, ...colonnes) {
  return { id, colonnes };
}

function gabaritMeta(structure) {
  return { gabarit: true, formats: ['a5', 'a4'], structure };
}

/** Catalogue exposé par l’API pour la galerie : 8 modèles stables et documentés. */
export const SYSTEM_MODELS = [
  {
    cle: 'hebdomadaire',
    nom: 'Synthèse hebdomadaire standard',
    description: 'Modèle du rapport hebdomadaire historique : indicateurs clés, répartition par statut et tableau par daïra.',
    definition: {
      schema_version: 1,
      sections: [
        section('executif', [
          bloc('kpi-executif', 'kpi', 'Indicateurs clés', q(['recues', 'traitees_periode', 'cohorte_non_traitees', 'taux_traitement']), { largeur: 'pleine' }),
        ]),
        section('statuts', [
          bloc('anneau-statuts', 'anneau', 'Répartition des statuts', q(['recues'], [{ champ: 'statut' }]), { largeur: 'simple' }),
        ]),
        section('territoire', [
          bloc('tab-daira', 'tableau', 'Par daïra', q(['recues', 'cohorte_non_traitees'], [{ champ: 'daira' }]), { largeur: 'double', avec_graphique: true }),
        ]),
      ],
      // V15 : flux canonique. Le KPI occupe une ligne, puis 4 + 8 sur la même ligne.
      layout: {
        schema_version: 2,
        colonnes: 12,
        widgets: [
          { id: 'kpi-executif', ordre: 0, largeur: 12, hauteur: 'auto' },
          { id: 'anneau-statuts', ordre: 1, largeur: 4, hauteur: 'auto' },
          { id: 'tab-daira', ordre: 2, largeur: 8, hauteur: 'auto' },
        ],
      },
    },
  },
  {
    cle: 'note-executive',
    nom: 'Note exécutive',
    description: 'Synthèse courte pour décideurs : quatre indicateurs puis les types d’anomalie les plus fréquents.',
    definition: {
      schema_version: 1,
      sections: [
        section('kpi', [
          bloc('kpi-note', 'kpi', 'Chiffres clés', q(['recues', 'traitees_periode', 'cohorte_non_traitees', 'taux_traitement'])),
        ]),
        section('types', [
          bloc('tab-types', 'tableau', 'Types les plus fréquents', q(['recues'], [{ champ: 'type' }])),
        ]),
      ],
    },
  },
  {
    cle: 'rapport-daira',
    nom: 'Rapport par daïra',
    description: 'Lecture territoriale : une ligne par daïra puis une ligne par commune.',
    definition: {
      schema_version: 1,
      sections: [
        section('daira', [
          bloc('tab-daira', 'tableau', 'Synthèse par daïra', q(['recues', 'cohorte_non_traitees'], [{ champ: 'daira' }])),
        ]),
        section('commune', [
          bloc('tab-commune', 'tableau', 'Synthèse par commune', q(['recues', 'cohorte_non_traitees'], [{ champ: 'commune' }])),
        ]),
      ],
    },
  },
  {
    cle: 'performance-epic',
    nom: 'Performance des EPIC',
    description: 'Volumes, délais et respect du SLA par établissement public.',
    definition: {
      schema_version: 1,
      sections: [
        section('epic', [
          bloc('tab-epic', 'tableau', 'Performance par EPIC', q(['recues', 'traitees_periode', 'delai_moyen', 'taux_sla'], [{ champ: 'epic' }])),
        ]),
      ],
    },
  },
  {
    cle: 'bilan-mensuel',
    nom: 'Bilan mensuel',
    description: 'Tendance hebdomadaire des signalements et Pareto des types sur le mois.',
    definition: {
      schema_version: 1,
      sections: [
        section('tendance', [
          bloc('courbe-signalement', 'courbe', 'Évolution des signalements', q(['recues'], [{ champ: 'signalement', granularite: 'semaine' }])),
        ]),
        section('pareto', [
          bloc('pareto-types', 'pareto', 'Pareto des types', q(['recues'], [{ champ: 'type' }])),
        ]),
      ],
    },
  },
  {
    cle: 'veille-citoyenne',
    nom: 'Veille citoyenne',
    description: 'Note d’information sur le dispositif de veille citoyenne. Les indicateurs de veille seront activés dans un lot ultérieur.',
    definition: {
      schema_version: 1,
      sections: [
        section('note', [
          bloc('note-veille', 'texte', 'Veille citoyenne', undefined, {
            texte_fr: 'Le dispositif de veille citoyenne collecte et trie les publications des plateformes. Les indicateurs détaillés seront publiés dans une prochaine édition.',
            texte_ar: 'يجمع جهاز اليقظة المواطنية المنشورات من المنصات ويفرزها. ستنشر المؤشرات التفصيلية في إصدار قادم.',
          }),
        ]),
      ],
    },
  },
  {
    cle: 'qualite-donnees',
    nom: 'Qualité des données',
    description: 'Géolocalisation, confirmation et classement des fiches enregistrées.',
    definition: {
      schema_version: 1,
      sections: [
        section('kpi', [
          bloc('kpi-qualite', 'kpi', 'Indicateurs qualité', q(['taux_geolocalisation', 'taux_gps_confirme', 'taux_confirmation'])),
        ]),
        section('verification', [
          bloc('tab-verification', 'tableau', 'État du classement', q(['recues'], [{ champ: 'verification' }])),
        ]),
      ],
    },
  },
  {
    cle: 'points-noirs',
    nom: 'Points noirs récurrents',
    description: 'Communes et daïras les plus touchées, avec le volume de signalements récurrents.',
    definition: {
      schema_version: 1,
      sections: [
        section('commune', [
          bloc('tab-commune-noirs', 'tableau', 'Communes les plus touchées', q(['recues', 'nb_recurrents'], [{ champ: 'commune' }])),
        ]),
        section('daira', [
          bloc('tab-daira-noirs', 'tableau', 'Daïras les plus touchées', q(['recues'], [{ champ: 'daira' }])),
        ]),
      ],
    },
  },
  {
    cle: 'v19-note-hebdo',
    nom: 'Note de synthèse hebdomadaire',
    description: 'Gabarit Cabinet du Wali : objet, résumé exécutif, situation, analyse, risques, recommandations et signature.',
    definition: {
      schema_version: 1,
      meta: gabaritMeta(['Objet', 'Résumé exécutif', 'Situation', 'Analyse', 'Difficultés et risques', 'Recommandations', 'Annexes', 'Signature']),
      sections: [
        section('objet', [bloc('v19h-objet', 'texte', 'Objet', null, { texte_fr: 'Objet à préciser', texte_ar: 'الموضوع' })]),
        section('resume', [bloc('v19h-resume', 'texte', 'Résumé exécutif', null, { texte_fr: 'Points clés à renseigner', texte_ar: 'النقاط الرئيسية' })]),
        section('situation', [bloc('v19h-kpi', 'kpi', 'Chiffres clés', q(['recues', 'traitees_periode', 'cohorte_non_traitees', 'taux_traitement']))]),
        section('analyse', [bloc('v19h-tab-daira', 'tableau', 'Analyse par daïra', q(['recues', 'cohorte_non_traitees'], [{ champ: 'daira' }]))]),
        section('risques', [bloc('v19h-risques', 'texte', 'Difficultés et risques', null, { texte_fr: 'À renseigner', texte_ar: 'يُملأ' })]),
        section('recommandations', [bloc('v19h-reco', 'texte', 'Recommandations / décisions attendues', null, { texte_fr: 'À renseigner', texte_ar: 'يُملأ' })]),
        section('signature', [bloc('v19h-signature', 'signature', 'Signature')]),
      ],
    },
  },
  {
    cle: 'v19-point-situation',
    nom: 'Point de situation',
    description: 'Coup d’œil rapide sur la situation : indicateurs, répartition, évolution et message du Cabinet.',
    definition: {
      schema_version: 1,
      meta: gabaritMeta(['Chiffres clés', 'Répartition', 'Évolution', 'Message']),
      sections: [
        section('chiffres', [bloc('v19p-kpi', 'kpi', 'Indicateurs', q(['recues', 'cohorte_non_traitees', 'delai_moyen']))]),
        section('repartition', [bloc('v19p-anneau', 'anneau', 'Répartition des statuts', q(['recues'], [{ champ: 'statut' }]))]),
        section('evolution', [bloc('v19p-courbe', 'courbe', 'Évolution hebdomadaire', q(['recues'], [{ champ: 'signalement', granularite: 'semaine' }]))]),
        section('message', [bloc('v19p-message', 'texte', 'Message du Cabinet', null, { texte_fr: 'À renseigner', texte_ar: 'يُملأ' })]),
      ],
    },
  },
  {
    cle: 'v19-fiche-operation',
    nom: 'Fiche technique d’opération',
    description: 'Tuiles de chiffres, répartition et barres par daïra/commune, sur le modèle des fiches d’opération.',
    definition: {
      schema_version: 1,
      meta: gabaritMeta(['Tuiles', 'Répartition', 'Barres par daïra', 'Barres par commune', 'Notes']),
      sections: [
        section('tuiles', [bloc('v19o-kpi', 'kpi', 'Chiffres de l’opération', q(['recues', 'traitees_periode', 'taux_traitement']))]),
        section('repartition', [bloc('v19o-anneau', 'anneau', 'Répartition', q(['recues'], [{ champ: 'statut' }]))]),
        section('daira', [bloc('v19o-barres-daira', 'barres', 'Par daïra', q(['recues'], [{ champ: 'daira' }]))]),
        section('commune', [bloc('v19o-barres-commune', 'barres', 'Par commune', q(['recues'], [{ champ: 'commune' }]))]),
        section('notes', [bloc('v19o-notes', 'texte', 'Notes de bas de tableau', null, { texte_fr: 'Source et méthode à préciser', texte_ar: 'المصدر والطريقة' })]),
      ],
    },
  },
  {
    cle: 'v19-bilan-mensuel',
    nom: 'Bilan mensuel',
    description: 'Bilan mensuel du Cabinet : synthèse chiffrée, performance des EPIC et suivi des délais.',
    definition: {
      schema_version: 1,
      meta: gabaritMeta(['Synthèse', 'Chiffres clés', 'Performance EPIC', 'Délais', 'Décisions']),
      sections: [
        section('synthese', [bloc('v19m-texte', 'texte', 'Synthèse du mois', null, { texte_fr: 'À renseigner', texte_ar: 'يُملأ' })]),
        section('chiffres', [bloc('v19m-kpi', 'kpi', 'Chiffres clés', q(['recues', 'traitees_periode', 'taux_traitement']))]),
        section('epic', [bloc('v19m-epic', 'tableau', 'Performance par EPIC', q(['recues', 'traitees_periode', 'delai_moyen'], [{ champ: 'epic' }]))]),
        section('delais', [bloc('v19m-courbe', 'courbe', 'Évolution des délais', q(['delai_moyen'], [{ champ: 'signalement', granularite: 'semaine' }]))]),
        section('decisions', [bloc('v19m-decisions', 'texte', 'Décisions attendues', null, { texte_fr: 'À renseigner', texte_ar: 'يُملأ' })]),
      ],
    },
  },
  {
    cle: 'v19-instructions-wali',
    nom: 'Suivi des instructions du Wali',
    description: 'Instruction, échéance, responsable et avancement : gabarit.textuel à compléter et à mettre à jour.',
    definition: {
      schema_version: 1,
      meta: gabaritMeta(['Instructions', 'Avancement', 'Alertes', 'Décisions']),
      sections: [
        section('instructions', [bloc('v19i-liste', 'texte', 'Instructions et responsables', null, { texte_fr: 'Instruction · échéance · responsable', texte_ar: 'التعليمات · الأجل · المسؤول' })]),
        section('avancement', [bloc('v19i-kpi', 'kpi', 'Avancement', q(['recues', 'traitees_periode', 'taux_traitement']))]),
        section('alertes', [bloc('v19i-alertes', 'tableau', 'Échéances et alertes', q(['recues', 'cohorte_non_traitees'], [{ champ: 'epic' }]))]),
        section('decisions', [bloc('v19i-decisions', 'texte', 'Décisions du Cabinet', null, { texte_fr: 'À renseigner', texte_ar: 'يُملأ' })]),
      ],
    },
  },
  {
    cle: 'v19-fiche-evenement',
    nom: 'Fiche d’événement',
    description: 'Fiche compacte pour un événement : contexte, faits, chiffres, enseignements et diffusion.',
    definition: {
      schema_version: 1,
      meta: gabaritMeta(['Contexte', 'Faits', 'Chiffres', 'Enseignements', 'Diffusion']),
      sections: [
        section('contexte', [bloc('v19e-objet', 'texte', 'Contexte', null, { texte_fr: 'À renseigner', texte_ar: 'يُملأ' })]),
        section('faits', [bloc('v19e-faits', 'chronologie', 'Faits marquants', q(['recues'], [{ champ: 'signalement', granularite: 'semaine' }]))]),
        section('chiffres', [bloc('v19e-kpi', 'kpi', 'Chiffres', q(['recues', 'traitees_periode', 'delai_moyen']))]),
        section('enseignements', [bloc('v19e-notes', 'texte', 'Enseignements', null, { texte_fr: 'À renseigner', texte_ar: 'يُملأ' })]),
        section('diffusion', [bloc('v19e-signature', 'signature', 'Visa et diffusion')]),
      ],
    },
  },
];

/**
 * V15 : le flux est dérivé des sections, sauf quand le modèle fournit déjà son
 * layout (Synthèse hebdomadaire standard). Les sections restent la source
 * sémantique ; aucun snapshot d'édition n'est réécrit.
 */
for (const model of SYSTEM_MODELS) {
  model.definition = { ...model.definition, layout: convertirEnFlux(model.definition) };
  validerDefinition(model.definition);
}

const UPSERT = `INSERT INTO syntheses_modeles
  (nom, description, proprietaire_id, portee, definition_json, schema_version, version, cle_systeme)
  VALUES (?, ?, NULL, 'systeme', ?, 1, 1, ?)
  ON CONFLICT(cle_systeme) DO UPDATE SET
    nom = excluded.nom,
    description = excluded.description,
    definition_json = excluded.definition_json,
    version = syntheses_modeles.version + 1,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
  WHERE syntheses_modeles.nom <> excluded.nom
     OR syntheses_modeles.definition_json <> excluded.definition_json
     OR syntheses_modeles.description IS NOT excluded.description`;

/** Sème ou met à jour les modèles système (8 historiques + 6 gabarits V19). Idempotent. */
export function ensureSystemModels(db) {
  const upsert = db.prepare(UPSERT);
  const transaction = db.transaction(() => {
    for (const model of SYSTEM_MODELS) {
      upsert.run(model.nom, model.description, JSON.stringify(model.definition), model.cle);
    }
  });
  transaction();
  return SYSTEM_MODELS.length;
}

export const SYSTEM_MODELS_VERSION = CATALOGUE.version;
