# PLAN — Plateforme de suivi des anomalies (points noirs)

**Projet** : Plateforme web interne — Cellule technique de numérisation, Wilaya d'Alger.
**Objectif** : remplacer le suivi manuel (réseaux sociaux → agents scooter → EPIC) par une base de données unique + tableaux de bord + rapport hebdomadaire.

## Phases

- [ ] **Phase 1 — Socle** : arborescence, config, migrations, seed taxonomie, auth, rôles, i18n FR/AR + RTL, layout
  - **Critère d'acceptation** : `npm start` démarre ; login OK ; 70 catégories / 156 types en base
- [ ] **Phase 2 — Anomalies** : CRUD, saisie rapide (§7.1), règles d'intégrité (§3), doublons, historique, liste + filtres + actions groupées
- [ ] **Phase 3 — Statistiques** : service `stats.js`, endpoints `/stats/*`, dashboard (§7.4)
- [ ] **Phase 4 — Rapport hebdomadaire** : page rapport, impression A4, export Excel, snapshot, résumé texte (§8)
- [ ] **Phase 5 — Carte & pièces jointes** : carte Leaflet + repli hors-ligne, upload sécurisé
- [ ] **Phase 6 — Administration & import/export** : référentiels, utilisateurs, paramètres, import, audit, sauvegardes
- [ ] **Phase 7 — Finition** : responsive mobile, accessibilité, thème sombre, perf, README complet

## Journal

- 2026-10-29 : démarrage du projet. Phase 1 en cours — lecture du CSV taxonomie effectuée.
