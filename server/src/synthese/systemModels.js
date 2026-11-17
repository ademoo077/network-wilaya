/**
 * Modèles système V8 (§ 8).
 *
 * Semés au démarrage de façon idempotente : un modèle système est mis à jour
 * par sa clé `cle_systeme` sans jamais toucher aux copies (clé nulle). Les
 * requêtes utilisent `periode.mode = 'herite'` : une édition injecte sa propre
 * plage au moment du calcul, ce qui garantit que la période choisie pilote
 * tous les blocs.
 */
import { CATALOGUE, validerDefinition } from '@anm/shared';

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
    description: 'Géolocalisation, confirmation et vérification des fiches enregistrées.',
    definition: {
      schema_version: 1,
      sections: [
        section('kpi', [
          bloc('kpi-qualite', 'kpi', 'Indicateurs qualité', q(['taux_geolocalisation', 'taux_gps_confirme', 'taux_confirmation'])),
        ]),
        section('verification', [
          bloc('tab-verification', 'tableau', 'État de vérification', q(['recues'], [{ champ: 'verification' }])),
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
];

/** Vérifie une fois pour toutes que les définitions livrées sont exploitables. */
for (const model of SYSTEM_MODELS) validerDefinition(model.definition);

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

/** Sème ou met à jour les 8 modèles système. Idempotent. */
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
