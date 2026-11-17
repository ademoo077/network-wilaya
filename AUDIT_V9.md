# AUDIT V9 — Studio de synthèses et base des réseaux sociaux

Date : 17/11/2026. Références : prompt V9, docs/SPEC_V8.md, PLAN.md, DECISIONS.md.
État de départ : tag avant-v9 (HEAD 91b6f94). Règle : un constat n'est clos que s'il est corrigé et couvert par un test navigateur réel.

## 1. Partie A — Studio de synthese (#/rapport?semaine=)

| # | Constat | Cause reelle dans le code | Correctif | Etat |
|---|---|---|---|---|
| L1 | Trois widgets ecrases dans une grille de 3-4 colonnes egales | SyntheseCanvas.jsx utilise sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ; WIDTH_CLASSES (double, pleine) ; le modele hebdomadaire ne porte aucun options.largeur | Grille reelle a 12 colonnes ; KPI span 12, anneau span 4, par daira span 8 ; modele systeme corrige | Corrigé |
| L2 | KPI en pastilles, libelles tronques et valeurs coupees | WidgetCard.jsx / KpiWidget : break-words, text-3xl fixe, grille 2/4 colonnes | repeat(auto-fit, minmax(150px, 1fr)), whitespace-nowrap, tabular-nums, libelle sur deux lignes | Corrigé |
| L3 | Anneau rogne a droite et en bas | AnneauChart : rayons fixes 68/94, Legend dans le meme ResponsiveContainer, hauteur generique | Conteneur a hauteur explicite, rayon borne, total central, legende sous l'anneau avec n et % | Corrigé |
| L4 | Tableau tronque, defilement horizontal et Page 1 / 1 inutile | TableauWidget : min-w-full, overflow-auto, pagination inconditionnelle | Pas de scroll horizontal >= 1024 px, pagination masquee si une seule page | Corrigé |
| L5 | Feuille bloquee a ~900 px sur grand ecran | Aucun reglage de largeur d'affichage ; data-print-document impose une largeur unique | Reglage Ecran large (defaut, 1280 px) / Fidele a l'impression (A4) / Plein ecran ; barre compacte libérant menu et topbar ; impression A4 avec largeurs de blocs respectees | Corrigé |
| L11 | Apercu d'impression generique et regles A4 non lisibles | PrintCustomizer affichait trois rectangles factices ; la feuille forçait 2 ou 3 colonnes egales ecrasant les blocs doubles et pleins | Apercu A4 reel avec titres de blocs et orientation ; champs groupes et reinitialisables ; grille d'impression 12 colonnes avec spans portrait/paysage, en-tetes repetes et filigrane masque | Corrigé |
| L12 | Contenu des petites cartes compresse et debordant | Card.jsx imposait `shrink-0` sur l'action de l'en-tete : les six boutons tenaient a peine dans une carte de 4 colonnes et debordaient de 103 px | L'action peut desormais se reduire et ses boutons se replient ; le scenario 113 verifie que toutes les cartes ont `scrollWidth <= clientWidth` | Corrigé |
| L13 | Graphes sans cles durables et rendu A4 peu professionnel | Legers `<Legend />` Recharts dans le SVG, aucun total, hauteur d'impression limitee a 65 mm, tete/pied de page invisibles pendant la creation | Legendes HTML accessibles avec couleur, libelle et total, valeurs sur barres simples, axes stylees, bouton « Apercu A4 » montrant la tete et le pied de page des la personnalisation | Corrigé |
| L6 | Texte technique visible (Blocs de données du catalogue contrôlé, SQL) | fr-v8.json : synthese.subtitle, lab.subtitle, lab.builderHelp | Description orientee utilisateur, zero jargon technique a l'ecran | Corrigé |
| L7 | Bandeau d'en-tete tres haut, boutons redondants | ReportPage.jsx : bandeau debute p-5/sm:p-6 + titre 3xl + seconde barre d'outils ; onglet report.studio.official | En-tete compact <= 140 px, une seule barre d'outils collante, onglet Editions | Corrigé |
| L8 | Bord gauche de la barre laterale rogne | index.css : .sidebar-pattern { overflow: hidden } coupe les entrees en RTL et les ombres | Retirer le masquage du conteneur, garder le motif dans ::after | Corrigé |
| L9 | Chaque widget n'a que le bouton CSV | WidgetCard.jsx / DataActions : deux actions seulement | Barre d'actions : information, donnees, fiches, plein ecran, export CSV/PNG avec aria-label | Corrigé |
| L10 | Etiquettes Systeme / Modele systeme repetees | SyntheseCanvas.jsx : Chip portee + Chip cle_systeme ; synthese.modeleSystemeDesc a cote | Une seule etiquette : Modele systeme (non modifiable — Personnaliser cree votre copie) | Corrigé |

## 2. Parties B et C — etat deja livre et ecarts

Deja livre et verifie (commit 14524c1) : annuaire manual comptes_sociaux, migration additive 011 (007 etant deja appliquee aux agents), route #/reseaux-sociaux (pas #/reseaux), assistant d'import LIEN reelle (hyperliens, remplissage de daira, paires, idempotence), statistiques SQL, exports CSV/XLSX, permissions admin/operateur/lecteur, audit, docs.

Corrigé en phases 2–3 : import LIEN tolérent (en-têtes déplacés, hyperliens, paires), refus des colonnes de contact et de « Feuil1 », aperçu annulable sans écriture, idempotence conservée, cinq onglets `#/reseaux` (dont « À qualifier », « Imports » et « Qualité »), raccourcis P/R/G/C/I et Z, compteurs qualité calculés en SQL. Un accès `view` avant sa déclaration dans `ReseauxSociauxPage.jsx` provoquait une erreur « Cannot access 'R' before initialization » en production : l'initialisation a été réordonnée et vérifiée par rebuild + scénarios navigateur.

Corrigé en phase 4 : ajout en lot (≤ 100 fiches, erreurs par ligne), fusion contrôlée sans réécriture du lien ou de la provenance, corbeille `corbeille=1` avec restauration, contrôle manuel et historique audité, actions accessibles depuis la liste et le détail. La migration additive `012_reseaux_sociaux_workflow.sql` n'altère pas `011` ; les contrats de migration figés sur `001–011` ont été alignés sur `001–012` sans affaiblir les assertions. Les scénarios 120/121/126 et les 28 tests serveur du répertoire sont verts.

Ecarts V9 restants : création du référentiel depuis le fichier (restée explicite pour ne rien inventer), 14 widgets prêts et modèle système n°9, jeu sources/couverture du catalogue, suggestion de source dans le formulaire anomalie et filtre associé, bouton Veille réservé aux pages/groupes, intégration P2/P3 (stat semestrielle, POINTS). Ces écarts sont décrits dans `PLAN.md` et traités dans les phases suivantes.

## 3. Causes transversales

- Les largeurs sont exprimees en nombre de colonnes de grille bootstrap (2/3/4) alors que la specification V8 exige une grille 12 colonnes avec span explicite.
- Les valeurs de largeur ne sont pas portees par la definition du modele systeme : le rendu ne peut donc pas les appliquer.
- Le formatage et les libelles d'action sont locaux a chaque widget, sans composant partage.
- Les regles metier V9 (provenance, normalisation, secrets) doivent rester dans shared/ ; aucun calcul ou SQL duplicate ne sera ajoute.
