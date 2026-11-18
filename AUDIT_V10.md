# AUDIT V10 — Studio de synthèses « façon atelier »

Date : 18/11/2026. Références : prompt V10, `docs/SPEC_V8.md`, `PLAN.md`, `DECISIONS.md`.
État de départ : tag `avant-v10` (`5786eaf`). Un constat n'est clos que s'il est corrigé et couvert par un test navigateur réel.

## 1. Constats initiaux

| # | Constat | Cause réelle dans le code | Correctif attendu | État |
|---|---|---|---|---|
| T1 | Aucun sélecteur de widgets par cartes avec taille par défaut | La galerie V8.2 est une liste de boutons ; l'ajout se fait directement | Fenêtre par familles, cartes avec `w × h`, recherche, aperçu et bouton justifié | À faire |
| T2 | La composition reste en sections/colonnes, sans grille libre | `syntheseDefinitionSchema` ne connaît que `sections[].colonnes[]` ; `options.largeur` vaut 4/8/12 | `layout` 12 colonnes × 40 px, drag/resize, clavier, guides, zoom et RTL | Fait (phase 1) |
| T3 | L'impression repose sur le CSS et ne pagine pas les widgets | `break-inside` et spans A4, sans algorithme de pages | `paginer()` partagé, sauts forcés, A4/A3, aucun widget coupé | Fait (phase 1) |
| T4 | Aucun gestionnaire de jeux de données ni import tabulaire dans le Studio | Le catalogue n'expose que `anomalies` ; aucune table `ds_*` | Gestionnaire, import CSV/XLSX, schéma, aperçu et profilage | À faire |
| T5 | Les filtres ne sont pas des widgets interactifs | Les filtres vivent dans la requête d'un bloc, sans portée ni barre active | Filtres texte/liste/composite/période/curseur, portées et filtrage croisé | À faire |
| T6 | Les couleurs sont limitées aux tokens de l'application | Aucun champ de style par widget ; les graphiques utilisent la palette fixe | Palette et styles validés, stockés comme données du projet | À faire |
| T7 | Aucune vue « données utilisées » ni sortie par widget | Les actions exportent seulement un CSV/PNG local | Données du widget, lignes sources, panier et journal d'audit | À faire |
| T8 | Les projets ne sont pas nommés ni gérés comme des projets | Les modèles existent, mais sans barre de projet, autosave visible ni « Enregistrer sous » | Barre de projet, mes projets, duplication et partage équipe | À faire |
| T9 | Les aides de composition sont absentes | Pas de glisser de champ, suggestions, kits ni `Ctrl+K` | Aides contextuelles et kits de démarrage | À faire |

## 2. Causes transversales

- La V8.2 a livré un modèle « sections → colonnes » fiable pour l'impression, mais pas une grille de tableau de bord.
- Les widgets ne portent pas de style propre : toute couleur vient des tokens `--chart-*` et `--brand-*`.
- Le moteur unique V8 est sain : les extensions V10 doivent passer par le catalogue, les schémas zod et les adaptateurs serveur, jamais par du SQL client.
- Les migrations `010`, `011` et `012` sont déjà appliquées : V10 sera additif et testé sur une base temporaire.

## 3. Points de vigilance

- Ne pas modifier les éditions figées ni les snapshots existants.
- Ne pas affaiblir les scénarios 1–128 ; les scénarios 129–141 s'ajoutent.
- Aucune couleur hexadécimale en dur hors des données de projet et de `tokens.css`.
- Aucun fichier importé n'est conservé après traitement ; seuls le hash et le résumé restent.
- Les profils sociaux restent comptés mais jamais nommés par défaut dans les sorties.
