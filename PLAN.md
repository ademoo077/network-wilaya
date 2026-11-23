# PLAN V13 — Phase par phase

Base : tag `avant-v13`. Migration unique additive `014_photos_pipeline.sql` (le nom `011_photos.sql` du prompt est impossible : 011–013 existent). Version produit inchangée. Un seul moteur de calcul : les chiffres et les éditions figées ne changent pas.

## Phase 1 — Audit, Options avancées, noms de fichiers
1. `AUDIT_V13.md` (causes F1–F8 + écarts), `PLAN.md`, `DECISIONS.md`, tag `avant-v13`.
2. `shared/statut.js` : `exigencesStatut(statut)` (liste structurée avec libellés FR/AR) ; service, zod, menu Statut et messages d’erreur en dérivent (test de non-dérive).
3. Suppression de toute mention « vérification » du flux anomalie : traductions, `SettingsStep`, routes/audit, `VerificationBadge` inutilisé ; le module séparé des comptes sociaux conserve son contrôle de fiche.
4. Agent automatique en lecture seule (« Agent affecté (automatique) ») + « Modifier » avec motif et agents actifs ; plus de recherche par e-mail.
5. Intervenant unique (EPIC ou « Autre intervenant » conditionnel), dates conditionnelles, section admin repliée avec résumé, barre d’actions et aide visibles.
6. Décodage `originalname` latin1→UTF-8, nom d’affichage assaini, stockage UUID conservé ; tests accents/arabe/emoji.
7. Régression : scénario 174 vert, QA complet vert.

## Phase 2 — Pipeline d’images
1. Migration `014_photos_pipeline.sql` : `largeur`, `hauteur`, `apercu_flou`, `hash`, `dossier_derive`, index ; testée sur copie ramenée à 013.
2. `sharp` : orientation EXIF, dérivés 320/800/1600 WebP + repli JPEG, mini-aperçu ~24 px base64, dimensions ; original privé, EXIF personnel purgé.
3. Routes versionnées par hash, `ETag`, `Cache-Control: private, max-age=86400, immutable` ; variantes `?taille=mini|moyen|grand` ; accès authentifié uniquement.
4. Tâche idempotente de recalcul des pièces existantes avec progression et rapport ; aucune pièce supprimée, `role='autre'` pour les images historiques.
5. Tests d’images (signature, MIME, 5 Mo, orientation, ratios, flou, cache, existence des dérivés, aucune image cassée) ; QA vert.

## Phase 3 — Fiche : panneau Photos
1. Remplacement de « Comparer avant/après » + « Pièces jointes » par un panneau Photos unique : comparateur 4:3, badges Avant/Après, date/heure, légende, auteur, GPS.
2. Modes Côte à côte / Curseur (`role=slider`, clavier, `aria-valuenow`) / Fondu, mémorisés par utilisateur.
3. Visionneuse plein écran : ←/→, Esc, zoom, déplacement, rotation, téléchargement, diaporama, compteur, légende modifiable, focus piégé et restauré.
4. Galerie : vignettes avec badge de rôle, glisser-déposer + menu, principale, sélection multiple, ZIP, tri, lazy-loading, flou→net, hauteur réservée, « Image indisponible — Réessayer ».
5. Documents : icône/type/taille/date/auteur, suppression confirmée avec « Annuler ».
6. Envoi : glisser-déposer, multiple, `capture="environment"`, collage, aperçu, progression, compression client ≤2560 px/0,85, renommage/légende, erreurs claires.
7. Dialogue « Traité » : sélection/envoi de la photo Après avec aperçu dans le dialogue.
8. Régression scénarios 169/170, QA vert.

## Phase 4 — Liste refondue
1. Préréglages Standard (sans défilement page à 1280 px) / Complet (scroll interne, ombres, colonnes figées), sélecteur de colonnes par utilisateur, `table-layout: fixed`.
2. Colonnes Standard : ☐, Référence, Date, Statut (valeur visible + menu), Photos (deux vignettes 48×48, `+n`, ⚠), Catégorie › Type, Commune/Daïra, Agent, EPIC, Priorité, Source, Actions/Liens.
3. Aperçu rapide (tiroir) avec comparateur, actions, navigation ↑/↓ ; densité confort/compact, zébrure, navigation clavier (↑↓, Entrée, Espace, P).
4. En-têtes uniformes sticky, tri, pagination « 1–25 sur 100 », squelettes à hauteur réservée, vide illustré, erreur + Réessayer.
5. Filtres compacts repliables, puces actives, période unique, vues enregistrées, filtres URL ; première ligne visible à 1080 p.
6. Correction du bord gauche du menu et du shell ; boutons CSV/Excel/Importer traduits.
7. Régression scénarios 171–173, QA vert.

## Phase 5 — Fiche : historique et blocs
1. Formateur d’historique partagé : libellés FR/AR, `JJ/MM/AAAA`, motif en citation, aucune valeur technique ni entrée « vérification ».
2. Regroupement par minute/auteur, icônes par type (statut, dates, agent, photo, GPS, source), avatar, heure relative + date exacte, filtre par type.
3. Blocs Agent (origine/date/réaffecter), Source (pastille réseau), GPS (mini-carte + lien), observations.
4. Colonne principale + historique collant ; historique en bas sur mobile ; aucun vide inutile.
5. Régression scénario 175, QA vert.

## Phase 6 — Synthèses et impression
1. Widget Avant/Après : cartes-paires ratio fixe, légende référence/commune/daïra/dates/intervenant, 2 paires par ligne, nombre par page réglable, dimensions explicites.
2. Aperçu/impression sans coupure ; Excel avec liens uniquement.
3. P2 : planche photographique PDF A4 (2–4 paires/page, en-tête, pied « Page x / y », référence), vue Galerie de la liste, redimensionnement des colonnes, HEIC→JPEG.
4. Régression scénario 176, QA vert.

## Phase 7 — Recette finale
1. Scénarios 169–178 verts en FR/AR × clair/sombre × 390/768/1024/1280/1440, axe, CLS, images chargées, aucun débordement.
2. Rechargements durs liste/fiche/création, régression V4–V12 complète.
3. Captures dans `docs/captures-v13/`, README et `AUDIT_V13.md` mis à jour.
4. `npm run qa` vert, résumé final.

## Résumés attendus
Après chaque phase : 5 lignes maximum - corrigé / tests / causes trouvées / points restants.

## V14 — Choisir la page depuis l'URL (création d'anomalie)

### Phase 1 — Audit, extraction pure et données
1. Audit : `reseaux_sources` n'existe pas ; la table V9 réelle est `comptes_sociaux` (réutilisée, sans second moteur).
2. `shared/src/reseaux.js` : `extraireIdentiteSource(url)` pure (slug/id/handle/canal, statut `identifie`/`indetermine`, `page_url`), sans scraping.
3. Table de vecteurs ≥ 50 URL réalistes (FR/AR indifférents, partages non identifiables inclus) + tests unitaires.
4. Migration `015_sources_identifiants.sql` : `reseaux_identifiants`, `anomalies.source_reseau_id`, rétro-remplissement depuis `url_normalisee`/`lien_normalise`.
5. QA vert ; résumé 5 lignes.

### Phase 2 — API
1. `POST /reseaux/identifier` (lecture seule, limitation de débit, correspondance + similaires + résolution optionnelle non bloquante).
2. `GET /reseaux/recherche` (normalisé arabe/latin, récentes en tête, filtre réseau/commune).
3. `POST /reseaux/rapide` (crée ou retourne l'existante, 201/200/409, statut `a_verifier`, origine `manuel`, file « À qualifier »).
4. `POST /reseaux/:id/identifiants` (liaison d'alias), permissions/CSRF/zod/audit `RESEAU_RAPIDE`, `RESEAU_IDENTIFIANT`.
5. Tests d'intégration (droits, doublons, concurrence, restauration) ; QA vert.

### Phase 3 — UI du formulaire
1. Combobox « Page / source » : recherche, pastille réseau, nature, commune, récentes, filtre réseau, « + Ajouter une page ».
2. Détection automatique sur le champ Lien (debounce 300 ms, dernière réponse gagne, annulation des requêtes).
3. Cas A (page reconnue + suggestion commune + Changer), B (panneau pré-rempli), C (lien non identifiable), D (profils admin seulement).
4. Messages FR/AR (page détectée / non répertoriée / lien non identifiable / similaire / ajoutée), choix manuel jamais écrasé.
5. Scénarios 179-183, 186, 187 verts ; QA vert.

### Phase 4 — Intégration et recette
1. Droits profils (opérateur : option désactivée + explication ; lecteur : aucune option).
2. Cas limites : changement de lien (confirmation), page d'une autre page, suppression logique (restaurer), concurrence 409.
3. `source_reseau_id` enregistré, filtre « source » dans la liste, statistiques par page, F5 sans blanc, FR/AR clair/sombre.
4. Captures FR/AR, `AUDIT_V14.md`, scénarios 184, 185, 188 verts, **`npm run qa` vert**.
5. Réparation 016 : la base live avait 013 sans `sans_photo_motif` ; directive idempotente dans `migrate.js`, testée sur copie puis appliquée au redémarrage.

### Résumés V14 (5 lignes maximum par phase)
- **Phase 1** : `extraireIdentiteSource` pure, 63 vecteurs/66 tests, migration 015 et rétro-remplissage testés sur copie. QA vert : 743 Vitest, 11 API, 156 Playwright. Aucun scraping, aucune ressource créée en doublon. Reste : API à brancher.
- **Phase 2** : quatre routes avec Zod, rôles, CSRF, limiteur, audit et résolution courte non bloquante. QA vert : 750 Vitest, 11 API, 156 Playwright. Concurrence 409 et identifiants liés couverts. Reste : UI à intégrer.
- **Phase 3** : `SourcePicker` (A/B/C/D), recherche AR/Latin, récentes, détection annulable, profils admin, choix manuel protégé. QA vert : 752 Vitest, 11 API, 163 Playwright. Scénarios 179–183/186/187 + régression conflit verts. Reste : persistance/filtres.
- **Phase 4** : source persistée et visible en fiche, filtre et stats SQL, restauration, scénarios 184/185/188 et 21 captures. QA vert : 754 Vitest (72 fichiers), 11 API, 168 Playwright, lint/styles/a11y. Migration 016 répare la colonne manquante de la base live sans toucher aux données. Reste : rien.
- **Complément « Aujourd’hui »** : préréglage `1` partagé, `from=to=todayAlgiers()` en SQL, libellé FR/AR et puce de filtre, scénario 189. QA vert : 754 Vitest, 11 API, 169 Playwright, lint/styles/a11y. Reste : rien.
- **Correctif `profile.php` long (22/11/2026)** : un identifiant Facebook ≥ 12 chiffres est suggéré en « Page locale », pas en « Profil citoyen » ; l’ajout réussit pour un opérateur. Scénario 190 + 2 assertions Vitest. QA vert : 754 Vitest, 11 API, 170 Playwright, lint/styles/a11y. Page live id 111 créée avec le nom exact. Reste : rien.
- **Correctif « Données invalides » / territoire (22/11/2026)** : les ids de daïra/commune du formulaire (texte) sont convertis en nombres dans `SourcePicker` avant l’ajout de page ; scénario 191. QA vert : 754 Vitest, 11 API, 171 Playwright, lint/styles/a11y. Service redémarré sur le nouveau build. Reste : rien.

## V15 — Studio de synthèses : flux, visualisations et impression fiable (22/11/2026)

Références : prompt V15, `docs/SPEC_V8.md`, `AUDIT_V9.md` à `AUDIT_V14.md`, `DECISIONS.md`. Baseline : tag annoté `avant-v15` sur `6b283f5`. Le moteur de calcul, les chiffres et les éditions figées ne changent pas.

### Numérotation des scénarios

Les scénarios V14 189 (« Aujourd’hui »), 190 (`profile.php`) et 191 (territoire) existent déjà. Les scénarios du prompt V15 sont donc décalés de +3 :

| Prompt | Scénario effectif | Objet |
|---:|---:|---|
| 189 | 192 | Studio à l’écran 1280/1440, lignes 4+8, KPI, barre unique |
| 190 | 193 | Personnaliser : min 240 px, poignées bords, clavier, annuler/rétablir |
| 191 | 194 | Anneau : total centré dans le SVG, légende complète |
| 192 | 195 | « Par daïra » : barres horizontales, colonne Daïra, toutes les lignes |
| 193 | 196 | Impression A4 standard : 1 page, référence `SYN-2026-S47-v1` |
| 194 | 197 | Rapport long : remplissage ≥ 70 %, en-têtes répétés, formats |
| 195 | 198 | Aperçu = impression = PDF, FR/AR |
| 196 | 199 | Galerie : recherche, catégories, aperçu, clavier |
| 197 | 200 | Migration x/y → flux, éditions figées réimprimées à l’identique |
| 198 | 201 | Résilience : ErrorBoundary, F5, clair/sombre, FR/AR, régression |

### Phases

| # | Phase | Critère de réussite |
|---:|---|---|
| 1 | Instrumentation (JSON géométrie/remplissage/pages, captures) + `AUDIT_V15.md` + tests rouges S1–S9 | Chaque constat a une cause mesurée et un test rouge |
| 2 | Modèle de flux : `regrouperEnLignes`, conversion x/y → flux, migration **017** (pas 013, déjà appliquée), grille 12/6/1, min 240 px, modèle système réécrit | Scénarios 192, 200 verts |
| 3 | Cadre de widget (actions hors flux, menu ⋯, pas de « Contenu masqué »), barre unique, KPI équilibrés | Scénarios 192, 193 verts |
| 4 | Visualisations : anneau, barres/étiquettes, tableau avec dimension, Analyse | Scénarios 194, 195 verts |
| 5 | Pipeline d’impression : route `#/imprimer/:id`, mesure, `paginer()`, vue statique, CSS, référence, PDF, réimpression des figées | Scénarios 196–198 verts |
| 6 | Galerie refaite : recherche, catégories accentuées, aperçu, configuration, clavier | Scénario 199 vert |
| 7 | Recette 192–201, captures FR/AR × clair/sombre, PDF exemple, README, audit complet | **`npm run qa` vert** ; commit |

### Résumés V15 (5 lignes maximum par phase)
- **Phase 1** : instrumentation JSON/captures centralisée (`v15-instrumentation.js`), `AUDIT_V15.md` avec causes mesurées S1–S9. Neuf tests rouges exécutés puis retirés (TDD), remplacés par les scénarios verts 192–201. Migration 017 et décalage de numérotation consignés dans `DECISIONS.md`. QA vert : 754 Vitest, 11 API, 171 Playwright, lint (1 avertissement préexistant), styles et a11y. Reste : phases 2 à 7.
- **Phase 2** : modèle de flux (`shared/src/flux.js`), migration 017 testée sur copie, conversion idempotente des définitions personnelles, modèle système réécrit en 12 + 4/8. Scénario 192 vert à 1280/1440 px (aucune intersection, KPI 4 sur une ligne). QA vert : 766 Vitest, 11 API, 173 Playwright, lint/styles/a11y. Reste : cadre/widget, visualisations, impression, galerie, recette.
- **Phase 3** : barre d’outils unique avec menu **Affichage** libellé (zoom/largeur), actions de widget compactées dans ⋯, poignées `deplacement`/`largeur` sur les bords, hauteur `auto` sans badge « Contenu masqué », grille responsive 12/6/1 et min 240 px. Scénarios 192 et 193 verts (clavier, annuler/rétablir, 768/390 px sans débordement). QA vert : 766 Vitest/74 fichiers, 11 API, 174 Playwright, lint (1 avertissement préexistant), styles et a11y. Reste : visualisations (S4/S5), impression (S1/S2/S3/S7), galerie (S9), recette.
- **Phase 4** : anneau avec total centré dans le SVG et légende complète non tronquée ; tableau avec dimension en première colonne, toutes lignes visibles, barres horizontales étiquetées. `colonnesAffichees` accepte les ids de résultat et impose dimensions avant mesures. Scénarios 194-195 verts. QA vert : 768 Vitest/74 fichiers, 11 API, 177 Playwright, lint/styles/a11y. Reste : impression (S1/S2/S3/S7), galerie (S9), recette.
