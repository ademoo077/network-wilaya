# AUDIT V11 — KPI, colonnes et impression organisée

Date : 18/11/2026. Références : prompt V11, `docs/SPEC_V8.md`, `PLAN.md`, `DECISIONS.md`, audits V9/V10.
État de départ : tag `avant-v11` (`dd30f1e`). Un constat n'est clos qu'après correction et preuve navigateur géométrique rouge → vert.

## 1. Constats des captures

| # | Cause réelle confirmée dans le code | Correctif et preuve exigés | État |
|---|---|---|---|
| P1 | `normaliserLayout()` borne les coordonnées mais ne résout aucun chevauchement. `deplacerWidget()` et `redimensionnerWidget()` ne poussent que les voisins directement touchés, sans cascade ni compactage. | Normaliseur partagé déterministe, résolution transitive, compactage vertical et 50 dispositions aléatoires sans intersection ; scénario 142. | Corrigé (phase 1) |
| P2 | `layout.h` impose des lignes de 40 px sans mesurer le DOM. Une carte plus haute déborde de sa zone ; le KPI et sa barre d'actions peuvent alors passer sous le widget suivant. | Hauteur automatique par défaut avec `ResizeObserver`, bornes configurables, mode fixe signalant tout débordement ; assertions `scrollHeight/clientHeight`. | Corrigé (phase 1) |
| P3 | Six actions vivent dans chaque `CardHeader` et se replient ; les commandes d'édition sont en plus positionnées en absolu au-dessus de la carte. | Barre compacte en flux, icônes seules et menu « … » ; déplacement/redimensionnement et menu ne recouvrent jamais le contenu. | Corrigé (phase 1) |
| P4 | Un anneau sans lignes dessine un `PieChart` vide. Le chargement repose sur un conteneur responsive dont la géométrie peut être nulle après collision. | État fantôme explicite, dimensions garanties et repli en légende ; test période vide et redimensionnement. | À faire |
| P5 | `OfficialPrintDocument` enveloppe directement `SyntheseCanvas`/`StudioGrid`. Le CSS d'impression conserve donc les positions et hauteurs de l'écran ; aucune mesure réelle ne précède `decouperEnPages()`. | Vue et arbre d'impression dédiés : évaluation, mesure, pagination pure, pages statiques sans contrôle ni ascenseur. | À faire |
| P6 | `createPrintSettings()` initialise `reference: ''` et le rendu remplace le vide par « — ». L'en-tête est une grille souple dont les textes peuvent se tronquer. | Référence unique générée et grille fixe à trois colonnes égales, période non sécable ; tests FR/AR. | À faire |
| P7 | Les cartes d'écran (`rounded-lg`, `shadow-1`) sont réutilisées dans le document ; seule la feuille externe perd son ombre. | Composants statiques d'impression, filets fins, sans ombre ni gros arrondis. | À faire |

## 2. Constats complémentaires

| # | Cause réelle confirmée | Risque / correctif | État |
|---|---|---|---|
| A1 | Le repli générique de `ErrorBoundary` impose `min-height: 60vh`, même lorsqu'il entoure un seul widget. | Une erreur locale peut créer un chevauchement massif ; ajouter un repli compact par widget. | Corrigé (phase 1) |
| A2 | `options.hauteur` désigne à la fois une variante visuelle (`compacte/normale/grande`) et, dans `layout.js`, une hauteur entière. | Séparer la hauteur de grille mesurée (`h` / `hauteur_cellules`) des options de présentation. | Corrigé (phase 1) |
| A3 | La suppression filtre le bloc puis reconvertit la grille, mais ne comble pas le trou laissé dans `layout`. | Compacter après ajout, suppression, déplacement, redimensionnement et ouverture d'un ancien projet. | Corrigé (phase 1) |
| A4 | Les tableaux ont `max-height: 56vh` et `overflow:auto`; le document imprimé hérite de cette structure. | Supprimer le défilement en hauteur pour les widgets auto et découper les tableaux par lignes à l'impression. | Écran corrigé ; impression phase 4 |
| A5 | `decouperEnPages()` ne connaît que `y/h` théoriques, ni hauteurs mesurées, ni lignes de tableau, ni format/marges. | Remplacer pour l'impression par `paginer(blocs, page)` pur, multi-format et testé. | À faire |
| A6 | Il n'existe ni route `#/imprimer/:id`, ni rendu PDF serveur, ni drapeau `window.__imprimerPret`. | Ajouter le pipeline dédié et conserver le repli d'impression navigateur. | À faire |
| A7 | Les définitions de tableaux ne portent aucune configuration de colonnes. | Ajouter un schéma partagé et un sélecteur sans exposer les champs sensibles. | À faire |
| A8 | Le catalogue actif ne contient que `anomalies`; les mesures « réseaux sociaux/couverture » et les jeux importés annoncés dans le préambule V11 ne sont pas raccordés. | Les ajouter par adaptateurs du moteur unique avant de les proposer dans la bibliothèque KPI. | À faire |
| A9 | `009_veille.sql`, `010_syntheses.sql`, `011` et `012` sont déjà appliquées. | Ne jamais créer `009_impression.sql`; utiliser la migration additive `013_impression.sql`. | Décidé |
| A10 | Les snapshots figés stockent bien leurs blocs/résultats, mais le dialogue d'édition utilise une grille générique distincte du futur moteur d'impression. | Le nouveau pipeline lira le snapshot sans jamais le réécrire. | À faire |
| A11 | Après recompilation du client, un processus serveur non redémarré applique encore l'ancien schéma Zod strict et répond « Modèle invalide » au champ V11 `layout.compactage`. | Ne pas sérialiser la valeur par défaut et réessayer sans l'extension inconnue ; garder un bouton de reprise sans afficher le message générique. | Corrigé (phase 1) |

## 3. Invariants de mise en œuvre

- Un seul moteur de calcul : catalogue et règles dans `shared/`, SQL et agrégations dans `server/`.
- Le normaliseur d'écran ne modifie jamais un snapshot d'édition figée.
- La vue d'impression ne rend aucun composant interactif, même masqué par CSS.
- Les tests navigateur utilisent la fixture isolée existante et des assertions de rectangles, rognage et débordement.
- Les fichiers réels non suivis (`docs/base de données réseaux sociaux (2).xlsx`, `docs/screens/e.s`) restent intacts et hors commits.
