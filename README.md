# Plateforme de suivi des anomalies (points noirs) — Wilaya d'Alger

Application web interne (single-process) de suivi des anomalies (points noirs) signalées sur les réseaux sociaux par la Cellule Technique de Numérisation de la Wilaya d'Alger.

## Stack

- **Serveur** : Node.js + Express (ES modules) — `better-sqlite3` (SQLite, WAL, foreign_keys=ON)
- **Client** : React + Vite + Tailwind CSS + Recharts + Leaflet
- **Auth** : sessions cookies (httpOnly, SameSite=Strict)
- **Validation** : Zod sur toutes les entrées
- **Tests** : Vitest + Supertest (24 tests)
- **Export** : ExcelJS (xlsx), CSV
- **Sécurité** : Helmet (CSP), rate limit, SQL paramétré, audit log, sauvegardes

## Prérequis

- Node.js ≥ 20 (recommandé 24)
- npm ≥ 10
- Windows / Linux / macOS

## Installation

```bash
npm install
npm run build
```

## Variables d'environnement

Fichier `.env` (optionnel, defaults fournis) :

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port HTTP |
| `SESSION_SECRET` | `dev-insecure-secret-change-me` | Secret des cookies de session |
| `DB_PATH` | `./data/anomalies.db` | Chemin de la base SQLite |
| `BACKUP_DIR` | `./backups` | Répertoire des sauvegardes |
| `WEEK_START_DAY` | `0` | Jour de début de semaine (0=dimanche) |
| `ADMIN_USERNAME` | `admin` | Compte admin initial |
| `ADMIN_PASSWORD` | _(vide → mot de passe aléatoire loggé)_ | Mot de passe admin initial |
| `NODE_ENV` | `development` | `production` pour cookies sécurisés |

## Démarrage

```bash
# Initialiser l'admin (mot de passe aléatoire si ADMIN_PASSWORD vide)
$env:ADMIN_PASSWORD = 'Admin12345!'; npm start

# Ou en dev (sans build)
$env:ADMIN_PASSWORD = 'Admin12345!'; npm run dev:server
```

L'application est servie sur `http://localhost:3000` (client buildé + API).

## Fonctionnalités

- **Authentification** : login/logout, sessions cookies, rôles (admin / operateur / lecteur), changement de mot de passe, verrouillage progressif
- **Anomalies** : CRUD, intégrité (type dans domaine, commune dans daïra), détection de doublons, duplication contrôlée, pagination/tri/filtres, vues rapides et vues enregistrées, statut bulk, historique, soft delete
- **Saisie assistée** : collage multi-formats (Facebook, TikTok, Instagram, cartes, GPS, Plus Codes), suggestions de types locaux FR/AR, brouillons automatiques, EXIF côté navigateur, photos avec vignettes
- **Dashboard** : KPI, entonnoir, tendances, ventilations, statistiques détaillées et drill-downs
- **File de travail** : page « À faire », cloche de notifications et listes filtrées alimentées par les mêmes requêtes SQL
- **Rapport hebdomadaire** : synthèse par catégorie/type/daïra/commune/EPIC, export Excel, snapshot, impression
- **Carte** : Leaflet, marqueurs colorés par statut, clusters, densité, filtres synchronisés avec l'URL, liste latérale, repli de tuiles
- **Pièces jointes** : upload multipart (png/jpg/webp, ≤5 Mo)
- **Administration** : CRUD référentiels, import taxonomie/territoires/agents/EPIC, workflow d'intervention, export anomalies CSV/XLSX, audit log, limites communales, sauvegarde/restauration DB
- **Réseau** : résolution de liens courts avec liste blanche, protection SSRF et proxy sortant optionnel ; diagnostic de connectivité
- **i18n** : français + arabe (RTL complet) · **Dark mode** : bascule clair/sombre
- **Accessibilité** : navigation clavier, focus visible, libellés explicites, contrastes vérifiés (tokens)

## API (principaux endpoints)

- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/change-password`
- `GET/POST/PATCH/DELETE /api/anomalies`, `GET /api/anomalies/:id`, `GET /api/anomalies/map`, `POST /api/anomalies/bulk-status`, `POST /api/anomalies/:id/dupliquer`, `GET /api/anomalies/:id/historique`, `GET /api/anomalies/counts`, `GET /api/anomalies/check-duplicate`
- `GET /api/references/domaines`, `/types`, `/dairas`, `/communes`, `/epics`, `/agents`
- `GET /api/stats/overview`, `/group`, `/timeline`, `/detail`
- `GET /api/reports/weekly`, `POST /api/reports/weekly/snapshot`, `GET /api/reports/weekly/history`, `GET /api/reports/weekly/export`
- `GET/POST /api/views`, `PATCH/DELETE /api/views/:id`, `GET /api/work`
- `POST /api/tools/resolve-link`, `POST /api/tools/parse-paste`, `POST /api/geo/locate`
- `GET/POST/PATCH /api/admin/users`, `GET /api/admin/audit`, `/api/admin/health`, `/api/admin/backups`, `POST /api/admin/backups/:nom/restore`, `GET/POST/PATCH /api/admin/references/:entite`, `POST /api/admin/references/import/*`, `POST /api/admin/limites/import-geojson`, `GET /api/admin/anomalies/export`
- `POST /api/client-errors`, `GET /api/health`, `GET /api/config`

Format d'erreur : `{ error: { code, message, fields? } }`.

## Tests

```bash
npm test              # Vitest + Supertest (362 tests)
npm run test:e2e      # 11 scénarios API de bout en bout
npm run test:e2e:browser  # Playwright (60 scénarios, FR/AR, clair/sombre, 390–1440 px)
npm run lint          # ESLint
npm run check:styles  # Tokens et classes autorisées
npm run check:a11y    # Contrastes des tokens (clair/sombre)
npm run qa            # Chaîne complète
```

Les captures d'examen humain (FR clair, FR sombre, AR sombre · 1440 et 390 px) sont dans `docs/screens/` et se régénèrent avec `npm run screens`.

## Sauvegardes

Les sauvegardes sont stockées dans `./backups` (configurable via `BACKUP_DIR`). L'API admin permet de créer/restaurer une sauvegarde (copie cohérente via `db.backup`).

## Sécurité

- Helmet CSP (pas de `dangerouslySetInnerHTML`)
- Rate limit (200 req/15 min, 20 req/15 min pour l'auth)
- Sessions cookies httpOnly + SameSite=Strict
- SQL paramétré, Zod sur toutes les entrées
- Upload vérifié (mime + taille ≤5 Mo)
- Audit log des actions admin
- Soft delete via `deleted_at`

## i18n

Dictionnaires FR/AR dans `client/src/i18n/index.jsx`. Basculer la direction via le toggle (FR/AR) — attribut `dir` sur `<html>`.

## Licence

Usage interne — Wilaya d'Alger, Cellule Technique de Numérisation.
