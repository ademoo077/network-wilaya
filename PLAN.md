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
- [ ] `smartPaste` : normalisation, extraction/déballage/classification des URL et texte restant
- [ ] Coordonnées décimales/DMS/liens de carte, chiffres arabes, précision, choix de positions
- [ ] Dates TikTok/Instagram avec garde-fous et tests aller-retour
- [ ] `geo.js` : Haversine, boîtes, grille, Polygon/MultiPolygon avec trous
- [ ] Au moins 30 vecteurs unitaires, build/lint/styles/a11y verts, commit

## Phase V5.3 — Géolocalisation serveur
- [ ] `/tools/parse-paste`, `/geo/locate`, `/anomalies/nearby` avec permissions/limites
- [ ] Déduction polygone puis voisinage ; import GeoJSON avec aperçu/validation/audit
- [ ] Champs GPS V5, `lie_a_id`, doublon géographique et compte des répétitions
- [ ] Tests polygone, voisinage, proximité, sécurité et commit

## Phase V5.4 — Collage intelligent UI
- [ ] Zone Coller globale, puces modifiables, application non destructive et annulation
- [ ] Mini-carte déplaçable, sources GPS, HTTPS expliqué, EXIF navigateur, proches
- [ ] Scénarios 18–26 verts et commit

## Phase V5.5 — Statistiques détaillées serveur
- [ ] Entonnoir, délais moyenne/médiane/P90, distributions, SLA et ancienneté SQL
- [ ] Flux, moyenne mobile, objectif, ventilations, récurrence et qualité
- [ ] Faits marquants déterministes FR/AR et rapport enrichi
- [ ] Tests de bornes/cohérence/performance et commit

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
