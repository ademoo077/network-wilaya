# AUDIT V3 — Correctifs thème, contraste, Administration, Rapport, Carte

Date : 2026-10-29. Base : exécution réelle + grep des couleurs en dur.

## 1. Thème sombre à moitié appliqué
Occurrences hors `tokens.css` et `components/ui/` (grep) :
- `client/src/pages/Rapport.jsx` : `bg-white`, `bg-gray-100/50/200`, `text-gray-500`, `bg-blue-600`, `bg-green-600`, `text-red-700` (lignes 55,58,65,69,74-77,81-84,88,91,112,115).
- `client/src/pages/Admin.jsx` : `bg-gray-100`, `bg-blue-600`, `bg-green-600`, `bg-gray-200`, `text-blue-600`, `border-gray-200/700`, `text-gray-500` (lignes 55,57-59,64,66,69,76,79).
- `client/src/pages/AnomalyQuickCreate.jsx` : `bg-white dark:bg-gray-800`, `bg-red-50 text-red-700`, `bg-blue-600 text-white`, `bg-gray-200 dark:bg-gray-700` (lignes 85,87,155,158).
- `client/src/pages/Detail.jsx` : `bg-white dark:bg-gray-800`, `text-gray-500`, `text-blue-600`, `border-gray-200 dark:border-gray-700`, `text-gray-500` (lignes 17,18,24-37,44,48).
- `client/src/pages/Map.jsx` : `bg-gray-100 dark:bg-gray-800`, `text-gray-600 dark:text-gray-300` (ligne 60).
- `client/src/pages/Dashboard.jsx` : `bg-[var(--brand-600)] text-white` OK (tokens), mais `#dc2626` etc. en const STATUS_COLORS (acceptable, couleurs de statut).
- `client/src/App.jsx` : `bg-gray-100` (ligne 43) loading fallback.
- `client/src/components/Layout.jsx` : sidebar utilise tokens OK, mais `text-white/70`, `border-white/10` (acceptable sur fond brand).

Cause racine : migration partielle vers les tokens ; beaucoup de classes Tailwind brutes restantes.

## 2. Layout
- Débordement horizontal : `main` a `max-w-[1480px] mx-auto w-full` mais le header `sticky top-0` n'a pas de conteneur ; le bouton « Déconnexion » peut déborder si la sidebar prend de la place. Cause : flex sans `min-w-0` sur la colonne principale et largeur du header non contrainte.
- Pas d'état actif dans le menu (navItems rendus sans aria-current / classe active).
- « Nouvelle anomalie » est un item doré permanent dans le menu (devrait être CTA séparé).
- Motif sidebar : SVG losanges (polygones) au lieu de l'étoile à 8 branches ; opacité 0.06 mais tuile visible avec coutures.
- Pied de sidebar : « admin · admin » (identifiant répété) au lieu de nom + rôle + avatar.
- Topbar : pas de fil d'Ariane, pas de recherche globale, pas de menu utilisateur, pas d'infobulles.

## 3. Rapport
- Seulement 4 KPI (Total, Taux, En retard, Urgentes) au lieu de 8.
- Pas de sélecteur de semaine (précédente/suivante), pas de comparaison vs semaine précédente.
- Pas de pourcentages visibles, pas de graphiques, pas de tableaux par type/daïra/commune/EPIC, pas de bloc signature.
- Dates en ISO (`2026-10-25`, `2026-10-29T12:51:23.899Z`).
- Boutons d'action mal hiérarchisés (certains illisibles en thème sombre).

## 4. Administration
- Page ne contient que Sauvegardes + Journal d'audit + boutons d'export. Manquent : référentiels, utilisateurs, paramètres, import CSV.
- 12 sauvegardes `anomalies-20261029-NNNNNN.db` avec suffixe aléatoire, une seule ligne d'audit BACKUP_CREATE → tests créent des sauvegardes dans le vrai dossier (les tests admin.test.js appellent POST /api/admin/backup). Cause : tests non isolés (BACKUP_DIR non redéfini).
- « Restaurer » sans confirmation.
- Liste sans date lisible, taille, téléchargement, pagination.
- Journal d'audit : colonnes avec clés techniques (BACKUP_CREATE), dates ISO, pas de filtres.

## 5. Carte
- Pas de panneau latéral, filtres, légende.
- Repli hors-ligne : bannière grise claire.
- Attribution Leaflet avec préfixe par défaut.

## 6. i18n / formats
- Accents manquants : "Par categorie", "Total receptions", "Reference", "Entite", "Deconnexion", "Repartition", "Evolution", "Recues", "Traitees", "Details", "Delai".
- Dates en ISO partout (audit, rapport, liste).
- Pas de test de contraste / check:styles.

## 7. Routes / navigation
- `#quick` affiche la carte dans certaines captures : à vérifier (App.jsx gère view state, pas hash). Le hash n'est pas utilisé pour le routing ; le bouton "Nouvelle anomalie" dans AnomaliesList fait `window.location.hash = '#quick'` sans changer la vue → incohérence. Cause : mélange hash ↔ state.

## Conclusion
V3 = migration complète vers les tokens + layout fix + rapport refonte + admin complet + carte panneau + garde-fous (check:styles, check:a11y) + formats de dates. Phases A→G.