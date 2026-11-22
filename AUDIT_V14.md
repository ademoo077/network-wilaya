# AUDIT_V14.md — Choisir la page sociale depuis l’URL

Point de départ : tag annoté `avant-v14` sur `ff51512` (V13 et correctifs R1/R2 présents dans l’arbre de travail, non commités). Objectif : détecter la page sociale depuis l’URL de publication, sinon proposer un panneau prérempli « Ajouter la page », sans jamais deviner ni écraser un choix manuel. Version produit inchangée (`5.0.0`).

## 1. Constats et causes

| ID | Constat | Cause réelle relevée | Correctif | Preuve |
|---|---|---|---|---|
| V14-1 | Aucune table `reseaux_sources` | Le répertoire réel est `comptes_sociaux` (migration 011), avec qualification, corbeille et historique | Réutilisation comme seule source de vérité, aucun doublon | `server/src/services/sourceIdentifiants.js`, `sources-v14.test.js` |
| V14-2 | Aucun identifiant stable pour retrouver une page depuis une URL | Seule `lien_normalise` existait | Migration 015 : `reseaux_identifiants` (slug/id/handle/canal, unique par réseau) + `anomalies.source_reseau_id` | `015_sources_identifiants.sql`, `reseaux.test.js` (66 vecteurs) |
| V14-3 | Liens `share`, `reel`, `fb.watch`, `vm.tiktok.com` non identifiables | Ces URL ne désignent pas une page | `extraireIdentiteSource` retourne `indetermine` ; aucun scraping, résolution courte optionnelle et non bloquante | Scénario 181, `resolutionOptionnelle()` |
| V14-4 | Erreur « Une erreur interne est survenue » en production sur « Traité » / modification | La base de service avait enregistré la migration 013 sans `anomalies.sans_photo_motif` ; le SQL du service échouait en `no such column` | Migration additive 016 avec directive idempotente `@add-column-if-missing` | `016_sans_photo_motif_repair.sql`, `migration-v14-repair.test.js` |
| V14-5 | Contraste axe 3,91 sur un bouton désactivé en transition | axe lisait une couleur intermédiaire pendant l’animation d’opacité | `expectAccessible()` neutralise animations/transitions avant l’analyse | `tests/e2e/geometry.js`, scénario « légendes des graphiques » |

## 2. Écarts et décisions

- 012–014 étaient déjà appliqués : V14 ajoute **015** (identifiants) puis **016** (réparation), sans renumérotation. Les scénarios correctifs post-V13 sont `R1`/`R2` ; 179–188 sont réservés à V14.
- Le prompt cite `reseaux_sources` et `012_sources_identifiants.sql` : ces noms n’existent pas dans le dépôt. Aucune table parallèle ni resynchronisation n’est créée.
- `POST /reseaux/rapide` crée (201) ou retourne l’existante (200) ; concurrence 409 `RESEAU_EXISTANT` avec l’item gagnant. Aucune qualification automatique (`a_verifier`, origine manuelle).
- Les profils restent réservés à l’administrateur ; l’opérateur crée pages/groupes/chaînes, le lecteur ne crée rien. La page reste facultative.
- Un choix manuel n’est jamais remplacé en silence : suggestion « Remplacer par … ? », confirmation après changement de lien, restauration proposée pour une page en corbeille.
- `recents` est envoyé par le client depuis `localStorage` et ordonné en SQL : aucune table d’usage serveur.
- Statistiques `by=source` et filtre liste `source` sont agrégés en SQL, sans boucle cliente.

## 3. Migration et données live

- La migration 015 a d’abord été jouée sur une copie cohérente : 100 anomalies, 104 pages conservées, 104 identifiants créés, 0 rattachement automatique, `integrity_check=ok`, 0 clé étrangère invalide. Elle a ensuite été appliquée à la base de service.
- La réparation 016 a été rejouée sur une copie SQLite de la base de service avant application : 140 anomalies, 105 pages, 104 identifiants conservés, colonne ajoutée, `integrity_check=ok`, 0 clé étrangère invalide.
- Aucune donnée `[DEMO]`, `TEST-LOCAL-30`, compte, mot de passe ou migration appliquée n’a été supprimée, réécrite ou re-seedée.

## 4. État d’avancement

- **Phase 1** : extraction pure (63 vecteurs, 66 tests), migration 015, rétro-remplissage idempotent. QA vert (743 Vitest, 11 API, 156 Playwright).
- **Phase 2** : routes `identifier`/`recherche`/`rapide`/`identifiants`, Zod, CSRF, rôles, limiteur, audit. QA vert (750 Vitest, 11 API, 156 Playwright).
- **Phase 3** : `SourcePicker` intégré (cas A/B/C/D), détection 300 ms avec annulation et dernière réponse gagne, combobox AR/Latin, récentes, pastilles, profils, confirmation de remplacement. QA vert (752 Vitest, 11 API, 163 Playwright).
- **Phase 4** : persistance `source_reseau_id`, filtre source, stats SQL, restauration, conflits 409, scénarios 184/185/188, captures FR/AR × clair/sombre × 390/768/1024/1440. QA vert (754 Vitest, 72 fichiers, 11 API, 168 Playwright, lint, styles, a11y).
- **Réparation production** : migration 016 appliquée au redémarrage, `/api/health` 200, version `5.0.0`, migration 16, 104 identifiants, 140 anomalies, colonne `sans_photo_motif` présente, log sans nouvelle erreur `no such column`.

## 5. Recette

- Scénarios 179–183, 186–188 plus la régression « conflit après choix manuel » : 12 scénarios V14, FR/AR RTL, clair/sombre, 390/768/1024/1440, F5 sans blanc, aucune erreur page, `expectNoOverflow` et `expectActionBarClear`.
- 21 captures générées par `npm run captures:v14` dans `docs/captures-v14/` (matrice complète + ajout, fiche, liste filtrée, tableau de bord).
- Aucun `skip`, aucune assertion affaiblie ; chaque correctif V14 possède une régression ciblée (Vitest ou Playwright).
- QA complet vert : `npm run build`, `lint`, `check:styles`, `test`, `test:e2e`, `test:e2e:browser`, `check:a11y`.
- Reste : rien.

## 6. Complément — option « Aujourd’hui » (22/11/2026)

- `PERIOD_OPTIONS` dans `shared/src/listViews.js` centralise les préréglages ; la valeur `1` produit `from = to = todayAlgiers()` via `addDays`, sans nouvelle colonne ni route. Le filtre `date_signalement` reste appliqué en SQL par `buildFilters`.
- La puce active affiche le libellé du préréglage (« Aujourd’hui » / « اليوم ») au lieu d’un chiffre brut ; les date inputs manuels continuent de réinitialiser `periode`.
- Scénario 189 : une anomalie datée d’hier est créée via l’API avec CSRF, la sélection « Aujourd’hui » ramène le compte à 3 sur 4 et masque sa référence, libellés FR/AR RTL et 390/768/1024/1440 sans débordement.
- QA complet vert après ce complément : 754 Vitest (72 fichiers), 11 scénarios API, 169 Playwright, lint, styles, a11y. Build Vite régénéré et servi par le processus de production existant.

## 7. Correctif — page Facebook `profile.php?id=…` (22/11/2026)

- Symptôme : l’ajout de `https://www.facebook.com/profile.php?id=61590719786996` échouait pour un opérateur. `natureSuggeree` forçait « Profil citoyen » sur tout `profile.php`, or la création d’un profil est réservée à l’admin (422), alors qu’un identifiant long désigne ici une page de programme (« 6000 logement Maktaa Kheira Q25/Site01/Ex Cosider »).
- Correctif dans `shared/src/reseaux.js` : pour Facebook, un identifiant numérique d’au moins 12 chiffres est suggéré en `page`. Les identifiants courts (`profile.php?id=42`, `/people/…`) restent `profil` et la réservation admin demeure inchangée.
- Régression : 2 assertions Vitest (`reseaux.test.js`) et scénario Playwright 190 (opérateur, URL et nom exacts, catégorie `page`, identifiant lié, aucun `pageError`).
- QA complet vert : 754 Vitest (72 fichiers), 11 scénarios API, 170 Playwright, lint (1 avertissement préexistant), `check:styles`, `check:a11y`.
