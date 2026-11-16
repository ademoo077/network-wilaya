# AUDIT V8 — Laboratoire de synthèses et page Synthèse

**Périmètre** : V8 (moteur, catalogue, visualisations, Lab) puis V8.2 (widgets et tableaux au choix **dans la synthèse**).
**Règle** : un constat n’est clos que s’il est corrigé **et** couvert par un test. Ce qui reste ouvert est listé en fin de fichier avec sa cause.

---

## 1. Constats sur l’ancienne page `#/rapport?semaine=` (R1–R7)

| # | Constat visuel | Cause réelle dans le code | État |
|---|---|---|---|
| R1 | Anneau sans total central, sans légende ni valeurs ; une seule couleur sur une semaine creuse | `ReportPage` construit un `PieChart` ad hoc (`pieData`) sans `Label` central, sans `Legend` et sans filtre des parts nulles | **Ouvert** — sera remplacé par le bloc `anneau` V8 |
| R2 | Diagramme en barres sans titre, légende ni étiquettes ; graduations `0 · 0,25 · 0,5` | `BarChart` avec `<XAxis type="number" />` sans `allowDecimals={false}` ni `LabelList` | **Ouvert** — le bloc `barres` V8 impose des axes entiers pour les comptages |
| R3 | `0.0 %` avec un point en français ; « Non traitée » au singulier sous un total | `(taux * 100).toFixed(1)` puis concaténation `' %'` ; libellés de statut au singulier | **Ouvert** — `shared/format.js` (virgule + espace fine) doit être la seule source |
| R4 | Variation `(+1)` sans libellé ni sens | `evolution_stock` affiché brut dans un KPI | **Ouvert** — variation ▲▼ avec sens favorable à porter dans le bloc KPI |
| R5 | Aucune indication de base de calcul (cohorte, statut à la date, population) | `report.kpis` est pré-calculé sans exposer `meta` de mesure | **Ouvert** — ⓘ + annexe méthodologique par bloc |
| R6 | Ni comparaison, ni objectif, ni analyse des délais/SLA/âge du stock | La page figée n’offre aucun sélecteur ; le moteur V8 sait le faire | **Ouvert** — widgets et filtres V8.2 |
| R7 | Aucun choix de mesures, dimensions ou filtres | Page figée, un seul jeu de blocs pour tous | **Ouvert** — mode Personnaliser V8.2 |

## 2. État réel livré (vérifié)

- **Catalogue** : `shared/src/catalogue.js` — 38 mesures, 30 dimensions, 30 filtres, 6 granularités, formats, FR + AR + descriptions. Version `8.0.0`.
- **Moteur** : `server/src/synthese/` — compilation SQL paramétrée depuis listes blanches, mesures non additives par requêtes dédiées, totaux et « Autres » dédiés, comparaison, comblement des périodes, cache `data_version`, évaluation par lot (1–20). Tests d’injection et de cohérence présents.
- **Schémas** : `requeteSchemaStrict`, `syntheseDefinitionSchema` (sections → colonnes → blocs), `syntheseWidgetSchema` (alias), plafonds 60 blocs / 4 mesures / 3 dimensions. **Extension V8.2** : un bloc de mise en page (`texte`, `separateur`, `signature`, `legende`, `annexe`) n’exige plus de `requete` ; un bloc de données l’exige encore.
- **Narration** : `shared/src/describe.js` — `describeRequete`, `describeFiltres`, `describeFiltre` en FR/AR, testés (5 tests).
- **Modèles système** : 8 modèles validés, semés de façon idempotente par `prepareDatabase()` (prod + navigateur), sans écraser les copies ; suppression refusée par trigger SQL.
- **Lab** : `#/laboratoire` (constructeur, évaluation par lot, modèles) opérationnel ; 4 tests Playwright verts.
- **Bibliothèque de visualisations** : **partielle** — KPI, tableau, anneau/barres/courbes dans `LabResults`, pas encore les 35 widgets prêts ni le rendu d’impression par bloc.

## 3. Décisions de la phase 1 V8.2

1. **Aucun second moteur** : la page Synthèse et les widgets réutilisent `evaluateSynthese` et le catalogue ; `decrire()` ne fait que formuler des libellés.
2. **Widget = bloc V8** : `syntheseWidgetSchema` est un alias strict de `syntheseBlocSchema` ; la définition du modèle reste `sections[].colonnes[][]`.
3. **Modèles système** : semés au démarrage (idempotent par `cle_systeme`), jamais modifiables par l’API, duplicables. Le semis n’a pas lieu dans `freshDatabase()` pour ne pas modifier les attentes des tests unitaires existants ; il est couvert par `server/tests/syntheses-systeme.test.js`.
4. **Blocs texte** : autorisés sans requête, ce qui permet la note de veille et le commentaire du rédacteur sans détourner une mesure.
5. **`#/rapport?semaine=`** reste servi par la page actuelle tant que la page Synthèse V8.2 n’est pas livrée : aucune régression V4–V8.

## 4. Reste à faire (phases 2 à 7 V8.2)

- **Phase 2** : mode Personnaliser (sections/colonnes, DnD clavier, inspecteur, copy-on-write, autosave, annuler/rétablir, pagination).
- **Phase 3** : assistant 3 étapes + galerie ≥ 35 widgets + visuel recommandé.
- **Phase 4** : widgets tableau agrégé et liste de fiches, impression paginée avec en-têtes répétés.
- **Phase 5** : filtres globaux/propres, légendes, ⓘ, annexe méthodologique, « Voir les fiches ».
- **Phase 6** : éditions figées, exports PDF A4/A3/Excel/CSV, bibliothèque de widgets favoris.
- **Phase 7** : recette 85–96, captures FR/AR × clair/sombre, README.
