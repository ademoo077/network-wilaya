# PLAN — Plateforme de suivi des anomalies (points noirs) — V4

**Référence unique** : `docs/SPEC.md` (v4.0). **État initial** : code V1/V2/V3 non conforme (voir `AUDIT.md`), base legacy archivée.

Légende : `[x]` fait et vérifié · `[ ]` à faire.

## Phase 1 — Socle
- [x] Sauvegarde `data/`+`backups/`, tag `v-avant-v4`, `AUDIT.md`, plan, décisions
- [ ] Workspaces npm `shared` / `server` / `client`, scripts Windows, `.env` auto
- [ ] `shared/` : normalize, url, gps, dates, percent, statut, schemas zod, constants
- [ ] DB : `001_init.sql`, `schema_migrations`, pragmas, taxonomie idempotente 70/156
- [ ] Serveur Express, sessions maison + CSRF, helmet § 7, rate limit, `/api/health`
- [ ] Admin initial + `admin:reset`, sauvegarde auto quotidienne
- [ ] Tests unitaires `shared` verts, login/logout vérifiés par exécution

## Phase 2 — Référentiels & assistant
- [ ] `/ref/*` CRUD, `/ref/bootstrap`, `/setup/status`, `/ref/bulk-territoire`
- [ ] Utilisateurs, paramètres, assistant 4 étapes, import CSV référentiels
- [ ] Tests référentiels/territoire verts

## Phase 3 — Anomalies (serveur)
- [ ] `validerEtat` unique, transitions, verrou optimiste, historique
- [ ] Doublons lien/strict, recherche normalisée, pièces jointes, corbeille, bulk
- [ ] CHECK SQL + matrice de tests d'intégration

## Phase 4 — Statistiques & rapport (serveur)
- [ ] `stats.js` SQL, `statutAu`, plus grand reste, comparaison S−1
- [ ] Snapshots versionnés, export xlsx/csv
- [ ] Tests : semaine vide, ÷0, infirmées exclues, cohérence, perf 50 000 < 300 ms

## Phase 5 — Design system & shell
- [ ] Tokens, composants `ui/`, thèmes, i18n FR/AR + RTL, `check:styles`
- [ ] Shell (sidebar, topbar, recherche, menu utilisateur), login, 404

## Phase 6 — Pages anomalies
- [ ] Saisie/modification, liste + filtres + bulk + tiroir, fiche + chronologie
- [ ] Scénarios 2–9

## Phase 7 — Tableau de bord, carte, rapport
- [ ] Dashboard complet, carte + repli hors-ligne, rapport A4 + Excel + figer
- [ ] Scénarios 10–12

## Phase 8 — Administration, import/export, sauvegardes
- [ ] 7 onglets admin, import avec aperçu, sauvegarde/restauration sécurisées
- [ ] Scénarios 13, 16

## Phase 9 — Finition & recette
- [ ] Accessibilité, responsive, performance, E2E, 17 scénarios, README/docs
- [ ] Vérification finale complète (install/build/test/lint/styles/a11y/e2e)

## Journal
- 2026-11-08 : audit, sauvegarde, tag, base V4.

---

# PLAN V5 — GPS intelligent et statistiques détaillées

Référence complémentaire : `docs/SPEC_V5.md`. Les exigences V4 non modifiées restent applicables.

## Phase V5.1 — Audit et migration
- [x] Lire intégralement les spécifications V4 et V5 ; auditer l'état réel dans `AUDIT_V5.md`
- [x] Sauvegarder `data/` et `backups/` hors dépôt ; établir la base de tests V4 (123 tests verts)
- [x] Tester `002_v5.sql` sur une copie, puis sur la base sauvegardée ; intégrité et clés étrangères vertes
- [x] Créer les tables/colonnes V5 et les neuf paramètres avec valeurs sûres
- [x] Importer idempotemment 9 groupes et rattacher 70/70 catégories sans écraser les modifications admin
- [x] Chaîne de qualité complète verte ; commit de phase et tag annoté `v4-avant-v5`

## Phase V5.2 — Moteur partagé
- [x] `smartPaste` : normalisation, extraction/déballage/classification des URL et texte restant
- [x] Coordonnées décimales/DMS/liens de carte, chiffres arabes, précision, choix de positions
- [x] Dates TikTok/Instagram avec garde-fous et tests aller-retour
- [x] `geo.js` : Haversine, boîtes, grille, Polygon/MultiPolygon avec trous
- [x] Au moins 30 vecteurs unitaires, build/lint/styles/a11y verts, commit

## Phase V5.3 — Géolocalisation serveur
- [x] `/tools/parse-paste`, `/geo/locate`, `/anomalies/nearby` avec permissions/limites
- [x] Déduction polygone puis voisinage ; import GeoJSON avec aperçu/validation/audit
- [x] Champs GPS V5, `lie_a_id`, doublon géographique et compte des répétitions
- [x] Tests polygone, voisinage, proximité, sécurité et commit

## Phase V5.4 — Collage intelligent UI
- [x] Zone Coller globale, puces modifiables, application non destructive et annulation
- [x] Mini-carte déplaçable, sources GPS, HTTPS expliqué, EXIF navigateur, proches
- [x] Scénarios 18–26 : composants et API livrés (vérification navigateur automatisée non exécutée faute de navigateurs Playwright installés ; logique couverte par tests partagés/serveur et E2E API) ; commit

## Phase V5.5 — Statistiques détaillées serveur
- [x] Entonnoir (infirmées incluses), délais moyenne/médiane/P90, distributions, SLA et ancienneté en SQL
- [x] Flux, moyenne mobile MM4, objectif, ventilations, récurrence et qualité
- [x] Faits marquants déterministes FR/AR et rapport hebdomadaire enrichi (`detail`, `faits`)
- [x] Tests de bornes (2/3, 7/8, 14/15, 30/31), monotonie, cohérence et performance 50 000 lignes (< 300 ms) ; commit

## Phase V5.6 — Tableau de bord et rapport
- [ ] Blocs et graphiques détaillés, heatmap, rapport A4 cinq pages et Excel multi-feuilles
- [ ] Cohérence dashboard/rapport/export/résumé ; scénarios 27–28 verts ; commit

## Phase V5.7 — Améliorations P1
- [ ] Type d'abord, récents, duplication, brouillon et raccourcis
- [ ] Onglets comptés, vues enregistrées, itinéraire/message EPIC
- [ ] Page À faire, cloche, Administration Santé et `https:setup`
- [ ] Scénarios 30–31 verts et commit

## Phase V5.8 — P2
- [ ] Résolution distante avec garde SSRF, réception/WhatsApp et rapport libre/auto
- [ ] Palette, bon d'intervention, 2FA, export complet et mode terrain
- [ ] Scénario 29 et tests P2 verts ; commit

## Phase V5.9 — Recette
- [ ] 32 scénarios, seed/purge, états vides, captures FR/AR clair/sombre et responsive
- [ ] Installation/build/tests/lint/styles/a11y/E2E verts, README et audits finaux, commit

## Journal V5
- 2026-11-08 — Phase 1 : copie externe, migration testée sur copie puis appliquée, intégrité OK, 9 groupes/70 catégories, build vert, 18 fichiers/128 tests verts, lint/styles/contrastes verts.
- 2026-11-08 — Phase 2 : analyseur hors-ligne et géométrie partagés, 51 vecteurs smart-paste + 12 géométrie, 20 fichiers/192 tests verts, build/lint/styles/contrastes verts.
- 2026-11-08 — Phase 3 : parse/locate/nearby, polygones + voisinage, import GeoJSON audité, GPS V5 et répétitions ; garde SSRF testée ; 22 fichiers/230 tests verts.
- 2026-11-08 — Phase 4 : SmartPasteZone, mini-carte déplaçable/géométrie/proches, EXIF navigateur, badge/source GPS, suggestion/doublon géographique, lien répété, HTTPS expliqué, admin limites (aperçu/import), `/geo/limit/:communeId`, script `scripts/e2e.js` ; build, 22 fichiers/230 tests, lint, styles, a11y tokens et E2E verts.
- 2026-11-09 — Phase 5 : `GET /api/stats/detail` (entonnoir, délais, SLA, ancienneté, tendance 12 semaines/MM4, objectif, 8 ventilations, jour/heure, récurrence, qualité, 10 faits), rapport hebdomadaire enrichi ; index partiels de performance (migration 003), 50 000 lignes en 213 ms ; 23 fichiers/245 tests, build, lint, styles, a11y et 11 scénarios E2E verts.

---

# PLAN V8.2 — Widgets statistiques et tableaux au choix, dans la synthèse

Référence : prompt V8.2 + `docs/SPEC_V8.md` + `AUDIT_V8.md`. Le tableau de bord n’est **pas** modifié. `#/rapport?semaine=` reste fonctionnel.

## Phase 1 — Socle widgets, narration et audit
- [x] Vérifier catalogue (38 mesures / 30 dimensions / 30 filtres), moteur whitelisté, cache et évaluation par lot
- [x] Audit de la page Synthèse (`AUDIT_V8.md`, constats R1–R7 avec causes)
- [x] Schémas zod `syntheseSectionSchema` + `syntheseWidgetSchema` (alias de bloc) ; blocs texte sans requête
- [x] `shared/src/describe.js` : `describeRequete` / `describeFiltres` / `describeFiltre` FR + AR, 5 tests
- [x] 8 modèles système validés et semés idempotemment (prod + navigateur), 4 tests, copies préservées
- [ ] Visuel recommandé + `POST /widgets/apercu` (phase 3)

## Phase 2 — Mode Personnaliser
- [ ] Sections/colonnes (3·4·6·8·9·12), DnD souris + clavier, inspecteur, copy-on-write, autosave 800 ms, annuler/rétablir ≥ 50, pagination visible

## Phase 3 — Assistant et galerie
- [ ] Assistant 3 étapes avec aperçu réel, visuel recommandé, phrase `decrire()` ; galerie ≥ 35 widgets validés

## Phase 4 — Widgets tableau
- [ ] Tableau agrégé (totaux/« Autres » dédiés) + liste de fiches (colonnes, tri, 200 lignes) ; impression paginée avec en-têtes répétés

## Phase 5 — Filtres et transparence
- [ ] Filtres globaux/propres, badge, légende imprimée, ⓘ, annexe méthodologique, « Voir les fiches »

## Phase 6 — Éditions et exports
- [ ] Générer/figer (immuable, versionnée), PDF A4/A3, Excel multi-feuilles, CSV, bibliothèque de widgets favoris

## Phase 7 — Recette
- [ ] Scénarios 85–96, régression 1–84, captures FR/AR × clair/sombre, README, QA verte

## Journal V8.2
- 2026-11-16 — Phase 1 : audit R1–R7, `describe.js` (5 tests), schémas widget/section, 8 modèles système idempotents (4 tests). Vitest ciblé vert. Suite : mode Personnaliser.

---

# PLAN V9 — Studio corrigé et base des réseaux sociaux

Références : prompt V9, `docs/SPEC_V8.md`, `AUDIT_V9.md`, `DECISIONS.md`. Le tag `avant-v9` marque l’état de départ. Chaque phase se termine par un résumé de cinq lignes maximum.

## Phase 1 — Audit et Partie A (L1–L10)
- [x] `AUDIT_V9.md` : causes et correctifs L1–L10, état réel des parties B/C
- [x] Grille 12 colonnes, largeurs portées par le modèle système (KPI 12, anneau 4, daïra 8)
- [x] KPI sans troncature, anneau entier avec légende, tableau sans scroll ni pagination inutile
- [x] Largeur d’affichage (Écran large / Fidèle à l’impression / Plein écran), barre compacte, en-tête compact, aucun jargon, menu non rogné
- [x] Barre d’actions des widgets (ⓘ, données, fiches, plein écran, CSV/PNG), étiquette système unique
- [x] Scénarios 113–115 (géométrie, axe, FR/AR, clair/sombre) et `npm run qa` vert ; commit de phase

## Phase 2 — Socle réseaux sociaux (déjà livré, à vérifier)
- [x] Migration additive `011_reseaux_sociaux.sql` (au lieu de 007, déjà appliquée), `shared/`, permissions, audit
- [x] Lecture/export pour tous les rôles, écritures admin, verrou optimiste, soft delete
- [x] Reprendre les tests de schéma/normalisation manquants et documenter l’écart de route/migration dans `AUDIT_V9.md` / `DECISIONS.md`

## Phase 3 — Import et qualification
- [x] Assistant d’import enrichi : en-tête tolérant, hyperliens, paires, téléphones refusés, aperçu, annulation, idempotence
- [x] Rapprochement territorial et conflits explicites conservés (aucune commune inventée ; création du référentiel restée explicite hors import)
- [x] File « À qualifier » avec P/R/G/C/I et annulation Z ; cinq onglets et panneaux Imports/Qualité ; scénarios 116–119

## Phase 4 — Interface `#/reseaux-sociaux`
- [x] Ajout manuel et en lot, édition, fusion, corbeille, historique, contrôle manuel, onglet Qualité
- [x] Scénarios 120–121 et 126

## Phase 5 — Statistiques et catalogue
- [ ] Jeux `sources`/`couverture`, ≥ 14 widgets, modèle système n°9, cohérence annuaire/Lab/export
- [ ] Scénarios 122 et 124

## Phase 6 — Données personnelles et intégrations
- [ ] Masquage des profils par rôle, audit de consultation, aucun bouton Veille sur un profil, exports
- [ ] Suggestion de source dans le formulaire anomalie, filtre source, revue annuelle ; scénarios 123 et 125

## Phase 7 — P2/P3
- [ ] Import « stat semestrielle » et POINTS hebdomadaires ; scénario 127

## Phase 8 — Recette
- [ ] Captures FR/AR × clair/sombre, README, `AUDIT_V9.md` final, `npm run qa` vert, scénarios 113–128

## Journal V9
- 2026-11-17 — Tag `avant-v9`, audit initial et plan. Début de la phase 1.
- 2026-11-17 — Phase 1 livrée : L1–L10 corrigés, 7 tests dédiés (dont 4 variantes FR/AR × clair/sombre), `npm run qa` vert (115 Playwright).
- 2026-11-17 — Phases 2–3 livrées : import tolérant et annulable, refus contact/Feuil1, compteurs qualité SQL, cinq onglets `#/reseaux` et file P/R/G/C/I avec Z. 17 scénarios du répertoire verts.
- 2026-11-17 — Phase 4 livrée : ajout par lot (≤ 100), fusion contrôlée, corbeille/restauration, contrôle manuel et historique audité ; migration additive `012`, 28 tests serveur, scénarios 120/121/126 et `npm run qa` vert (614 Vitest, 11 E2E API, 124 Playwright).
- 2026-11-17 — Studio : « Plein écran », barre compacte masquant menu et topbar, retour à la semaine courante ; contrats de migration alignés sur `001–012`. Scénario dédié FR/AR à 390/1440 px et `npm run qa` vert.
- 2026-11-17 — Synthèse — confort général et impression : aperçu A4 fidèle, sections de réglages et réinitialisation, largeurs de blocs respectées sur la feuille, accès à l'impression depuis le canevas, état accessible de la page. Nouveau scénario Studio et `npm run qa` vert (614 Vitest, 11 E2E API, 125 Playwright).
- 2026-11-17 — Correction compression : les actions des cartes étroites se replient au lieu de déborder ; le scénario 113 contrôle l'absence de débordement interne de toutes les cartes.
- 2026-11-17 — Graphiques et rendu professionnel : clés HTML avec totaux/pourcentages, valeurs sur barres simples, axes tokens, suppression de la limite 65 mm à l'impression et bouton « Aperçu A4 » pendant la création. Nouveau scénario dédié ; `npm run qa` vert (614 Vitest, 11 E2E API, 126 Playwright).
- 2026-11-17 — « Synthèse hebdomadaire standard » s'ouvre désormais en pleine largeur (`max`) dans le Studio et la feuille autonome ; le choix manuel reste prioritaire. Scénarios 114 et plein écran adaptés sans affaiblissement.

---

# PLAN V10 — Studio de synthèses « façon atelier »

Références : prompt V10, `docs/SPEC_V8.md`, `PLAN.md`, `DECISIONS.md`, `AUDIT_V10.md`. Le tag `avant-v10` marque l'état de départ (`5786eaf`). Chaque phase se termine par un résumé de cinq lignes maximum, puis un commit quand le gate est vert. Priorité : **P1 d'abord**, P2 ensuite.

## Phase 1 — Grille libre, pagination et migration sections → grille
- [x] Audit initial dans `AUDIT_V10.md` et décisions de numérotation/compatibilité
- [x] `layout_json` 12 colonnes × 40 px avec positions `x, y, w, h`, déplacement/redimensionnement souris + clavier, magnétisme, guides, zoom 50–150 %, RTL
- [x] `paginer()` déterministe dans `shared/` : aucun widget coupé, sauts forcés, A4/A3 portrait/paysage, mêmes pages écran/PDF
- [x] Conversion fidèle des modèles système `sections` → grille ; éditions figées inchangées ; scénarios 130, 139, 140 (migration)

## Phase 2 — Sélecteur et widgets
- [ ] Fenêtre « Ajouter un widget » par cartes, tailles affichées, recherche, aperçu en direct, bouton Ajouter justifié
- [ ] Actions widget et `ErrorBoundary` par widget, sans bloquer le projet
- [ ] Radial, camembert et barres sans chevauchement (repli en légende) ; carte recadrée et hors-ligne ; scénarios 129, 136, 137

## Phase 3 — Jeux de données
- [ ] Gestionnaire, import CSV/XLSX, schéma, aperçu et profilage
- [ ] Tables générées sûres et adaptateurs raccordés au moteur unique
- [ ] Scénarios 132 et 133

## Phase 4 — Filtres-widgets
- [ ] Filtres texte, liste, composite, période et curseur
- [ ] Portées, correspondance de champs, filtrage croisé et barre active
- [ ] Scénario 134

## Phase 5 — Couleurs et styles
- [ ] Sélecteur visuel, hex validé, nom Tailwind, pipette et palettes
- [ ] Règles par valeur, échelle continue, contraste AA et adaptation sombre
- [ ] Style de projet, application par type et pinceau ; scénario 135

## Phase 6 — Sorties de données
- [ ] Vue des données d'un widget, lignes sources et export du jeu
- [ ] Panier multi-feuilles, tâche longue et extracteur libre
- [ ] Mêmes nombres qu'à l'écran, droits par rôle et audit ; scénario 138

## Phase 7 — Aides et projets
- [ ] Glisser un champ, suggestions, kits de démarrage et `Ctrl+K`
- [ ] Enregistrer sous, mes projets, partage équipe et import/export JSON
- [ ] Scénarios 131, 133 et 140

## Phase 8 — Recette
- [ ] Scénarios 129 à 141, régression 1 à 128, captures FR/AR × clair/sombre
- [ ] README, `AUDIT_V10.md` final et `npm run qa` vert

## Journal V10
- 2026-11-18 — Tag `avant-v10`, audit initial et plan. Migration V10 prévue en `013_studio_atelier.sql` (`008` déjà appliquée). Début de la phase 1.
- 2026-11-18 — Phase 1 livrée : `shared/src/layout.js` (grille 12×40, conversion sections→grille, `decouperEnPages`, déplacement/redimensionnement), schémas `layout` additifs, `StudioGrid` (drag/resize souris+clavier, zoom 50–150 %, RTL), sauts de page CSS `break-before`. Modèles système resemés avec `layout`. Tests 130/139/140 + unitaires `layout`. `npm run qa` vert (621 Vitest, 11 E2E, 129 Playwright, styles/a11y OK).
