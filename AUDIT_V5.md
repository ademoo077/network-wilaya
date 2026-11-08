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
