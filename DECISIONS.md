# DECISIONS — Plateforme de suivi des anomalies (points noirs)

- **Base de données** : `better-sqlite3` avec pragmas `WAL` + `foreign_keys=ON` ; repli prévu sur `node:sqlite` (Node ≥ 22) si échec de compilation.
- **Auth** : sessions cookie `httpOnly` + `SameSite=Strict` via `express-session` ; MemoryStore en Phase 1 (single instance), store persistant prévu Phase 6.
- **i18n** : dictionnaire maison FR/AR + bascule instantanée du `dir` HTML ; pas de lib i18n externe.
- **Stats** : agrégations SQL via `better-sqlite3` ; aucun calcul de stats en JS sur l'ensemble des lignes.
- **Suppression** : soft-delete (`deleted_at`) dès la Phase 2 (pas de suppression physique).
- **Ambiguïtés** : choix de l'option la plus simple et la plus sûre ; chaque décision notée ici.
