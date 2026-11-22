# AUDIT_V13.md —Plateforme de suivi des anomalies (V13)

Point de départ : tag `avant-v13` créé après consolidation V11/V12 (`e0e3c39` + arbre de travail). Le QA V12 est vert : 643 tests Vitest, 11 scénarios API, 141 scénarios Playwright. Version produit inchangée (`5.0.0`). Les captures F1–F8 ont été confrontées au code réel.

## 1. Constats et causes

| ID | Constat | Cause réelle relevée dans le code | Correctif prévu | Preuve |
|---|---|---|---|---|
| F1 | 4 images présentes dans « Pièces jointes » mais comparateur vide | `PhotoComparison` filtre uniquement `role === 'avant'/'apres'` ; les pièces historiques ont `role = 'autre'` (défaut 013). Elles ne sont donc jamais affichées. | Toute image est une photo : galerie unique, classement Avant/Après/Non classée, réutilisation des pièces existantes sans perte. | Scénario 169 + test Vitest `photos-v13` |
| F2 | `Par daÃ¯ra.png` | Multer/Busboy décode les noms multipart en latin1 ; `attachments.js` stocke `file.originalname` brut dans `nom_original`. | Décodage latin1→UTF-8 contrôlé, assainissement du nom d’affichage, stockage physique en UUID (déjà en place), test accents/arabe/emoji. | Scénario 170 + test serveur |
| F3 | Suppression immédiate, pièces en texte | `PhotoAttachments` et `PhotoComparison` appellent `DELETE /pieces/:id` sans confirmation ; aucun type de document distinct. | Dialogue de confirmation avec « Annuler » (toast), icône/taille/date/auteur pour les documents. | Scénarios 169/170 |
| F4 | Historique brut (`non_traite`, ISO, `— → EGCTU`) | La timeline rend `champ/ancien/nouveau` tels quels ; `HISTORY_FIELDS` stocke les codes techniques. | Formateur partagé dans `shared/`, regroupement par minute/auteur, libellés FR/AR, `JJ/MM/AAAA`, citation du motif. | Scénario 175 |
| F5 | Colonne Photos vide, en-têtes en casse mixte, tableau coupé, Statut vide, hauteurs inégales | `AnomalyTable` utilise des libellés hétérogènes, des colonnes auto, un rendu StatusBadge conditionnel et des cellules sans hauteur réservée. | Préréglage Standard 1280 px, colonnes fixes, conteneur à défilement interne pour Complet, vignettes 48×48 avec placeholders, lignes 64/48 px, en-têtes uniformes sticky. | Scénarios 171/172 |
| F6 | « Vérification, agent et intervenant requis » dans Options avancées | `fr-v6.json` (`form.statusHelp`, `form.statusBlocked`) et `ProcessingSection` calculent `permitted` avec `agent_id` ; `formNeedsReason` vient d’une règle séparée. | `exigencesStatut(statut)` dans `shared/statut.js` unique source ; libellés de menu dérivés ; agent automatique en lecture seule ; intervenant unique conditionnel. | Scénario 174 |
| F7 | Aide des raccourcis coupée, vide en bas | La barre d’actions du formulaire et le conteneur de page ne réservent pas la hauteur de l’aide, marge finale excessive. | Aide visible ou infobulle ⓘ, barre haute fixe, page à hauteur adaptée. | Scénario 174 |
| F8 | Filtres ≈300 px | `AnomalyFilters` affiche tous les champs en permanence. | Barre compacte + « Plus de filtres (n) », puces actives, période unique, filtres dans l’URL. | Scénario 173 |

## 2. Écarts found pendant l’audit

- **Numérotation** : le prompt demande `011_photos.sql`, mais `011_reseaux_sociaux.sql`, `012_reseaux_sociaux_workflow.sql` et `013_agents_photos.sql` sont appliqués. V13 utilisera **`014_photos_pipeline.sql`** ; aucun numéro n’est réécrit.
- **Résidu V12** : `client/src/features/setup/SettingsStep.jsx` affiche encore une case `exiger_verification` avec `t('field.verification')` ; `fr-v6.json`, `fr.json`, `ar.json` contiennent des libellés « Vérification », « Date de vérification », `form.processing`, `detail.confirm`, `audit.ANOMALIE_VERIFICATION`. Ils sont retirés du flux anomalie (le module séparé « répertoire social » garde son contrôle de fiche, décision explicitée).
- **Actions/API** : `POST /api/anomalies/:id/verification` et le code audit `ANOMALIE_VERIFICATION` subsistent ; ils deviennent inaccessibles depuis l’UI anomalie et leurs messages sont renommés ou supprimés. La colonne base et les éditions figées ne sont pas modifiées.
- **Règles en dur** : `ProcessingSection` (`permitted`, `form.statusBlocked`) et `validerEtat` dupliquent les exigences ; les deux doivent consommer `exigencesStatut`.
- **Migration 013 déjà appliquée sur la base live** sans `sans_photo_motif` (contexte V12) : la copie de vérification V13 part de 012 reconstituée, comme pour 013. Aucune donnée réelle n’est touchée.
- **Images** : aucun dérivé 800/1600, aucun aperçu flou, aucune dimension stockée, pas d’ETag/`Cache-Control`, pas de dossier de dérivés, pas de recalcul des 31 pièces existantes. Le stockage reste privé derrière `/api/photos/:id/*`.
- **CLS** : les `<img>` de vignettes n’ont pas de ratio réservé ; le comparateur et la liste doivent utiliser `largeur/hauteur` et un placeholder flou.
- **Taille des fichiers** : `AnomalyDetailPage.jsx`, `AnomaliesPage.jsx`, `AnomalyTable.jsx`, `PhotoComparison.jsx` dépassent déjà 300 lignes ; V13 extrait les nouveaux blocs dans des composants dédiés (< 300 lignes).

## 3. Méthode de mesure

Chaque phase suit le cycle rouge → vert dans le navigateur réel Playwright (fixture isolée, pas de `webServer`) avec : `naturalWidth > 0` pour toutes les images, CLS<0,1 via `PerformanceObserver`, absence de troncature/supposition, `documentElement.scrollWidth <= clientWidth`, rechargement dur sans blanc, axe, FR/AR × clair/sombre, puis `npm run qa` complet. Les captures de non-régression sont versées dans `docs/captures-v13/`. Aucun test n’est ignoré ni affaibli ; chaque correctif ajoute une régression ciblée.


## 4. État d’avancement V13
- **Phase 1** : source unique `exigencesStatut`, suppression des libellés « vérification » du flux anomalie, agent automatique en lecture seule, motif, intervenant conditionnel et barre d’actions — QA vert (143 Playwright).
- **Phase 2** : migration `014_photos_pipeline.sql`, pipeline `sharp`, variantes 320/800/1600, aperçu flou, ETag et cache immuable — QA vert (144 Playwright).
- **Phase 3** : panneau Photos unifié, comparateur à trois modes, visionneuse plein écran, galerie, upload et ZIP — QA vert (146 Playwright).
- **Phase 4** : liste Standard/Complet, colonnes et densité persistées, aperçu rapide avec comparateur, navigation clavier, squelette, erreur récupérable, période unique et RTL sans débordement — QA vert (150 Playwright).
- **Phase 5** : historique lisible — formateur partagé `shared/src/historique.js` (libellés FR/AR, dates `JJ/MM/AAAA`, statuts/priorités/classement traduits, identifiants masqués, motif en citation, regroupement par minute/auteur), composant `HistoryTimeline` avec icône par type, remplacé dans la fiche. Correctif images : `piecePayload` fournit toujours une URL de vignette et `getPieceThumb` sert l'original en repli pour les pièces historiques sans dérivé (base encore en 013), avec le bon MIME. Régression : `shared/tests/historique.test.js` (10), `server/tests/photos-legacy-fallback.test.js`, `tests/e2e/v13-history.spec.js` (FR/AR, axe, sans débordement). QA vert (670 tests Vitest, 150 Playwright).
- **Phase 7** : recette finale — matrice FR/AR × clair/sombre × 390/768/1024/1280/1440 (scénario 177), rechargements durs et non-régression V4–V12 (scénario 178), captures dans `docs/captures-v13/`. Correctifs CLS : préchargement de la police Inter, largeur stable du badge de compteurs, en-tête `self-start`, grille des synthèses `auto 1fr`. QA vert.
- **Reste** : rien.


## 5. Phase 5 — état
- Historique lisible livré : filtre par type, avatar, temps relatif + date exacte, motif en citation, absence de valeurs techniques et de mention « vérification » à l’écran.
- Blocs Agent/Source/GPS livrés dans la colonne latérale collante ; réaffectation motivée fonctionnelle et testée sur base isolée.
- Scénario 175 étendu et vert ; QA complet vert après correction d’un sélecteur de test devenu ambigu (option « الحالة » du filtre d’historique).

## 6. Phase 6 - syntheses et impression
- Widget Avant/Apres livre avec legende complete (reference, commune/daira, dates, intervenant), deux paires par ligne, dimensions reservees et nombre par page reglable.
- Apercu/impression sans coupure : les paires portent break-inside: avoid ; la planche PDF A4 est generatee cote serveur sans dependance ni ressource distante.
- Export Excel : la colonne Lien est un hyperlien reel, sans URL visible dans la cellule ; le CSV conserve l URL brute.
- Liste : vue Galerie ajoutee, largeurs de colonnes redimensionnables et persistees par utilisateur.
- HEIC/HEIF convertis en JPEG par le pipeline ; scenario 176 et sa regression HEIC verts, QA complet vert (672 Vitest, 11 scenarios API, 152 Playwright).


## 7. Phase 7 — recette finale
- Scénario 177 : matrice FR/AR × clair/sombre × 390/768/1024/1280/1440 sur la liste, la fiche photos et les synthèses — direction RTL, thème appliqué, aucune erreur, aucun débordement horizontal, CLS < 0,1, images chargées (`naturalWidth > 0`), axe (WCAG) sur la fiche à chaque combinaison.
- Scénario 178 : rechargements durs (3×) sur tableau de bord, liste, fiche, création, synthèses, carte, rapport, réseaux sociaux, veille et administration ; non-régression V4–V12 (KPI, carte Leaflet, comparateur avant/après, bouton « Sans suite », options avancées sans mention « vérification », modèles de synthèse) ; aucun débordement sur les largeurs cibles.
- Correctifs trouvés par la recette : (1) CLS de basculement de la police Inter — police latin auto-hébergée et préchargée dans `index.html` ; (2) CLS du badge de compteurs des vues rapides — largeur fixe `w-6` + `tabular-nums` ; (3) CLS de l'en-tête étiré dans une grille `min-h-dvh` — `self-start` sur `PageHeader` ; (4) CLS de la page Synthèses — grille `grid-rows-[auto_1fr]`.
- Captures : `npm run captures:v13` régénère `docs/captures-v13/` (9 écrans : liste FR clair 1440/390, liste AR sombre, fiche photos FR clair/sombre, fiche AR sombre, création avancée, synthèses, tableau de bord mobile sombre).
- QA complet vert : 672 tests Vitest (67 fichiers), 11 scénarios API, 154 scénarios Playwright, `lint`, `check:styles`, `check:a11y`.

## 8. Correctifs après mise en service (22/11/2026)
- **Liste chouvochée** : `table-fixed` n'avait aucune largeur par défaut, chaque colonne recevait ~95 px à 1440 et le contenu (référence, photos, catégorie) débordait sur la colonne voisine (125 éléments en débordement). Largeurs initiales ajoutées dans `useListPreferences.js` (avec repli si une préférence vide avait été enregistrée), cellules `min-w-0 overflow-hidden`, référence tronquée avec `title`. Régression R1.
- **Aperçu de la fiche sans photos** : le comparateur n'apparaissait que si une pièce avait le rôle `avant` ou `apres`. Les 36 pièces de la base live ont le rôle `autre` (imports antérieurs au pipeline). L'aperçu charge désormais `/anomalies/:id/pieces` et propose les pièces existantes comme avant/après **sans écrire en base**. Régression R2.
- **Test sensible à la date** : `report-studio.spec.js` comparait « Revenir à cette semaine » à la constante `2026-11-15` ; il calcule maintenant la semaine courante avec `todayAlgiers()`/`weekStart()` (aucune assertion affaiblie).
- QA complet vert : 672 Vitest (67 fichiers), 11 scénarios API, 156 Playwright, `lint`, `check:styles`, `check:a11y`. Serveur de production sur `3000` servant le build courant.