# PLAN V12 — Phase par phase

## Phase 1 — Audit, correctifs D1–D5, retrait Vérification, Sans suite, catalogue, migration 010
1. Créer `AUDIT_V12.md` (audit de l'existant V11 + cause + correctif + test pour D1–D5)
2. Créer `DECISIONS.md` (décisions structurantes V12)
3. Migration SQL `013_agents_photos.sql` (tables affectations_agents, colonnes anomalies, users.agent_id, pieces_jointes.role, miniatures, EXIF, etc.)
4. Supprimer colonne Vérification de la liste (UI + filtres + onglet + actions groupées) ; onglets : Tout, Non traitées, En cours, Traitées, Urgentes, En retard, Non affectées, Mes anomalies
5. Formulaire création : champ Vérification retiré ; statut initial = Non traité ; section "Options avancées" (statut, dates) visible seulement admin
6. Paramètre `exiger_verification` = 0 (fixé, masqué) ; règle métier : passage en cours/traité ne demande plus vérification
7. Action « Sans suite » (motif obligatoire, admin/opérateur) → `verification='infirmee'` (exclue stats par défaut, option inclure sans-suite)
8. Catalogue : mesures vérification dépréciées (non proposées, lisibles pour éditions figées) ; nouvelles mesures : `non_affectees`, `delai_prise_en_charge`, `charge_agent`, `taux_traitement_par_agent`, `taux_photo_avant`, `taux_photo_apres`
9. Correctifs D1–D5 : i18n `import.button` ; pastille Statut visible ; Référence nowrap + largeurs ; en-têtes homogènes ; suppression onglet/colonne Vérification
10. Tests : scénarios 156 + précédents verts ; `npm run qa` vert

## Phase 2 — Agents & affectation automatique par daïra
1. Modèle `affectations_agents` (titulaire/suppléant, unicité titulaire actif par daïra, historique)
2. Service unique `affecterAgent(anomalie)` : auto à création/import, suppléant si titulaire inactif, non affectée si aucun, réaffectation si daïra change (non traitée), conservation si traitée
3. Surcharge manuelle avec motif → `agent_source='manuel'` (non écrasée par auto) ; avertissement rétablissement
4. Changement titulaire/supplaéant (admin) : aperçu + confirmation explicite
5. Écran admin `#/admin/agents` : 14 daïras, titulaire/supplaéant, charge, anomalies ouvertes, import CSV, aperçu, historique, gestion agents (créer, désactiver, lier compte)
6. Onglet « Mes anomalies » (filtre agent lié au compte) + cloche « Nouvelle anomalie affectée »
7. Outil admin « Affecter les anomalies existantes » (aperçu puis confirmation)
7. Tests : scénarios 157–162

## Phase 3 — Photos avant / après
1. `pieces_jointes.role IN ('avant','apres','autre')`, `principale`, `legende`, `prise_le`, `gps_lat/lng`, `miniature_chemin`
2. Upload : MIME + signature binaire jpg/png/webp ≤ 5 Mo ; ≤ 5 avant, ≤ 5 après ; miniatures 320px serveur ; EXIF extrait (date/GPS → suggestion) puis purgé du fichier servi ; route authentifiée `/api/photos/:id/{thumb|file}` ; inclus dans backup/restore
3. Création : zone Photo avant (drag-drop, multi, capture mobile, collage, vignettes, légende, principale, suppression, lecture EXIF navigateur)
4. Passage « Traité » : dialogue avec sélecteur photo après (choisir parmi photos anomalie en les marquant « après » OU upload/photo) ; obligatoire par défaut (`photo_apres_obligatoire=1`) ; case « Sans photo » + motif obligatoire
5. Fiche : bloc Avant/Après comparateur à curseur, légendes, dates, téléchargement, plein écran ; historique photos
6. Liste : colonne Photos (2 vignettes ou icônes + compteur) ; ⚠ si traitée sans photo après
7. Synthèses/impression : widget Avant/Après, KPI `taux_photo_avant/apres` ; PDF vignettes, Excel liens
8. Tests : scénarios 163, 164, 167

## Phase 4 — Page à la création (réseaux sociaux V9)
1. Source : combobox recherche normalisée (arabe/latin) sur nom, URL, identifiant, commune ; pastille réseau/nature/commune
2. Suggestion auto depuis URL publication (slug/identifiant connu) ; suggestion commune/daïra depuis page (puce "Suggérée — appliquer ?")
3. "+ Ajouter cette page" : tiroir pré-rempli (réseau/nature détectés, nom, URL page déduite, commune anomalie) ; contrôle doublon live ; "Enregistrer et sélectionner" / "Annuler" ; page créée sélectionnée auto
4. Droits : admin crée tout ; opérateur crée pages/groupes (statut "à vérifier", file "À qualifier" admin), pas profil ; profil respect protection V9
5. Enregistrement `source_reseau_id` ; stats anomalies par page/réseau
6. Sans V9 : table `reseaux_sources` minimale (V9 § B2)
7. Tests : scénario 165

## Phase 5 — Intégrations catalogue/Lab/impression, recette finale
1. Mesures dépréciées non proposées (lisibles éditions figées) ; nouvelles mesures exactes
2. Widget Avant/Après (paires traitées période, nb/page réglable, tailles explicites, jamais coupées impression)
3. KPI `taux_photo_apres`, `non_affectees`, `charge_agent`
4. Recette finale : captures FR/AR × clair/sombre × 390/768/1024/1440 ; géométrie liste (rien tronqué) ; rechargement dur sans blanc
5. README + `AUDIT_V12.md` complet
6. `npm run qa` vert ; scénarios 156–168 verts

---

Ordre d'exécution : Phase 1 → validation → Phase 2 → validation → Phase 3 → validation → Phase 4 → validation → Phase 5 → livraison.