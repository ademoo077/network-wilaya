# AUDIT V5 — Passage V4 → V5

Date : 2026-11-08. Références : `docs/SPEC.md` puis `docs/SPEC_V5.md`.

## 1. Préservation et état de départ réel

- Copie de sécurité de `data/` et `backups/` : `C:\Users\pc\Desktop\_v5_safe_20261108-104507`.
- Copie dédiée au test de migration : `C:\Users\pc\AppData\Local\Temp\opencode\v5-migration-test.db`.
- Base avant V5 : migration 001, 1 utilisateur, taxonomie 70/156, aucun territoire, aucune EPIC, aucun agent, aucune anomalie métier.
- Tests de référence avant V5 : **17 fichiers / 123 tests verts**, `check:styles` vert.
- Le dépôt ne possédait pas de commit V4 : `HEAD` et le tag `v-avant-v4` pointaient encore sur la V3, avec toute la reconstruction V4 non commitée.
- Le client V4 était incomplet au pivot : build bloqué par un fichier JSX nommé `.js`, puis par cinq pages de routes absentes. Ces pages ont été remises en état fonctionnel avant la fermeture de la phase 1.

Le tag demandé `v4-avant-v5` ne peut donc pas désigner un commit V4 historique qui n'existe pas. Il sera posé sur le premier jalon préservant la reconstruction reçue, avec une annotation explicite ; la copie externe reste le point de restauration exact antérieur aux écritures V5.

## 2. Écarts V5 constatés avant travaux

| Sujet | État initial | Écart principal |
|---|---|---|
| Schéma | migration 001 uniquement | colonnes GPS/source, groupes, limites, cache, vues et réception absents |
| Groupes | absents | aucune ventilation thématique des 70 catégories |
| Collage intelligent | parseur GPS V4 seulement | pas d'analyse de message, DMS, chiffres arabes, contenu social ou date estimée |
| Géolocalisation | aucune route dédiée | pas de polygone, voisinage, proximité ni doublon géographique |
| HTTPS | serveur HTTP | pas de génération de certificat ni diagnostic de contexte sécurisé |
| Statistiques | vue d'ensemble et rapport V4 | médiane/P90, SLA, entonnoir, stock, qualité et faits marquants absents |
| Saisie P1 | formulaire V4 en reconstruction | pas de type-d'abord, brouillon, duplication ni collage global |
| Liste P1 | filtres et actions groupées | pas d'onglets comptés ni vues enregistrées |
| Navigation P1 | shell V4 | pas de page À faire, cloche ou page Santé |
| P2/P3 | absents | réception, mode terrain, 2FA et fonctions optionnelles non commencés |

## 3. Migration 002 — résultats vérifiés

### Sur copie isolée

- `PRAGMA integrity_check` : `ok`.
- `PRAGMA foreign_key_check` : 0 erreur.
- Versions : `001_init.sql`, puis `002_v5.sql`.
- Groupes : 9 ; catégories rattachées : 70/70 ; non rattachées : 0.
- Test automatisé supplémentaire : passage 001 → 002 avec une anomalie existante, référence et `search_norm` préservés.

### Sur la base de travail sauvegardée

- Migration 002 appliquée par `npm run setup`.
- `npm run db:check` : intégrité `ok`, clés étrangères `OK`, taxonomie 70/156.
- Compteurs après migration : 1 utilisateur, 70 catégories, 156 types, 0 anomalie ; ils sont identiques à l'état métier antérieur.
- Les neuf nouveaux paramètres sont installés ; `enrichissement_en_ligne=0` et `https_actif=0` restent les valeurs sûres par défaut.

## 4. Risques et points à suivre

- `npm install --package-lock-only` signale 12 vulnérabilités transitives ; aucune correction forcée n'est appliquée sans analyse des ruptures.
- La preuve accessibilité actuelle est le repli Node sur les contrastes des tokens ; le parcours axe multi-route reste à réaliser avec Playwright.
- Les scripts démo, purge et E2E de la reconstruction V4 restent à terminer avant la recette globale des 32 scénarios.
- Les captures d'écran et la validation visuelle aux quatre largeurs restent à produire en phase 9.

## 5. Résultats par phase

### Phase 1 — Audit et migration

- Sauvegarde externe et test préalable sur copie effectués.
- Migration 002 transactionnelle, paramètres sûrs et tables V5 installés.
- Seed CSV idempotent : une modification administrateur de groupe ou de rattachement n'est pas écrasée.
- Base réelle : intégrité et clés étrangères conformes après migration.
- Résultat de la chaîne qualité et identifiant de commit consignés dans le journal de `PLAN.md`.
- Chaîne de fermeture : build Vite vert (bundle initial 43,64 Ko gzip hors carte/graphiques), 18 fichiers / 128 tests verts, ESLint sans avertissement, styles verts, contrastes AA des tokens verts.
- Smoke test réel : `/api/health` répond `5.0.0` avec DB active et la racine sert le client construit en HTTP 200.

### Phase 2 — Moteur partagé

- `parseSmartPaste` normalise chiffres arabes/persans, séparateur arabe, caractères directionnels et entités HTML sans interpréter le texte.
- URL avec/sans schéma, ponctuation arabe, enveloppes Facebook/Google/Instagram/TikTok, plateformes et types canoniques sont couverts hors-ligne.
- Coordonnées décimales, DMS FR/AR, Google Maps (épingle prioritaire), Waze, Apple Plans, OSM et `geo:` sont couvertes ; `0,0` est rejeté et une zone hors bbox reste un avertissement.
- Dates TikTok/Instagram vérifiées par aller-retour BigInt et garde 2016…aujourd'hui+1 ; aucune date n'est inventée pour les autres plateformes.
- Géométrie partagée : Haversine, bbox, grille, Polygon/MultiPolygon, trous et bornes ; aucun accès réseau ajouté.
- Fermeture : 51 tests dédiés à `smartPaste`, 12 à la géométrie, 9 au parseur GPS étendu ; chaîne complète à 20 fichiers / 192 tests, build, lint, styles et contrastes verts.

### Phase 3 — Géolocalisation serveur

- Routes authentifiées et limitées : analyse partagée, localisation et recherche par rayon ; les POST restent protégés par CSRF.
- La commune est cherchée par bbox + Polygon/MultiPolygon, puis par majorité réelle à 300 m (minimum 2, seuil 60 %), sans sélection inventée.
- Import GeoJSON admin borné à 20 Mo, 5 000 entités et 500 000 sommets : propriété choisie, rapport apparié/non apparié/ambigu, association manuelle, aperçu, fusion et audit.
- Les champs GPS V5 passent par les schémas et le service ; retirer le GPS efface source/précision/confirmation. Les répétitions sont rattachées à la fiche mère et comptées.
- Garde SSRF testée sur domaines, ports, IPv4/IPv6 privés, DNS rebinding, redirection interne et nombre de sauts ; aucune requête sortante n'est encore activée.
- Fermeture : 15 tests d'intégration géographique + 23 tests SSRF ; chaîne complète à 22 fichiers / 230 tests, build/lint/styles/contrastes verts.

### Phase 4 — Collage intelligent UI

- `SmartPasteZone` : zone dédiée (bords pointillés), bouton « Coller depuis le presse-papiers » uniquement en contexte sécurisé, placeholder Ctrl+V hors HTTPS, glisser-déposer texte/fichiers, analyse via `parseSmartPaste` partagé, puces « ce que j'ai compris » (liens, positions, dates) modifiables/supprimables, choix explicite quand plusieurs positions distinctes (> 100 m), message guidé si lien social sans position.
- Formulaire : capture globale `paste` sur `smart-paste`, `lien_url`, `gps_text` (sans intercepter les autres champs) ; application non destructive (champs déjà renseignés manuellement protégés via `manualFields`) avec toast + action « Annuler » ; remplissage lien/plateforme/contenu/date estimée/GPS/observations optionnelles ; suppression de puce retire le champ auto-rempli correspondant quand il n'a pas été modifié manuellement.
- GPS/carte : mini-carte avec marqueur déplaçable, clic carte, badge/source (`gps_source`), case « Position confirmée », copie/OSM/Waze, limites communales connues (`/api/geo/limit/:id`), anomalies proches (`/anomalies/nearby`) affichées en liste + marqueurs, bandeau doublon géographique avec actions (voir fiche / autre anomalie / lier comme signalement répété via `lie_a_id`).
- EXIF : lecture navigateur via `exifr` (import dynamique), proposition d'utiliser la position/photo, message clair si absente ; HTTPS : bouton « Ma position » désactivé avec explication hors contexte sécurisé.
- Admin : onglet « Limites territoriales » (aperçu, propriété, associations manuelles, commit) branché sur `/api/admin/limites/import-geojson`.
- Détail : affichage du compteur « Signalée N fois » quand `repetitions_count > 1` (donnée déjà fournie par l'API).
- Chaîne : build, 22 fichiers/230 tests, lint, check:styles, check:a11y tokens et `scripts/e2e.js` (health/auth/liste/stats/parse-paste/locate) verts. Les scénarios UI 18–26 ne sont pas rejoués automatiquement par navigateur dans cet environnement.

### Phase 5 — Statistiques détaillées serveur

- `GET /api/stats/detail` (authentifié) : période par défaut sur la semaine courante, paramètres de filtres V4, entonnoir reçues → vérifiées → confirmées → engagées → traitées (infirmées à part, taux d'infirmation rapporté aux vérifiées), délais moyens/médiane/P90 et distribution, SLA global et par priorité, SLA de vérification, ancienneté du stock par priorité et plus ancienne fiche ouverte.
- Flux : stock de fin de semaine sur douze semaines, reçues/traitées, MM4, tendance et résorption estimée ; objectif de taux de traitement avec états atteint/proche/en retard ; huit ventilations (plateforme, groupe, domaine, type, daïra, commune, EPIC, agent) et métriques de vérification par agent ; distribution par jour de semaine et carte de chaleur semaine × jour.
- Qualité : points noirs récurrents sur cellules d'environ 100 m (≥ 2, liens comptés, nouveaux à ≥ 3 dans la période), taux de géolocalisation, de position confirmée, d'engagement et d'intervention, liste des fiches à compléter ; dix faits marquants déterministes en français et arabe.
- Rapport hebdomadaire : le format existant est conservé et enrichi de `detail` et `faits`, sans rupture pour les consommateurs.
- Performance : migration 003 (index partiels) ; 50 000 lignes, détail d'une semaine en 213 ms (budget 300 ms), test de non-régression ajouté.
- Fermeture : 23 fichiers / 245 tests, build, lint, check:styles, check:a11y et 11 scénarios E2E verts.
