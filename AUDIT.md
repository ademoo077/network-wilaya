# AUDIT — Passage V3 → V4

Date : 2026-11-08. Base : inspection de l'existant + exécution (DB legacy lue en lecture seule).

## 0. Sauvegarde et préservation
- `data/` et `backups/` copiés dans `C:\Users\pc\Desktop\_v4_safe_20261108-101141` (hors dépôt).
- Tag git `v-avant-v4` posé.
- Base legacy conservée : `data/anomalies.db` (copie de travail) et `data/legacy-v3.db`.

## 1. Constat sur les données legacy (vérifié par requête)
- `domaines` 70 / `types_anomalie` 156 : conformes à la taxonomie officielle.
- `anomalies` : 2 lignes de test (`facebook.com/test123`, référentiels « Daia Test »).
- `dairas` 61, `communes` 61, `epics` 61, `agents` 0 : **toutes synthétiques** (« Daia Test », « EPIC Test », noms arabes `daia_test_ar`).
- `users` : 2 comptes de test (`admin`, `admin_test`), aucun agent réel.
- `parametres` vide, `audit_log` 7 lignes de test, 1 rapport de test.
- Tables parasites `t1`, `t2` (vides), colonnes hors spec (`anomalies` sans `version`, `search_norm`, `intervenant_autre`, `deleted_by`).
- Conclusion : **aucune donnée métier réelle**. La base est archivée intacte (aucune perte) ; V4 repart d'une base propre et réimporte la taxonomie depuis le CSV de référence (même 70/156). Décision consignée dans `DECISIONS.md`.

## 2. Écarts structurels vs SPEC V4 (fichier + cause)
| Domaine | Constat | Cause |
|---|---|---|
| Architecture | Pas de npm workspaces, pas de `shared/` | V1 monolithique ; règles dupliquées serveur/client |
| Sessions | `express-session` MemoryStore | Contraire à § 7 (jetons hachés en base) |
| CSRF | Absent | Non implémenté |
| Helmet | CSP par défaut, `upgrade-insecure-requests` | Risque de page blanche en HTTP (§ 7) |
| Modèle | `anomalies` sans `version`, `search_norm`, `intervenant_autre`, `deleted_by`, CHECK métier | Migration 001 V1 incomplète |
| Migrations | Table `migrations` maison | Spec exige `schema_migrations` versionnée |
| Stats | `stats.js` V3 partiel, pas de `statutAu`, pas de plus grand reste, % côté client | § 5 non couvert |
| Rapport | 4 KPI, pas de versions figées, pas de comparaison S−1 | § 9.8 non couvert |
| UI | 15 composants ui/ seulement, pages ad hoc, accents manquants, pas de preuve RTL | § 9.1–9.11 non couvert |
| Admin | 3 onglets sur 7 | Référentiels/users/paramètres/import/corbeille manquants |
| Sécurité PJ | MIME seul, pas de signature binaire | § 7 |
| Tests | 24 tests, pas de perf, pas de styles/a11y bloquants, tests écrivant dans `backups/` réel | § 12 |
| Démo | Absente (données de test non purgeables) | § 8.5 |

## 3. Décision de migration
Reconstruction V4 conforme à la spécification dans le dépôt, en conservant :
1. la taxonomie officielle (`seed/taxonomie_anomalies.csv`) ;
2. la base legacy archivée (`data/legacy-v3.db`, + copie hors dépôt) ;
3. le tag `v-avant-v4` pour l'historique.

Aucune donnée réelle n'étant présente, aucune transformation de lignes n'est nécessaire ; la migration `001_init.sql` crée le schéma cible. Un script `scripts/import-legacy.js` documente la correspondance V3→V4 pour d'éventuelles bases legacy réelles (testé sur copie).
