# PLAN — Plateforme de suivi des anomalies (points noirs) — V2

**Projet** : Plateforme web interne — Cellule technique de numérisation, Wilaya d'Alger.
**Objectif** : remplacer le suivi manuel par une base unique + tableaux de bord + rapport hebdomadaire.

## V1 (terminée — commits ddb6ad2..a57dd9f)
- Phases 1 à 7 livrées : socle, anomalies, stats, rapport, carte+PJ, admin, finitions. 24 tests verts, lint 0, build OK.

## V2 — Correction + refonte visuelle « extraordinaire »
- [ ] **Phase A — Audit** : `AUDIT.md` rédigé (constats + causes racines). Mise à jour `PLAN.md`. ✓
- [ ] **Phase B — Corrections bloquantes** : graphiques vides, accents FR, pagination, Observations textarea, libellé EPIC, repli carte, routes/pages manquantes (Admin, Détail).
- [ ] **Phase C — Design system** : tokens, polices locales, composants `ui/`, thème clair/sombre, i18n + RTL, shell (sidebar + topbar + login).
- [ ] **Phase D — Refonte des pages** : Dashboard, Anomalies, Carte, Formulaire, Fiche détail.
- [ ] **Phase E — Rapport & Admin** : Rapport hebdomadaire (impression A4), Administration (CRUD référentiels, users, paramètres, sauvegardes, audit, import).
- [ ] **Phase F — Finition** : animations, états vides/erreur/chargement, a11y, responsive, performance, README.

## Journal
- 2026-10-29 : V1 complète (7 phases). Démarrage V2 — Phase A (audit).