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
| C1 — Écran blanc après F5 (`#/carte`, `#/anomalies/nouvelle`) | `tests/e2e/c1-reload.spec.js` | **Rouge reproduit** pour les deux routes signalées : `expectNotBlank` échoue (contenu absent au chargement) ; zéro `pageerror` attendu mais non satisfait. |
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
