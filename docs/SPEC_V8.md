# SPÉCIFICATION V8 — « Laboratoire de synthèses » : construire ses propres synthèses
**Remplace la page `#/rapport?semaine=` (V4 § 9.8 / V5 § 3.11 / V7 § 5.5).** Complète V4 (règles, statistiques § 5), V5, V6, V7. Placer dans `docs/SPEC_V8.md`. Priorités : **P1** obligatoire · **P2** après validation des P1 · **P3** optionnel.

---

## 0. VISION ET PRINCIPES

L'utilisateur **construit lui-même sa synthèse** : il choisit les blocs (KPI, tableaux, graphiques, cartes, textes…), les **mesures**, les **dimensions**, **tous les filtres existants**, la période, la comparaison, la mise en page, puis génère une **édition** datée, la **fige**, l'exporte et la **planifie**. Le rapport hebdomadaire actuel devient un **modèle système** parmi d'autres.

Principes non négociables :
1. **Un seul moteur de calcul** (catalogue sémantique + compilateur de requêtes) pour tout : synthèses, explorateur, exports. Les anciens écrans (tableau de bord, rapport) doivent donner les **mêmes chiffres** que le Lab pour la même définition (test de cohérence).
2. **Jamais de SQL libre** : l'utilisateur compose des *spécifications* JSON validées ; le serveur les compile en SQL **paramétré** à partir d'une **liste blanche** (catalogue).
3. **Transparence des chiffres** : chaque bloc affiche (ⓘ) sa **définition**, sa **base temporelle**, son **statut (actuel / à la date de fin)**, sa **population** et ses **filtres appliqués** ; chaque chiffre est **explorable** (« voir les fiches »).
4. **Reproductibilité** : une édition figée stocke définition + paramètres + résultats + version du catalogue ; elle ne change plus jamais.
5. **Simplicité d'abord** : des modèles prêts à l'emploi, un graphique rapide en 3 clics, des suggestions automatiques ; la puissance (pivots, mesures calculées, sections répétées) reste accessible sans encombrer.
6. Règles V4–V7 inchangées : stats en SQL, `shared/` pour les règles, aucune couleur en dur, FR+AR RTL, clair/sombre, jamais d'écran blanc, tests navigateur réel, Windows d'abord.

---

## 1. CONSTATS SUR LA PAGE ACTUELLE (capture `#/rapport?semaine=2026-11-15`)
| # | Constat | Correctif exigé |
|---|---|---|
| R1 | Le **donut** est d'une seule couleur, sans total au centre, sans légende ni valeurs | Anneau avec total central, légende (n et %), couleurs de statut, étiquettes |
| R2 | Le **diagramme en barres** n'a ni titre, ni légende, ni étiquettes de catégories ; **graduations décimales** (0,25 · 0,5 · 0,75) pour des comptages | Axes entiers pour les comptages, étiquettes, légende, valeurs sur barres, titre |
| R3 | Format des nombres incohérent (`0.0 %` avec point en français ; « Non traitée » au singulier sous un total) | Formateur central (FR : virgule, espace fine ; accords) |
| R4 | Variation `(+1)` sans libellé ni sens | ▲▼ + libellé « vs semaine précédente » + couleur selon le sens favorable |
| R5 | Rapport **figé dans sa structure** : aucun choix de blocs, de mesures, de filtres | Remplacé par le Lab |
| R6 | Pas d'info sur la base de calcul (cohorte, statut à la date, population) | Panneau ⓘ de définition sur chaque bloc + annexe méthodologique |
| R7 | Pas de comparaisons, d'objectifs, de seuils, d'analyses (délais, SLA, âge du stock, tendances, hotspots) | Catalogue complet § 4 |

---

## 2. VOCABULAIRE
- **Modèle** (`modele`) : définition réutilisable d'une synthèse (mise en page + blocs + paramètres par défaut). Modèles **système** (fournis, non supprimables, dupliquables) et **personnels/équipe**.
- **Édition** : application d'un modèle à une **période** et des **filtres** → instance calculée, datable, **figeable** (versions).
- **Section** : ligne de la page contenant 1 à 4 **colonnes** (largeur 3/4/6/8/9/12 sur 12) ; **Bloc** : contenu d'une colonne.
- **Requête** (`requete`) : jeu de données + mesures + dimensions + filtres + tri + limite (+ comparaison).
- **Catalogue** : liste blanche des jeux de données, champs, mesures, filtres, avec définitions FR/AR.

---

## 3. ROUTES ET COMPATIBILITÉ
```
#/syntheses                    Galerie : Mes synthèses · Modèles système · Éditions récentes · Planifiées
#/syntheses/nouvelle           Choisir un modèle ou partir d'une page vierge
#/syntheses/:id                Édition courante du modèle (?debut=YYYY-MM-DD&fin=YYYY-MM-DD) — lecture / aperçu
#/syntheses/:id/editer         Lab (constructeur)
#/syntheses/:id/editions       Historique des éditions et versions figées
#/syntheses/edition/:editionId Édition figée (lecture seule, exportable)
#/laboratoire                  Explorateur de données (pivot) — § 12
#/partage/:jeton               Lecture seule d'une édition figée partagée (sans compte, interne)
#/rapport?semaine=YYYY-MM-DD   ALIAS conservé : ouvre le modèle système « Synthèse hebdomadaire » sur cette semaine
```
Menu : « Synthèses » remplace « Rapport hebdomadaire » (le raccourci `#/rapport` continue de fonctionner). Tous les nouveaux écrans respectent V6 § 2 (aucun blanc au F5, `ErrorBoundary`, états de chargement/erreur) et le routeur/fil d'Ariane déclare **toutes** ces routes.

---

## 4. CATALOGUE SÉMANTIQUE (liste blanche — fichier `shared/catalogue.js` + dictionnaires FR/AR)
Chaque entrée : `{id, type, dataset, label_fr, label_ar, description_fr, description_ar, formats, compat, ...}` ; **test** : toute entrée a FR+AR+description et compile sans erreur.

### 4.1 Jeux de données
`anomalies` (fiches, population de base V4 § 5 : non supprimées, non infirmées sauf bascule) · `transitions` (historique des changements, `anomalie_historique`) · `veille` (éléments de veille V7, si le module existe) · `referentiels` (jointures de libellés, non exposé seul).

### 4.2 Dimensions (jeu `anomalies`)
**Temps** (avec **granularité** : jour · semaine (début `week_start_day`) · mois · trimestre · année · jour de la semaine) sur : `signalement` · `traitement` · `verification` · `intervention` · `publication`.
**Classification** : `domaine` (catégorie) · `groupe` (groupe thématique) · `type`.
**Territoire** : `daira` · `commune` · `cellule_100m` (grille ≈ 100 m, V5 § 3.8).
**Acteurs** : `epic` (+ `intervenant_autre`) · `agent` · `saisi_par`.
**Attributs** : `statut` (actuel) · `statut_fin` (**à la date de fin de période**, `statutAu`) · `verification` · `priorite` · `plateforme` · `contenu_type` · `source_saisie` (manuelle / import / veille / duplication) · `gps` (présent/absent) · `gps_source` · `gps_verifiee` · `recurrent` (lié à une fiche mère) · `a_pieces_jointes` · `en_retard` · `hors_sla` · `tranche_age` (0–7 · 8–14 · 15–30 · >30 j) · `tranche_delai` (0–2 · 3–7 · 8–14 · 15–30 · >30 j).
**Jeu `transitions`** : `champ_modifie`, `utilisateur`, jour/semaine/mois, `statut_origine`, `statut_cible`. **Jeu `veille`** : `source`, `theme`, `commune`, `etat`, `confiance`, jour/semaine.

### 4.3 Mesures (jeu `anomalies`) — **définitions normatives**
Notations : période P = [début, fin], `D` = fin de P, `statutAu(D)` = V4 § 5.2.
| Id | Définition | Base temporelle |
|---|---|---|
| `recues` | nombre de fiches avec `date_signalement ∈ P` | signalement |
| `traitees_periode` | fiches avec `date_traitement ∈ P` (quelle que soit la date de réception) | traitement |
| `cohorte_non_traitees` / `cohorte_en_cours` / `cohorte_traitees` | fiches reçues dans P, classées par **`statutAu(D)`** | signalement |
| `cohorte_pct_*` | part de chaque statut dans la cohorte (**plus grand reste**, somme = 100,0 %) | signalement |
| `taux_traitement` | `cohorte_traitees / recues` | signalement |
| `stock_fin` / `stock_debut` | fiches avec `date_signalement ≤ D` (resp. `≤ début−1`) et `statutAu <> 'traite'` | cumul |
| `variation_stock` | `stock_fin − stock_debut` | cumul |
| `taux_traitement_cumule` | traitées à D / total reçu jusqu'à D | cumul |
| `delai_moyen` / `delai_median` / `delai_p90` / `delai_min` / `delai_max` | jours entre `date_signalement` et `date_traitement` des fiches dont `date_traitement ∈ P` | traitement |
| `delai_verification_moyen` | jours signalement → vérification (fiches vérifiées dans P) | vérification |
| `delai_intervention_moyen` | jours vérification → intervention | intervention |
| `taux_sla` / `nb_hors_sla` | part (nombre) de traitées dans P avec délai ≤ cible de leur priorité | traitement |
| `age_moyen_stock` / `age_max_stock` | âge en jours (D − `date_signalement`) du stock ouvert à D | cumul |
| `en_retard` | stock ouvert à D plus ancien que `délai_retard_jours` | cumul |
| `urgentes_ouvertes` | stock ouvert à D avec priorité urgente | cumul |
| `taux_confirmation` / `taux_infirmation` | parmi les fiches vérifiées dans P | vérification |
| `taux_geolocalisation` / `taux_gps_confirme` | part des fiches (reçues dans P) avec GPS / GPS confirmé sur place | signalement |
| `nb_liens_distincts` · `nb_communes_touchees` · `nb_dairas_touchees` | décomptes distincts | signalement |
| `nb_recurrents` / `indice_recurrence` | fiches liées à une fiche mère ; `nb_recurrents / recues` | signalement |
| `reouvertures` | retours `traite → en_cours/non_traite` dans P (jeu `transitions`) | transition |
| `indice_criticite` (P2) | score composite **à poids paramétrables** : priorité, âge, récurrence, viralité (veille) ; formule affichée en clair | cumul |
| `pct_du_total` · `rang` · `pct_cumule` | dérivées d'une autre mesure sur les lignes affichées (Pareto) | — |
| `variation_abs` · `variation_pct` | écart vs comparaison choisie | — |
**Mesures « veille »** : `collectes`, `pertinents`, `retenus`, `rejetes`, `precision`, `delai_reaction_median` (publication → prise en compte), `evenements`.
**Règles de compatibilité** (`compat`) : le catalogue indique quelles mesures sont valides avec quelles dimensions (ex. `delai_*` n'a pas de sens par `statut`) ; l'interface **désactive** les combinaisons invalides avec explication.
**Mesures calculées** (P2) : formules utilisateur **sans `eval`** (analyseur dédié : `+ − * / ( )`, `si(cond, a, b)`, `arrondi`, `min`, `max`, références à des mesures), évaluées **après agrégation SQL** ; division par zéro → « — ».

### 4.4 Filtres (TOUS ceux du contexte) — appliqués en **ET** entre filtres, **OU** au sein d'un même filtre
Période (presets : cette semaine, semaine dernière, ce mois, mois dernier, 30/90 jours, trimestre, année, plage libre) · statut (actuel) · vérification · priorité · plateforme · type de contenu · catégorie / groupe / type · daïra / commune · EPIC · agent · saisi par · source de saisie · GPS présent/absent · source GPS · GPS confirmé · récurrent · avec pièces jointes · tranche d'âge · tranche de délai · en retard · hors SLA · urgentes · recherche texte normalisée (arabe/latin) · **zone géographique** (rectangle ou cercle tracé sur carte, ou commune) · **inclure les infirmées** · (admin) inclure les supprimées. Opérateurs : `in`, `not_in`, `eq`, `between`, `gt/gte/lt/lte`, `contains`, `is_null`. Les filtres existants des vues enregistrées (V5) sont **réutilisés** (même format).

### 4.5 Formats
Entier · décimal (1) · pourcentage (1 décimale) · jours · « n (x %) » · date. **Un formateur central** `shared/format.js` : FR `fr-FR` (virgule, espace fine insécable), AR `ar-DZ-u-nu-latn` (chiffres occidentaux), accords singulier/pluriel, « — » pour indéfini.

---

## 5. MOTEUR DE REQUÊTE (`server/src/synthese/`)
### 5.1 Spécification d'une requête (zod, `shared/schemas.js`)
```json
{ "dataset":"anomalies",
  "mesures":[{"id":"recues"},{"id":"taux_traitement","alias":"Taux"}],
  "dimensions":[{"champ":"daira"},{"champ":"t.signalement","granularite":"semaine"}],
  "filtres":[{"champ":"epic","op":"in","valeur":[3,5]},{"champ":"priorite","op":"eq","valeur":"urgente"}],
  "periode":{"mode":"herite"|"semaine"|"mois"|"plage"|"glissant","debut":"…","fin":"…"},
  "base_temps":"signalement|traitement|verification|intervention|publication",
  "statut_mode":"actuel|fin_periode",
  "comparaison":"aucune|periode_precedente|meme_periode_n-1|moyenne_4|periode_libre",
  "tri":[{"champ":"recues","dir":"desc"}], "limite":10, "regrouper_autres":true,
  "pivot":{"lignes":[…],"colonnes":[…],"valeurs":[…]}, "totaux":true }
```
Limites : ≤ 4 mesures, ≤ 3 dimensions, ≤ 5 000 lignes, timeout 3 s, définition ≤ 1 Mo, ≤ 60 blocs par modèle.

### 5.2 Compilation et exactitude
1. **Liste blanche** : champs, opérateurs, granularités, tris et fonctions proviennent **uniquement** du catalogue ; toute valeur est un **paramètre lié** ; aucun fragment SQL venant du client.
2. **Population de base** appliquée par une fonction centrale testée (`deleted_at IS NULL`, infirmées exclues sauf option).
3. **`statutAu(D)`** compilé en `CASE` SQL (V4 § 5.2) ; mesures « cumul » utilisent `date_signalement ≤ D`.
4. **Médiane / P90** par fenêtres SQLite (`ROW_NUMBER`, `COUNT OVER`) ; pas de calcul sur toutes les lignes en JavaScript.
5. **Mesures non additives** (taux, médiane, délai moyen…) : les **totaux** et la ligne **« Autres »** sont calculés par **requêtes dédiées** (sans dimension / avec `NOT IN (top N)`), **jamais en additionnant des lignes**.
6. **Comparaison** : la même requête est rejouée sur la période décalée et **jointe par clé de dimension** ; ligne absente → 0 ou « — » selon la mesure.
7. **Pourcentages d'une partition** (anneau, barres 100 %) : plus grand reste (V4 § 5.3) ; total 0 → « — ».
8. **Dimension temporelle** : les périodes sans données sont **comblées** (valeur 0) pour éviter des courbes trompeuses ; semaines selon `week_start_day`, fuseau Africa/Algiers (V4 § 2.7).
9. **Cache** par `hash(spec normalisée + paramètres + data_version)` ; `data_version` incrémenté à chaque écriture de fiche/référentiel ; évaluation **par lot** (`/syntheses/evaluer`) avec dédoublonnage des sous-requêtes identiques.
10. **Garde-fous de coût** : score de complexité (produit des cardinalités), refus clair au-delà d'un seuil.

### 5.3 Résultat
`{ colonnes:[{id,label,type,format}], lignes:[…], totaux, comparaison?, meta:{base_temps, statut_mode, periode, filtres_resumes, population, definitions:[…], ms, cache:bool, avertissements:[…]} }`. Le client **ne recalcule ni n'arrondit** rien.

---

## 6. BIBLIOTHÈQUE DE BLOCS ET DE VISUALISATIONS
**Types** (P1 sauf mention) :
- **KPI** : valeur, variation ▲▼ (sens favorable configurable), libellé de comparaison, **mini-courbe**, **jauge/objectif**, seuils couleur, formats (« n (x %) »).
- **Tableau** : lignes/colonnes, **totaux et sous-totaux**, tri, **barres de données**, mise en forme conditionnelle, **sparklines** par ligne (P2), « Voir les fiches » par ligne, pagination à l'écran / complet à l'impression.
- **Graphiques** : barres (horizontales/verticales, **groupées, empilées, 100 %**) · courbes/aires (multi-séries, **moyenne mobile**) · anneau/camembert · **entonnoir** · **Pareto** (barres + cumul) · **histogramme** (distribution des délais) · **cascade** (stock début + reçues − traitées = stock fin) · **carte thermique** (jour × semaine, commune × catégorie) · **radar** (comparaison de daïras) · **nuage/bulles** (volume vs délai par EPIC) · **treemap** · **bullet** (objectif) · boîte à moustaches (P2) · **Sankey** (P2).
- **Carte** (P2) : marqueurs par statut, densité, **choroplèthe par commune** si les limites sont importées ; rendu d'impression **hors-ligne** (repli quadrillé + marqueurs SVG).
- **Liste de fiches** (tableau d'enregistrements filtré, colonnes au choix) · **Classement** (Top N avec barres) · **Chronologie** des évènements.
- **Texte riche** (sous-ensemble Markdown assaini, **variables** `{{kpi.recues}}`, `{{delta.recues_pct}}`, `{{top.categorie.1.nom}}`), **commentaire du rédacteur** (champ **propre à chaque édition**), **faits marquants** automatiques (V5 § 3.10), **points d'attention**, **image/logo**, **séparateur / saut de page**, **bloc signature** (établi / vérifié / approuvé), **légende des filtres**, **annexe méthodologique** (génère la liste des définitions utilisées).
**Règles de rendu fiables (corrigent R1–R4)** :
- Chaque graphique : **conteneur à hauteur explicite**, `ResponsiveContainer`, enfants de grille `min-w-0`, état *chargement / vide « fantôme » / erreur + Réessayer* ; titre, sous-titre, légende dès qu'il y a > 1 série ou un anneau, **étiquettes de valeurs**, info-bulle riche.
- **Axes** : entiers (`allowDecimals=false`) pour les comptages ; 0–100 % pour les parts ; domaine « joli » ; libellés arabes/longs tronqués avec info-bulle ; **Top N + « Autres »** pour limiter l'encombrement.
- **Couleurs** : jetons `--chart-1…8` (palette distincte, daltonisme-compatible, AA clair/sombre) ; **couleur stable par valeur** (la même catégorie a la même couleur dans tous les blocs) ; statuts = couleurs de statut ; **jamais la couleur seule** (valeurs, motifs optionnels, tableau de données alternatif).
- **Anneau** : total au centre, légende n et %. **Tableaux** : alignement numérique, en-têtes répétés à l'impression.
- **RTL** : axes/ordre inversés, légendes miroir. **Accessibilité** : titre + résumé textuel + **table de données alternative** pour chaque graphique.
- Chaque bloc a une **barre d'actions** (survol/focus) : ⓘ définition · voir les données · voir les fiches · copier le bloc · exporter (PNG/CSV) · masquer à l'impression.

---

## 7. LE LAB — CONSTRUCTEUR (`#/syntheses/:id/editer`)
**Disposition en 3 volets** : **palette** (gauche) · **page A4/A3 WYSIWYG** (centre) · **inspecteur** (droite) ; en RTL les volets sont miroités ; sur mobile, volets en tiroirs.
- **Palette** : blocs par famille avec recherche ; **champs** du catalogue (dimensions / mesures / filtres) groupés et cherchables (FR/AR/synonymes) ; **blocs enregistrés** (bibliothèque personnelle).
- **Page** : modèle **sections → colonnes** (pas de positionnement libre en pixels : prédictible à l'impression et en RTL) ; **glisser-déposer** (`@dnd-kit`, **accessible au clavier**) pour ajouter, déplacer, redimensionner (3/4/6/8/9/12), dupliquer, supprimer ; **sauts de page** explicites ; **section répétée par dimension** (« une page par daïra / EPIC / catégorie / agent », le titre utilise `{{valeur}}`) ; aperçu fidèle de la pagination ; **filigrane « BROUILLON »** tant que l'édition n'est pas figée.
- **Inspecteur** (onglets) : **Données** (jeu, mesures, dimensions, tri, limite, regrouper « Autres », base temporelle, statut actuel/fin de période, comparaison) · **Filtres** (constructeur de filtres complet § 4.4, **filtres hérités du global** visibles et surchargeables) · **Visuel** (type, couleurs, étiquettes, axes, légende, format, hauteur) · **Seuils et objectifs** (règles vert/orange/rouge, valeur cible, sens favorable) · **Avancé** (mesures calculées P2, masquer à l'impression, verrouiller).
- **Barre globale** : **Annuler/Rétablir** (≥ 50 niveaux) · Période (presets + plage) · Comparaison · **Filtres globaux** · Orientation/format (A4 portrait/paysage, A3) · Langue (FR/AR/auto) · Thème de rapport (en-tête officiel, logo, couleurs) · Aperçu écran/impression · Enregistrer · **Générer l'édition** · Figer · Exporter.
- **Graphique rapide** : choisir « mesure × dimension » → l'application **propose le meilleur visuel** (règles : ≤ 7 catégories → anneau ; temps → courbe ; classement → barres horizontales ; deux dimensions → carte thermique/empilé ; distribution → histogramme) ; changement de visuel en un clic.
- **Assistant de modèle** : « Ce que je veux montrer » (état d'avancement, délais, territoire, EPIC, qualité, veille) → propose un squelette de blocs.
- **Autosave** (brouillon versionné, debounce 800 ms), **avertissement avant de quitter**, **raccourcis** (`Ctrl+Z/Y`, `Ctrl+D` dupliquer, `Suppr`, flèches pour déplacer un bloc, `Entrée` ouvrir l'inspecteur), **verrouillage** d'un bloc, **conflit de version** (verrou optimiste comme V4 § 4.3).
- **Validation en direct** : combinaisons invalides désactivées avec raison, avertissements (« base temporelle ≠ période du modèle »), zéro exception → `ErrorBoundary` **par bloc** (un bloc en erreur n'empêche pas la page).

---

## 8. MODÈLES SYSTÈME (8, dupliquables — non supprimables)
1. **Synthèse hebdomadaire standard** (reprend et améliore l'actuelle) : p.1 Synthèse exécutive (8 KPI + objectif, faits marquants, anneau des statuts, cascade du stock) · p.2 Catégories et groupes · p.3 Territoire (daïras, communes, points noirs récurrents) · p.4 EPIC, délais, SLA (entonnoir, histogramme, bullet) · p.5 Qualité et annexes (urgentes, en retard, fiches à compléter, annexe méthodologique) + visa.
2. **Note exécutive 1 page** (pour la direction) : 6 KPI, 3 graphiques, faits marquants, commentaire du rédacteur.
3. **Rapport par daïra** (section répétée : 1 page par daïra, comparée à la moyenne de la wilaya).
4. **Performance des EPIC** (1 page par EPIC : affectées/traitées/en cours, délai moyen/médian, SLA, stock, évolution).
5. **Bilan mensuel** (tendances, comparaison mois précédent, moyenne mobile, Pareto des types).
6. **Veille citoyenne** (collectés, pertinents, retenus, délais de réaction, sujets émergents, événements).
7. **Qualité des données** (géolocalisation, intervenant, pièces jointes, fiches à compléter, anomalies de saisie).
8. **Points noirs récurrents** (hotspots ≈ 100 m, carte de densité, top 10, évolution).
Chaque modèle est **entièrement éditable après duplication** ; les modèles système sont recréés/mis à jour par migration sans écraser les copies.

---

## 9. ÉDITIONS, VERSIONS, VALIDATION, PLANIFICATION, PARTAGE
- **Génération** : un modèle + (période, filtres, comparaison) → `POST /syntheses/editions` ; l'écran montre l'édition **vivante** (recalculée) jusqu'au figeage.
- **Figer** : crée une **version** immuable (`version+1`) stockant définition, paramètres, **résultats de tous les blocs**, `catalogue_version`, `data_version`, horodatage, auteur ; bandeau « Version figée du JJ/MM/AAAA HH:mm » ; **comparaison de deux versions** (P2) en vue côte à côte avec écarts surlignés.
- **Workflow de validation** (P2) : *brouillon → relu → validé → figé* avec rôles (opérateur rédige, admin valide) et traces d'audit ; le filigrane disparaît à la validation.
- **Commentaires** (P2) : annotations par bloc et **épingles sur graphique** propres à l'édition.
- **Planification** (P2) : `syntheses_planifications` (modèle, fréquence hebdo/mensuelle, jour/heure, période « précédente », figeage automatique, notification dans la cloche) ; exécutée par le planificateur existant, **idempotente** (une édition par modèle et période).
- **Partage lecture seule** (P2) : lien à jeton (haché en base, expiration, révocable, **édition figée uniquement**, accès journalisé), pour la direction sans compte ; fonctionne sur le réseau interne.
- **Permissions** : `lecteur` consulte éditions et modèles partagés ; `operateur` crée/édite ses modèles et ceux de l'équipe, génère et fige ; `admin` gère modèles système, planifications, partages et suppression.

---

## 10. NARRATION AUTOMATIQUE, OBJECTIFS, SEUILS
- **Variables de texte** résolues côté serveur dans un **contexte** dérivé des résultats des blocs (`kpi.*`, `delta.*`, `top.<dimension>.<rang>.nom|valeur`, `periode.*`, `filtres.*`) ; interpolation **sans exécution de code** ; accords et pluriels par gabarits FR/AR.
- **Faits marquants** : règles déterministes V5 § 3.10, gravité info/attention/critique, lien vers les fiches ; **configurables** (seuils, activation) dans le bloc.
- **Objectifs** : table `objectifs` (mesure, périmètre, cible, période de validité) alimentant jauges, bullets et seuils ; **règles d'alerte** (P2) « si mesure op valeur » → cloche.
- **Insights prêts à l'emploi** (P2) : « types en plus forte hausse », « communes sans traitement depuis 14 jours », « EPIC les plus lents », détection de semaines atypiques (z-score) ; disponibles comme blocs.

---

## 11. EXPORTS
- **Impression / PDF** : CSS `@media print` (A4/A3, portrait/paysage, marges 12 mm, `print-color-adjust: exact`, en-têtes de tableaux répétés, pas de coupure au milieu d'un bloc, **thème clair forcé**, pagination « Page x/y » quand supportée) ; **PDF fidèle côté serveur** (P2) via Chromium/Playwright si disponible (numérotation, en-tête/pied, arabe correct) avec repli sur l'impression navigateur.
- **Excel** (`exceljs`) : **une feuille par bloc** (données + totaux), feuille « Paramètres » (période, filtres, base de calcul, version), feuille « Définitions », feuille « Données brutes » filtrée (≤ 50 000 lignes), nombres/pourcentages **natifs**, mise en forme conditionnelle, protection contre l'injection de formules ; **les nombres exportés = ceux affichés** (test).
- **CSV** par bloc ; **PNG** par graphique (SVG → canvas, fond adapté) (P2) ; **texte** : résumé copiable (court WhatsApp / long) ; **ZIP « pack direction »** (PDF + Excel + résumé texte) (P2).
- Toute exportation est journalisée (`SYNTHESE_EXPORT`).

---

## 12. EXPLORATEUR DE DONNÉES (`#/laboratoire`)
Même moteur, interface libre : choisir un jeu, **glisser** des champs vers **Lignes · Colonnes · Valeurs · Filtres**, changer l'agrégation/format, tri, totaux et sous-totaux, **% de ligne/colonne/total**, coloration en carte thermique, bascule tableau ↔ graphique (visuel recommandé), **« Ajouter à une synthèse »** (crée un bloc), **requêtes enregistrées** (P2), export CSV/Excel, **« Voir les fiches »** sur toute cellule. Pivot complet en P2 ; **tableau + graphique rapide en P1**.

---

## 13. DONNÉES ET API (migration `010_syntheses.sql`)
```sql
syntheses_modeles(id INTEGER PRIMARY KEY, nom TEXT NOT NULL, description TEXT, proprietaire_id INTEGER REFERENCES users(id),
  portee TEXT NOT NULL DEFAULT 'prive' CHECK(portee IN ('prive','equipe','systeme')), definition_json TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1, version INTEGER NOT NULL DEFAULT 1, cle_systeme TEXT UNIQUE, archive INTEGER NOT NULL DEFAULT 0, ...);
syntheses_editions(id INTEGER PRIMARY KEY, modele_id INTEGER NOT NULL REFERENCES syntheses_modeles(id), periode_debut TEXT NOT NULL, periode_fin TEXT NOT NULL,
  parametres_json TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, statut TEXT NOT NULL DEFAULT 'brouillon' CHECK(statut IN ('brouillon','relu','valide','fige')),
  snapshot_json TEXT, catalogue_version TEXT, data_version INTEGER, textes_edition_json TEXT, genere_par INTEGER REFERENCES users(id), figee_le TEXT,
  UNIQUE(modele_id, periode_debut, periode_fin, version), ...);
syntheses_commentaires(id, edition_id, bloc_id TEXT, user_id, texte, position_json, ...);
syntheses_planifications(id, modele_id, frequence, jour, heure, periode TEXT, auto_fige INTEGER, actif INTEGER, derniere_execution TEXT, ...);
syntheses_partages(id, edition_id, jeton_hash TEXT UNIQUE, expire_le TEXT, revoque INTEGER DEFAULT 0, cree_par, dernier_acces TEXT, ...);
syntheses_requetes(id, user_id, nom, spec_json, ...);          syntheses_blocs_bibliotheque(id, user_id, nom, bloc_json, ...);
objectifs(id, mesure TEXT, perimetre_json TEXT, cible REAL, sens TEXT, valide_du TEXT, valide_au TEXT, ...);
```
**Migration de données** : le rapport actuel et ses **versions figées** (`rapports_hebdo`) sont **conservés** et rattachés au modèle système « hebdomadaire » (aucune perte) ; `#/rapport?semaine=` reste fonctionnel.
**API** : `GET /syntheses/catalogue` · `POST /syntheses/requete` · `POST /syntheses/evaluer` · CRUD `/syntheses/modeles` (+ `/dupliquer`) · `/syntheses/editions` (+ `/figer`, `/valider`, `/export?format=`) · `/syntheses/planifications` · `/syntheses/partages` + `GET /partage/:jeton` · `/syntheses/requetes` · `/syntheses/blocs` · `/objectifs`. Toutes : permissions, CSRF, limitation de débit, zod, audit (`SYNTHESE_MODELE_*`, `SYNTHESE_EDITION_*`, `SYNTHESE_FIGEE`, `SYNTHESE_EXPORT`, `SYNTHESE_PARTAGE_*`, `OBJECTIF_*`). Contenus texte : Markdown **assaini** (liste blanche de balises), jamais de HTML brut.

---

## 14. I18N, THÈMES, ACCESSIBILITÉ, RESPONSIVE, PERFORMANCE
FR + AR (RTL) pour **tout** (catalogue, libellés, définitions, gabarits narratifs) ; parité testée. Rapport : feuille claire en tout thème ; Lab suit le thème. AA ; clavier complet (DnD au clavier) ; responsive (Lab en lecture/édition simplifiée < 1024 px). Performance : une requête < 300 ms sur 50 000 fiches ; évaluation d'une page de 20 blocs < 1,5 s (cache chaud < 300 ms) ; rendu progressif (squelette par bloc) ; annulation des requêtes obsolètes ; pas de re-rendu global à la frappe.

---

## 15. TESTS ET RECETTE
**Unitaires/intégration** : cohérence du catalogue (FR+AR+description, compilation de **chaque** mesure × dimension compatible sur la base de démo, **aucune erreur SQL**) · **injection** (champ, opérateur, tri, limite, granularité hors liste blanche → refus ; valeurs liées) · population de base appliquée partout · `statutAu` et cumul vs `stats.js` (**mêmes chiffres** que tableau de bord et ancien rapport) · médiane/P90 (pair/impair/vide) · bornes de tranches · totaux et « Autres » **non additifs** corrects · comparaison (clés absentes) · comblement des périodes vides · plus grand reste (somme 100,0) · formules calculées (division par zéro, injection) · cache et `data_version` · immutabilité d'une édition figée · versions, unicité, planification idempotente · jetons de partage (expiration, révocation, lecture seule) · **export = affichage** (comparaison Excel/écran) · permissions par rôle.
**Navigateur réel (V6 § 8)** : rechargement dur de **chaque route** (`#/syntheses*`, `#/laboratoire`, `#/partage/*`, `#/rapport?semaine=`) × thème × langue sans blanc ; DnD souris et **clavier** ; annuler/rétablir ; autosave ; géométrie (pas de chevauchement, pas de défilement horizontal, pagination d'impression sans coupure de bloc) ; axe (contraste, noms accessibles) ; graphiques à **axes entiers** pour les comptages, légende présente, couleur stable par valeur.
**Scénarios (s'ajoutent aux 66 précédents ; tous doivent passer)** :
67. `#/rapport?semaine=2026-11-15` ouvre le modèle hebdomadaire ; chiffres identiques au tableau de bord et à l'ancien rapport (même cohorte) ; donut avec total central et légende ; barres avec axes entiers.
68. Créer une synthèse vierge : ajouter KPI + tableau + graphique par glisser-déposer **et au clavier** ; annuler/rétablir ; autosave ; reprise après rechargement.
69. Choisir mesure × dimension → visuel recommandé ; changer de visuel en un clic ; « Autres » et totaux corrects pour un taux.
70. Appliquer **tous** les filtres du § 4.4 (un par un puis combinés) : le nombre de fiches correspond à la liste `#/anomalies` pour les mêmes filtres ; légende des filtres imprimée.
71. Base temporelle `traitement` vs `signalement` et statut `actuel` vs `fin_periode` : définitions affichées dans ⓘ, résultats conformes aux formules du § 4.3.
72. Comparaison (période précédente, N-1, moyenne 4) : ▲▼ et écarts justes ; période sans donnée → « — ».
73. Section répétée « une page par daïra » : N pages, titres corrects, sauts de page propres, totaux cohérents avec la wilaya.
74. Générer, puis figer : version 1 immuable ; modifier des fiches ; re-figer → version 2 ; la 1 reste identique ; comparaison côte à côte (P2).
75. Commentaire du rédacteur propre à l'édition ; variables de texte résolues ; faits marquants corrects avec liens vers les fiches.
76. Exports : PDF (A4 portrait et A3 paysage) lisible FR/AR sans coupure de bloc ; Excel (feuille par bloc + paramètres + définitions + données brutes) avec **mêmes nombres** que l'écran ; CSV ; PNG (P2) ; résumé texte.
77. Planification hebdomadaire : édition auto-générée et figée une seule fois (rejouer ne duplique pas) ; notification.
78. Partage lecture seule : jeton valide → consultation sans compte ; expiré/révoqué → refus ; aucune édition ni donnée hors édition figée accessible.
79. Rôles : `lecteur` ne peut ni éditer ni exporter les données brutes ; `operateur` ne gère pas les modèles système ; essais d'injection refusés.
80. Explorateur : pivot (lignes/colonnes/valeurs/filtres), % de ligne/colonne, « Voir les fiches » d'une cellule, « Ajouter à une synthèse ».
81. Objectifs et seuils : jauge/bullet/couleurs conformes ; règle d'alerte déclenche la cloche (P2).
82. Annexe méthodologique : liste exactement les mesures, filtres et bases utilisés par la synthèse.
83. Résilience : un bloc en erreur n'empêche pas la page ; API lente → squelettes ; F5 sur chaque route sans blanc ; thème clair/sombre et FR/AR corrects.
84. **Régression** : les 66 scénarios V4–V7 passent toujours.

---

## 16. IDÉES SUPPLÉMENTAIRES (au-delà du socle)
**P2** : **mode présentation plein écran** (une section par diapositive, navigation clavier, polices agrandies) pour les réunions du wali · **rapport vivant** (lien en lecture seule actualisé) vs **figé** · **comparaison de deux éditions** · **bilan mensuel auto** agrégeant les hebdomadaires · **tableaux de bord EPIC en lecture seule** filtrés sur leurs propres données (jeton dédié) · **export bilingue** FR+AR du même rapport · **thèmes de rapport** (en-tête officiel, logo, filigrane) · **bibliothèque de blocs** partagée · **alertes** sur seuils de n'importe quelle mesure · **détection de semaines atypiques** · **historique des changements de définition** d'un modèle (qui a modifié quoi).
**P3** : **prévisions simples** (moyenne mobile / tendance linéaire, avec avertissement) · **choroplèthe** par commune et carte statique SVG pour l'impression · **Sankey** des transitions de statut · **requêtes en langage naturel** par grammaire déterministe (« traitées par EPIC cette semaine » → spécification de requête, **sans IA cloud**) · **score de criticité** paramétrable par la cellule · **comparaison à des périodes de référence saisonnières** (Aïd, canicule, pluies).

---

## 17. LIVRABLES V8
Migration `010_syntheses.sql` · `shared/catalogue.js`, `shared/format.js`, schémas zod de requête/modèle · `server/src/synthese/*` (compilateur, évaluateur par lot, cache, éditions, figeage, planification, partage, exports) · UI `#/syntheses*` (galerie, Lab, éditions), `#/laboratoire`, `#/partage/*`, bibliothèque de visualisations · 8 modèles système · `tests/e2e` et `tests/fixtures` · `AUDIT_V8.md` (constats R1–R7 : cause, correctif, test) · README et `DECISIONS.md` mis à jour · **`npm run qa` vert** (régression V4–V7 incluse).
