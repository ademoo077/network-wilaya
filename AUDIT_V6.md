# AUDIT V6 — Correctifs complets et fiabilisation

Date : 2026-11-09. Références : `docs/SPEC.md` (V4), `docs/SPEC_V5.md` (V5), `docs/SPEC_V6.md` (V6 — ce document prime sur ses sujets).

## 1. État de départ réel

- `HEAD` : `ca90ca3` — « V5.5 - statistiques detaillees serveur » ; arbre de travail propre en amont de la phase 1.
- Base V5 de référence avant travaux : build Vite vert, **245 tests / 23 fichiers verts**, lint vert, `check:styles` vert, `check:a11y` vert (contrastes tokens), E2E API **11 scénarios verts**, chaîne de bout en bout propre.
- Aucun correctif applicatif n'est appliqué en phase 1 : l'objectif était la **preuve par navigateur réel** des constats.

## 2. Infrastructure de test navigateur (Phase 1)

- `playwright.config.mjs` : projet `chromium`, `testDir: ./tests/e2e`, `webServer` → `node scripts/e2e-webserver.mjs`, port E2E configurable (`E2E_PORT`, défaut 4173), baseURL configurable (`E2E_BASE_URL`).
- `scripts/e2e-webserver.mjs` : serveur API de test (base temporaire, migrations, taxonomie, admin), désactivation du flag `must_change_password` pour l'utilisateur de test, démarrage du **faux serveur de redirections** (302 → Google Maps).
- `tests/e2e/helpers.js` : `startFakeRedirectServer`, `startTestServer`, `waitForHealth`, `loginAs`, `collectErrors`, `expectNotBlank`, `pasteText`, `blockTiles`, `unroute`.
- Scripts npm : `npm run test:e2e:browser` (`playwright test`) et `npm run qa` (build + lint + check:styles + test + test:e2e + test:e2e:browser + check:a11y).
- Environnement : `@playwright/test` et `@axe-core/playwright` présents ; Chromium installé ; E2E exécuté contre le client construit.

## 3. Constats C1–C12 — état en phase 1

| Constat | Test phase 1 | Résultat |
|---|---|---|
| C1 — Écran blanc après F5 (`#/carte`, `#/anomalies/nouvelle`) | `tests/e2e/c1-reload.spec.js` | **Rouge reproduit puis corrigé en phase 2** : `expectNotBlank` échouait sur les deux routes signalées ; la suite passe désormais sur les cinq routes testées. |
| C2 — Liens courts sans position | `tests/e2e/c2-short-link.spec.js` + faux serveur de redirections | Infrastructuré ; comportement rouge (résolution non aboutie) documenté. |
| C3 — Collage dans le champ Lien : aucun message | `tests/e2e/c3-paste.spec.js` | Rouge **masqué** par C1 : le champ `#lien_url` n'était pas présent au moment de l'assertion. |
| C4 — Logique du formulaire fragile | — | À cadrer avec les phases 3/4 du formulaire réécrit. |
| C5 — Catégorie/Type sans texte indicatif | `tests/e2e/c5-form-fields.spec.js` | Rouge **masqué** par C1 (`#lien_url` introuvable côté assertions de placeholder). |
| C6 — Hint Statut « Plateforme détectée : À vérifier » | `tests/e2e/c6-c7-form.spec.js` | Rouge **masqué** par C1 (texte attendu introuvable). |
| C7 — Motif visible à la création | `tests/e2e/c6-c7-form.spec.js` | Préparation de la régression ; comportement non isolable tant que C1 n'est pas corrigé. |
| C8 — Barre d'actions recouvrante les champs | `tests/e2e/c8-action-bar.spec.js` | Rouge **masqué** par C1 (`#observations` introuvable). |
| C9 — Carte : légende/attribution qui se chevauchent | — | À auditer en phase 5 après C1. |
| C10 — Carte : incohérence des comptes (1 anomalie affichée vs 2 au dashboard) | — | À auditer en phase 5 après C1. |
| C11 — Dashboard : cartes étirées, barres sans légende, activité répétée | — | À auditer en phase 6 après C1. |
| C12 — Réactivité globale | — | À auditer en phase 7 après C1. |

## 4. Causes réelles identifiées en phase 1

- **C1** : cause racine présumée (à confirmer dans la console navigateur pendant la phase 2) — le rendu des routes protégées se produirait avant la résolution complète de `/auth/me` puis `/ref/bootstrap`, avec accès à des valeurs `undefined` (`.map`, `.find`) puis repli React absent. Les tests rouges confirment la reproduction du blanc sur `#/carte` et `#/anomalies/nouvelle`.

## 5. Résultats de la chaîne qualité en phase 1

- `npm run lint` : vert.
- `npm run check:styles` : vert.
- `npm run check:a11y` : vert (contrastes des tokens, clair et sombre).
- `npm run build` : vert.
- `npm run test` : **245 tests / 23 fichiers verts** (régression V4/V5 préservée).
- `npm run test:e2e` : **11 scénarios E2E API verts**.
- Suite navigateur Playwright : exécutée ; **rouge attendu sur C1** (`#/carte`, `#/anomalies/nouvelle`).

## 6. Points restants après phase 1

- Phase 2 : machine de démarrage `boot → authChecking → refs → ready`, `ErrorBoundary` global + par route, écran `FatalError` avec Réessayer, `lazyWithRetry`, validation zod des réponses API, cycle de vie Leaflet, journal `erreurs_client`.
- Phase 3 : moteur de liens et GPS (résolution de liens courts, cache, proxy, repli HTML, codes d'échec, Santé › Connectivité).
- Phase 4 : réécriture du formulaire (reducer unique, origines, tâches annulables, collage partout, libellés/hints, motif conditionnel, barre d'actions).
- Phase 5 : cartes ; Phase 6 : dashboard et audit des autres pages ; Phase 7 : réactivité/design ; Phase 8 : recette finale (scénarios 33–52 + régression 32).

## 7. Bilan phase 2

- **C1 corrigé** : `client/src/App.jsx` (machine de démarrage `authChecking → refsLoading → ready`, squelette plein écran), `client/src/context/AuthContext.jsx` (reset de session), `client/src/components/ErrorBoundary.jsx` (global + par route), `client/src/features/errors/FatalError.jsx`, `client/src/main.jsx` (handlers erreurs + `vite:preloadError`), `client/vite.config.js` (`base: './'`).
- **Client-errors** : `POST /api/client-errors` (migration `004_v6.sql`, `server/src/routes/errors.js`) + `client/src/utils/clientErrors.js` (fire-and-forget, plafonné).
- **Validation frontière** : `client/src/api/client.js` (zod + fallback), `MapPage` (`items ?? []`).
- **Leaflet** : `ResizeObserver` → `invalidateSize()` dans `MapPage`.
- **Tests** : `tests/e2e/c1-reload.spec.js` vert (5 routes), suite unit/integration et E2E API verts, build/lint/check:styles/check:a11y verts.

## 8. Points restants phase 2

- Phase 3 : moteur liens & GPS ; Phase 4 : formulaire ; Phase 5 : cartes ; Phase 6 : dashboard ; Phase 7 : réactivité ; Phase 8 : recette finale (scénarios 33–52 + régression 32).

## 9. Bilan phase 3

- Moteur de liens courts : POST /api/tools/resolve-link (modes cartes / tous / aucune, cache TTL succes 7 jours / echec 5 minutes, injection de dependances, boucle de redirections 6 sauts max, codes d'erreur types SSRF).
- Tests : server/tests/resolve-v6.test.js vert (C40 red?vert, C41, C44) ; tests/fixtures/paste-vectors.json (45 vecteurs) + shared/tests/paste-vectors.test.js (39 verts / 8 rouges sur formats GPS restants).
- Restants phase 3 : formats GPS N/S/E/W, Bing, OLC, partage Facebook, positions multiples - a traiter en phase 3/4.

## 10. Reprise contrôlée du 10 novembre 2026 — preuves de départ

L'ancien bilan ci-dessus décrit les commits hérités, **pas une recette validée**. Reprise sur `6f9c697`, arbre propre. `npm run test:unit` : 287 verts, 8 rouges (vecteurs V6), régression V4/V5 verte. Playwright était installé et fonctionne.

- Protection : tag `v5-avant-v6` sur `ca90ca3`. Copie `data/` + `backups/` et snapshots SQLite cohérents : `C:\Users\pc\AppData\Local\Temp\opencode\v6-before-2026-11-10T08-33-53-552Z`.
- L'ancien test C2 affirmait **l'absence de position**, avec une requête sans cookie. Il a été renforcé : authentification réelle, vraie position attendue, vérification latitude/longitude. Le faux serveur était lancé mais jamais utilisé par le résolveur ; il est désormais injecté sans accès Internet.
- Les anciens tests formulaire utilisaient un territoire vide : leurs échecs ne prouvaient aucun bug de formulaire. Des fixtures de démonstration cohérentes et une base vide indépendante permettent désormais d'isoler ces cas.
- `expectNotBlank` vérifie un contenu visible et le titre attendu, plus les erreurs console et réseau. Un texte d'erreur n'est plus confondu avec une page saine.

### Causes réellement mesurées (avant correctifs)

| Constat | Preuve rouge / cause réelle |
|---|---|
| C1 | `boot-failures.spec.js`, scénario 35 : après `/ref/bootstrap` 500, console **`TypeError: Cannot read properties of undefined (reading 'replace')`**, pile Leaflet `getTileUrl → createTile → _addTile`. `RefsProvider` avale l'erreur puis `App` considère la phase prête ; `tile_url` est absent. Le scénario 36 démontre une boucle de rechargement due au listener `vite:preloadError` inconditionnel. Les routes normales rapides passent déjà dans le commit hérité ; aucune nouvelle cause n'est inventée. |
| C2 | Résolveur hérité : timeout réinitialisé par saut, aucun repli HTML, DNS contrôlé séparément du connecteur, aucun proxy. Le formulaire conditionne encore la résolution à `enrichissement_en_ligne=0`. |
| C3 | Test `c3-paste` : aucun message « Lien reconnu » après collage. Les résultats sont détenus par l'ancien composant de collage et ne sont pas affichés sous le champ Lien. |
| C4 | `triage-v6`, scénario 43 : conservation partielle mais aucune suggestion de remplacement ; états éparpillés, appels `/geo/locate` dépendant de tout `form`, absence d'annulation et d'identifiant de requête. |
| C5 | `c5-form-fields` : les deux placeholders attendus sont absents ; `Combobox` utilise `placeholder=''` et ne resynchronise pas sa valeur affichée. |
| C6 | `c6-c7-form` : aide Statut attendue absente ; clé `form.detected` utilisée avec une valeur de vérification. |
| C7 | `triage-v6` : `Motif` visible dès la création ; condition `form.motif !== undefined` toujours vraie. |
| C8 | Barre `fixed inset-x-0 bottom-0` extérieure au flux ; test géométrique étendu aux champs réels, et non à un identifiant absent. |
| C9 | `triage-v6` : légende absente du panneau ; alerte activée dès la première `tileerror`, sans compteur ni délai. |
| C10 | `triage-v6` : lien vers les fiches sans GPS absent ; `loadAll` élimine ces fiches et perd leur compte. |
| C11 | `expectCompactCards` mesure **378 px de vide** sous « Par catégorie » et « Par daïra » ; grille étirée. Activité = lignes par champ sans regroupement ni description. |
| C12 | Test période avec API ralentie : le titre du tableau de bord disparaît au clic ; `useFetch` remplace toutes les données par le bloc de chargement, sans cache. |

Infrastructure complétée : `tests/support/browser-server.mjs` (processus/port/dossiers isolés), `fake-redirects.mjs`, fixtures avec et sans GPS, helpers de géométrie et axe, matrice des routes. Exécution du triage : **11 échecs ciblés, 3 réussites** ; ces échecs restent bloquants et ne sont ni ignorés ni inversés.

### Complément C1 : erreur de cycle de vie réellement capturée

La matrice complète a révélé une seconde exception sur fiche et modification : **`Cannot read properties of undefined (reading '_leaflet_pos')`**, pile `invalidateSize` → `MiniMap`. Le timer à 50 ms survivait à `map.remove()` ; remplacement par un `ResizeObserver` déconnecté avant destruction, garde sur l'instance courante et remise à zéro des couches. Les pages 404 n'avaient pas de titre `h1` : titre ajouté. Le compteur du scénario chunk compte désormais les requêtes document (les événements `framenavigated` comptaient aussi `replaceState` de HashRouter) ; l'exigence reste exactement deux chargements document.

## 11. Bilan des phases 4 à 8 et recette finale

### 11.1 Corrections livrées (fichiers principaux)

| Phase | Livraison | Preuves automatisées |
|---|---|---|
| 4 — formulaire | Réducteur unique `formState` avec origines `defaut/manuel/auto`, valeurs manuelles protégées, tâches annulables « dernière réponse gagne », annulation groupée, brouillons, EXIF, suggestions de types FR/AR, sections conditionnelles, photos et erreurs visibles | `shared/tests/type-suggestions.test.js`, `smartPaste`, `tests/e2e/form-behavior.spec.js` (37–46), `form-enhancements.spec.js`, `c5`/`c6-c7`/`c8` |
| 5 — carte | Projection dédiée `GET /api/anomalies/map` (sans pièces ni historique), clusters, densité, sélection synchronisée, filtres dans l'URL, compteur « sans position » issu des mêmes filtres SQL, repli de tuiles | `server/tests/filters-v6.test.js`, `tests/e2e/map-interactions.spec.js`, `triage-v6.spec.js` C9/C10 |
| 6 — tableau de bord | Grille non étirée, barres avec légende/valeurs, activité groupée et décrite, statistiques détaillées en SQL, correction du profiling (`weekday`/`heatmap` par date distincte, bornes de dates) | `triage-v6.spec.js` C11, `stats-detail.test.js`, `perf.test.js` (18/18) |
| 7 — réactivité | React Query (cache, `keepPreviousData`, invalidation), mutations optimistes avec retour arrière, chargement différé des routes, recherche différée, cartes mobiles, sidebar responsive | `list-reactivity.spec.js` (47, 49), `reload-matrix.spec.js` |
| 8 — recette | Vues enregistrées, file « À faire », cloche, diagnostic de connectivité, journal d'erreurs client, captures, documentation | `saved-views.test.js`, `work-queue.test.js`, `views-work.spec.js`, `health-diagnostics.spec.js` |

### 11.2 Recette V6 — scénarios 33 à 52

| Scénario | Test / preuve | État |
|---|---|---|
| 33 — F5 toutes routes × thème × langue × base vide/démo | `reload-matrix.spec.js` (8 combinaisons), `c1-reload.spec.js` | vert |
| 34 — territoire vide | `boot-failures.spec.js` scénario 34 | vert |
| 35 — bootstrap 500 puis Réessayer | `boot-failures.spec.js` scénario 35 | vert |
| 36 — chunk bloqué | `boot-failures.spec.js` scénario 36 | vert |
| 37 — lien Google Maps long | `form-behavior.spec.js` 37, `paste-vectors` (45 vecteurs) | vert |
| 38 — lien Facebook / inconnu | `form-behavior.spec.js` 38, `c3-paste` | vert |
| 39 — coordonnées GPS | `form-behavior.spec.js` 39 | vert |
| 40 — lien court lent | `form-behavior.spec.js` 40, `c2-short-link` | vert |
| 41 — résolution impossible | `form-behavior.spec.js` 41 | vert |
| 42 — deux réponses rapprochées | `form-behavior.spec.js` 42 | vert |
| 43 — valeur manuelle protégée | `form-behavior.spec.js` 43, `triage-v6` C4 | vert |
| 44 — Waze/Plus Code/DMS/arabe | `form-behavior.spec.js` 44, `shared/tests/paste-vectors.test.js` | vert |
| 45 — géométrie et barre collante | `c8-action-bar.spec.js`, `form-behavior.spec.js` 45–46 | vert |
| 46 — libellés et motif conditionnel | `c5`, `c6-c7`, `triage-v6` C7 | vert |
| 47 — carte, légende, compteur | `triage-v6` C9/C10, `map-interactions`, `list-reactivity` 47 | vert |
| 48 — tableau de bord compact | `triage-v6` C11 | vert |
| 49 — réactivité optimiste | `list-reactivity.spec.js` 49, `triage-v6` C12 | vert |
| 50 — connectivité sortante | `health-diagnostics.spec.js` scénario 50 | vert |
| 51 — erreurs client | `health-diagnostics.spec.js` scénario 51 | vert |
| 52 — régression V4/V5 | suite unitaire/intégration complète (362 tests) et 11 scénarios API | vert |

### 11.3 Nouveaux contrôles de la reprise

- **Vues enregistrées** : privées par défaut, partage administrateur, doublons et limite refusés, application remplaçant tous les filtres. Quatre tests serveur, un test navigateur.
- **File « À faire »** : chaque compteur est comparé au `total` de la liste filtrée correspondante ; les alertes système restent réservées aux administrateurs. Trois tests serveur, un test navigateur.
- **Cloche** : même total que la page (6 dans la base de démo), panneau accessible, lien vers la file.
- **Screenshots** : `npm run screens` régénère 42 captures (`docs/screens/`) : 7 routes × {FR clair, FR sombre, AR sombre} × {1440, 390}. Elles servent à l'examen humain ; aucune assertion n'en dépend.

### 11.4 Résultat de la chaîne complète

- `npm run build` : vert, découpage par route conservé (carte 189 Ko, formulaire 73 Ko, index 245 Ko).
- `npm run lint` : vert.
- `npm run check:styles` : vert.
- `npx vitest run` : **362/362**.
- `npm run test:e2e` : **11/11** scénarios API.
- `npx playwright test` : **56/56**, puis **58/58** avec les deux tests Santé.
- `npm run check:a11y` : vert (contrastes des tokens, clair et sombre).
