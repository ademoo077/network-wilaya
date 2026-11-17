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
| L5 | Feuille bloquee a ~900 px sur grand ecran | Aucun reglage de largeur d'affichage ; data-print-document impose une largeur unique | Reglage Ecran large (defaut, jusqu'a 1280 px) / Fidele a l'impression (A4) ; impression A4 inchangee | Corrigé |
| L6 | Texte technique visible (Blocs de données du catalogue contrôlé, SQL) | fr-v8.json : synthese.subtitle, lab.subtitle, lab.builderHelp | Description orientee utilisateur, zero jargon technique a l'ecran | Corrigé |
| L7 | Bandeau d'en-tete tres haut, boutons redondants | ReportPage.jsx : bandeau debute p-5/sm:p-6 + titre 3xl + seconde barre d'outils ; onglet report.studio.official | En-tete compact <= 140 px, une seule barre d'outils collante, onglet Editions | Corrigé |
| L8 | Bord gauche de la barre laterale rogne | index.css : .sidebar-pattern { overflow: hidden } coupe les entrees en RTL et les ombres | Retirer le masquage du conteneur, garder le motif dans ::after | Corrigé |
| L9 | Chaque widget n'a que le bouton CSV | WidgetCard.jsx / DataActions : deux actions seulement | Barre d'actions : information, donnees, fiches, plein ecran, export CSV/PNG avec aria-label | Corrigé |
| L10 | Etiquettes Systeme / Modele systeme repetees | SyntheseCanvas.jsx : Chip portee + Chip cle_systeme ; synthese.modeleSystemeDesc a cote | Une seule etiquette : Modele systeme (non modifiable — Personnaliser cree votre copie) | Corrigé |

## 2. Parties B et C — etat deja livre et ecarts

Deja livre et verifie (commit 14524c1) : annuaire manual comptes_sociaux, migration additive 011 (007 etant deja appliquee aux agents), route #/reseaux-sociaux (pas #/reseaux), assistant d'import LIEN reelle (hyperliens, remplissage de daira, paires, idempotence), statistiques SQL, exports CSV/XLSX, permissions admin/operateur/lecteur, audit, docs.

Ecarts V9 restants : file « A qualifier » avec raccourcis clavier, onglet Qualite, import avec rapprochement territorial et conflits, creation du referentiel depuis le fichier, 14 widgets prets et modele systeme n°9, jeu sources/couverture du catalogue, suggestion de source dans le formulaire anomalie et filtre associe, bouton Veille, integration P2/P3 (stat semestrielle, POINTS). Ces ecarts sont decrits dans PLAN.md et traites dans les phases suivantes.

## 3. Causes transversales

- Les largeurs sont exprimees en nombre de colonnes de grille bootstrap (2/3/4) alors que la specification V8 exige une grille 12 colonnes avec span explicite.
- Les valeurs de largeur ne sont pas portees par la definition du modele systeme : le rendu ne peut donc pas les appliquer.
- Le formatage et les libelles d'action sont locaux a chaque widget, sans composant partage.
- Les regles metier V9 (provenance, normalisation, secrets) doivent rester dans shared/ ; aucun calcul ou SQL duplicate ne sera ajoute.
