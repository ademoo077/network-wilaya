# AUDIT V15 — Studio de synthèses : écran, galerie, impression

Date : 22/11/2026. Références : prompt V15, `docs/SPEC_V8.md`, `AUDIT_V9.md` à `AUDIT_V14.md`, `PLAN.md`, `DECISIONS.md`. Baseline : tag `avant-v15` sur `6b283f5`.

## 1. Méthode — mesurer, pas deviner

L’instrumentation est centralisée dans `tests/e2e/v15-instrumentation.js` :

- `createDiagnostic(page, testInfo, nom)` : attache un JSON de géométrie et une capture à chaque test, même en échec, et affiche le JSON dans le journal Playwright.
- `mesurerStudio()` : rectangles `x/y/largeur/hauteur`, `overflow` calculé, regroupement en lignes, trous verticaux, largeur minimale.
- `mesurerImpression()` : présence de la vue dédiée, nombre de pages, taux de remplissage, descendants `overflow:auto|scroll`, référence, hauteur de la période ; `compterPagesPdf()` compte les `/Type /Page` du PDF Chromium.
- `mesurerDonut()`, `mesurerTableau()`, `mesurerBarreOutils()`, `mesurerGalerie()` : contrats ciblés des constats S4–S9.

Les neuf tests rouges ont été exécutés dans un fichier temporaire `v15-phase1-red.spec.js` (supprimé après reproduction) puis remplacés par les scénarios de recette 192–201 verts. La numérotation du prompt (189–198) est décalée de +3 car 189–191 appartiennent déjà à V14.

## 2. Constats reproduits

| # | Mesure issue du rapport JSON | Cause confirmée | Correctif | Test de recette |
|---|---|---|---|---|
| S1 | `present:false`, `nombrePages:0`, vue `#/imprimer/:id` inexistante ; PDF d’une page blanche généré depuis la page d’écran | Aucune vue d’impression dédiée : `OfficialPrintDocument` enveloppe `SyntheseCanvas`/`StudioGrid`, dont les positions `y` successives font une ligne par widget | Route `#/imprimer/:id`, arbre statique, `paginer()`, CSS `@page` dédié | 196 |
| S2 | `present:false`, aucun conteneur mesurable ; en l’absence de vue statique, le navigateur imprime l’écran et ses conteneurs défilants | Réutilisation de la vue d’écran (`overflow` des tables et panneaux) | Vue d’impression sans contrôle ni conteneur défilant ; `overflow:visible` partout | 196 |
| S3 | `reference:""`, `referenceVide:true`, `periodeHauteur:0` | `PrintCustomizer.createPrintSettings()` initialise `reference:''` et le rendu affiche « — » ; la période n’a pas de contrainte `nowrap` | Référence `SYN-{AAAA}-S{SS}-v{V}` générée et stockée dans l’édition ; période sur une ligne | 196 |
| S4 | `dansAnneau:false`, `total:""`, `entrees:[]` | Le total est un nœud texte hors du SVG Recharts ; la légende est construite par le composant de graphique avec `ellipsis` | `<text>` central dans le SVG, légende dédiée sous l’anneau avec libellés complets | 194 |
| S5 | `entetes:["Fiches reçues","Non traitées (cohorte)"]` : la dimension `Daïra` manque ; tableau paginé à 2 lignes à l’écran | `colonnesAffichees()` place les mesures avant les dimensions ; `ROWS_PER_PAGE=12` et hauteur de carte fixe coupent le tableau | `[...dimensions, ...mesures]`, hauteur auto, toutes les lignes à l’impression, en-tête répété | 195 |
| S6 | Trois lignes successives (`y=337`, `645`, `1041`), largeurs `852/281/567`, `kpi:[3,1]`, trou maximal 4 px mais 60 % de la feuille vide à droite | `layout` x/y hérité de V10 : chaque widget occupe sa propre ligne ; aucune compaction en 4+8 ; KPI en `auto-fit` trop large | `regrouperEnLignes`, grille 12 colonnes, largeurs 4+8, `colonnesEquilibrees()` pour les KPI | 192 |
| S7 | `hauteur:127` (> 120), boutons « Édition » et « Imprimer » dans la barre globale **et** dans la carte | Barre historique `SyntheseCanvas` ajoutée à celle de `ReportPage`, sans refonte | Barre unique, menu **Affichage** libellé, retrait des doublons de la carte | 192 |
| S8 | `handles:[]`, `plusEtroit:281` (≥ 240 mais aucune poignée de bord), barre d’actions dans le flux du contenu | `StudioWidget` utilise des boutons de déplacement/resize dans `WidgetActionBar`, pas des poignées sur les bords ; la largeur dépend de `position.w` sans plancher explicite | Poignées `data-widget-handle="deplacement|largeur"` sur les bords, `min-width:240px`, actions regroupées dans ⋯ | 193 |
| S9 | `cartes:0` avec les contrats V15, `recherche:false`, `categories:[]` ; galerie actuelle = `GALERIE` brut, préfixe `visuel.slice(0,3).toUpperCase()` et `famille` en slug | Aucune fiche de widget enrichie : descriptions vides, familles non traduites, pas d’aperçu ni de filtre | Galerie basée sur `galeriePayload()` + `GALERIE_FAMILLES`, recherche FR/AR, aperçu, type, taille, navigation clavier | 199 |

## 3. Décisions et invariants

- Migration : **`017_flux_syntheses.sql`**, pas `013_flux.sql` demandé par le prompt : `013` à `016` sont appliquées et `AGENTS.md` interdit de renuméroter. Conversion testée sur copie, snapshots figés intouchés (décision dans `DECISIONS.md`).
- Modèle canonique : `{ordre, largeur ∈ {3,4,6,8,9,12}, hauteur:'auto'}` ; les `{x,y,w,h}` restent lisibles en compatibilité mais ne sont plus la source de vérité.
- Moteur de calcul, catalogues, chiffres et éditions figées inchangés : la réimpression part de `snapshot_json`.
- Aucune couleur en dur, aucun `overflow:auto` dans la vue d’impression, aucun widget < 240 px, aucun slug/abréviation visible, aucune liste déroulante sans libellé.

## 4. Suivi des phases

Les résumés de phase (5 lignes maximum) sont consignés dans `PLAN.md`, section « Résumés V15 ».

### Phase 2 — modèle de flux (vert)

- `shared/src/flux.js` : `regrouperEnLignes`, `convertirXyEnFlux`, `convertirEnFlux`, `grilleDepuisFlux`, `colonnesEquilibrees` et `largeurMinimaleRespectee`, 9 tests de propriétés (50 projets aléatoires, aucune intersection).
- Schéma Zod V15 accepté en plus du V1 ; le client envoie le flux, avec repli V1 puis sans layout pour les anciens serveurs. `convertirEnGrille()` dérive une grille de compatibilité pour le studio.
- Migration 017 + `convertirDefinitionsEnFlux()` : copie personnelle convertie, snapshot figé inchangé, idempotence prouvée. Les tests qui fixaient `MAX(version)=16` ont été mis à jour à 17 sans affaiblissement.
- Modèle système hebdomadaire réécrit : KPI 12 puis anneau 4 / daïra 8 sur la même ligne. Le scénario 192 mesure 281 px / 567 px et `kpiLignes:[4]` à 1280 et 1440 px.
- QA vert : 766 Vitest, 11 scénarios API, 173 Playwright, lint (1 avertissement préexistant), `check:styles`, `check:a11y`.
