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

- **Authentification** : login/logout, sessions cookies, rôles (admin / operateur / lecteur)
- **Anomalies** : CRUD, intégrité (type dans domaine, commune dans daïra), détection de doublons, pagination/tri/filtres, statut bulk, historique, soft delete
- **Quick-create** : formulaire rapide avec références
- **Dashboard** : KPI, donut par statut, évolution hebdomadaire, par catégorie
- **Rapport hebdomadaire** : synthèse par catégorie/type/daïra/commune/EPIC, export Excel, snapshot, impression
- **Carte** : Leaflet, marqueurs colorés par statut, popup avec lien
- **Pièces jointes** : upload multipart (png/jpg/webp, ≤5 Mo)
- **Administration** : CRUD référentiels, import taxonomie, export anomalies CSV/XLSX, audit log, sauvegarde/restauration DB
- **i18n** : français + arabe (RTL complet)
- **Dark mode** : bascule clair/sombre

## API (principaux endpoints)

- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET/POST/PATCH/DELETE /api/anomalies`, `GET /api/anomalies/:id`, `POST /api/anomalies/:id/pieces`, `POST /api/anomalies/bulk-status`, `GET /api/anomalies/:id/historique`, `GET /api/anomalies/check-duplicate`
- `GET /api/references/domaines`, `/types`, `/dairas`, `/communes`, `/epics`, `/agents`
- `GET /api/stats/summary`, `/by-category`, `/by-type`, `/by-daira`, `/by-commune`, `/by-epic`, `/by-platform`, `/timeline`, `/weekly`
- `GET /api/reports/weekly`, `POST /api/reports/weekly/snapshot`, `GET /api/reports/weekly/history`, `GET /api/reports/weekly/export`
- `GET/POST/PATCH /api/admin/users`, `GET /api/admin/audit`, `POST/GET /api/admin/backup`, `POST /api/admin/backup/restore`, `GET/POST/PATCH /api/admin/references/:entite`, `POST /api/admin/references/import/taxonomie`, `GET /api/admin/anomalies/export`
- `GET /api/health`

Format d'erreur : `{ error: { code, message, fields? } }`.

## Tests

```bash
npm test       # Vitest + Supertest (24 tests)
npm run lint   # ESLint
npm run build  # Vite build
```

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
