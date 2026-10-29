# AUDIT — Plateforme de suivi des anomalies (V1)

Date : 2026-10-29. Base : code source + exécution réelle (`npm run build`, `npm start`, `npm test` : 24/24 verts, lint 0 erreur).

## 1. Build / runtime
- `npm run build` OK (841 modules, chunk ~713 ko gzip — à découper par route).
- `npm start` OK, /api/health 200, login admin OK, taxonomie seedée 70/156.
- Aucune erreur serveur sur les parcours principaux. Rate limit + CSP actifs.

## 2. Constats par écran

### Global (client/src/components/Layout.jsx, App.jsx)
- Navigation brute : liens soulignés, pas d'icônes, pas d'indicateur actif, pas de logo.
- Aucun sélecteur FR/AR visible → RTL non vérifiable à l'UI (le contexte i18n existe dans client/src/i18n/index.jsx mais aucun toggle).
- Pas de bascule thème clair/sombre (tokens sombres absents).
- Rapport et Administration absents de la navigation ; page Administration inexistante côté client.
- Textes FR sans accents : client/src/i18n/index.jsx (lignes 5,6,12,13,21,23-26,32,34,35,45,49-54) : "Repartition", "Evolution", "Recues", "Traitees", "Deconnexion", "Details", "Delai", "Par categorie".
- Accents absents aussi dans les composants (Dashboard, AnomaliesList, Rapport).
- Pas de conteneur centré sur la page Anomalies (Layout main = p-4, pas de max-width).

### Dashboard (client/src/pages/Dashboard.jsx)
- Graphiques : ResponsiveContainer height={260/300} mais parents flex/grid sans hauteur explicite → risque de hauteur 0 ; pas d'état vide (quand données à 0, l'anneau s'affiche vide sans message).
- Seulement 4 KPI (Total, Taux, En retard, Urgentes) — manquent Non traitées, En cours, Traitées, Délai moyen.
- Pas de filtre de période, pas de graphiques par type/daïra/commune/EPIC, pas de tableau Catégorie→Type.
- categoryData ne transporte pas domaine_id → drill-down inopérant.

### Liste des anomalies (client/src/pages/AnomaliesList.jsx)
- Pagination illisible : boutons "G"/"P" (lignes 136,138) au lieu de Précédent/Suivant + icônes.
- Filtres : premier select sans libellé (statut), pas de filtre période/vérification/plateforme/commune/agent.
- Colonnes manquantes : Référence, Commune, Vérification, Priorité, actions par ligne.
- Pas de bouton Export ni "Nouvelle anomalie" visible, pas d'état vide illustré.
- Tableau non responsive avant Phase 7 (corrigé).

### Carte (client/src/pages/Map.jsx)
- Conteneur 60vh, fond gris si tuiles échouent ; pas de message de repli, pas de filtres, pas de légende, pas de liste latérale.
- Marqueurs en divIcon colorés OK mais clustering absent.

### Formulaire Nouvelle anomalie (client/src/pages/AnomalyQuickCreate.jsx)
- Observations = <input> (ligne 152) au lieu de <textarea>.
- EPIC placeholder t('all') (ligne 124) au lieu de "Non affecté".
- Pas de date de signalement/publication, vérification, agent, dates intervention/traitement, "Ma position", détection de doublon, "Enregistrer et nouveau".
- Grille hétérogène.

### Fiche détail
- Absente côté client (aucune page Detail).

### Administration
- Page absente côté client ; API admin existe (server/src/routes/admin*.js).

### Rapport
- Page présente (Rapport.jsx) mais absente du menu ; pas de CSS d'impression A4.

## 3. Design / UX
- Aucun design system : styles ad hoc dans les pages, pas de tokens, pas de composants ui/.
- Polices système uniquement (pas Inter/Cairo embarqués).
- Icônes : pas de librairie (lucide non installé).
- Pas d'animations, pas d'états chargement/erreur/empty.

## 4. i18n
- Pas de test de parité FR/AR.
- Clés manquantes pour plusieurs libellés (statut, urgentes, etc.) → fallback sur la clé.
- RTL : dir mis à jour mais composants utilisent left/right au lieu de propriétés logiques.

## 5. Performance
- Bundle initial 713 ko gzip (carte + recharts non découpés par route).

## 6. Accessibilité
- Pas de focus visible personnalisé, pas d'aria-label sur boutons-icônes, statuts par couleur seule dans certains endroits.

## Conclusion
V1 fonctionnelle côté API et données, mais UI minimale, accents manquants, graphiques à risque, pages manquantes (Admin, Détail), pas de design system. Phase B → F à exécuter.