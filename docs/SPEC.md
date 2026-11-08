# SPÉCIFICATION COMPLÈTE — Plateforme de suivi des anomalies (points noirs)
**Wilaya d'Alger — Cellule technique de numérisation** · Version 4.0 (référence unique)

> Ce document remplace tous les prompts précédents. En cas de contradiction, **ce document gagne**.
> Placer ce fichier dans `docs/SPEC.md` et `taxonomie_anomalies.csv` dans `seed/` avant de commencer.

---

## 0. PRINCIPES NON NÉGOCIABLES

1. **Tout doit fonctionner** : chaque écran, bouton, filtre, export et calcul décrit ici est implémenté et vérifié par exécution. Aucun `TODO`, aucun bouton mort, aucune page vide par oubli.
2. **Une seule source de vérité** pour les règles : le dossier `shared/` (constantes, validation zod, normalisation, parseur GPS, normalisation d'URL, dates, calcul des pourcentages) est importé par le serveur **et** le client. Aucune règle dupliquée.
3. **Défense en profondeur** : une règle métier est vérifiée (a) dans le formulaire, (b) dans le service serveur, (c) par une contrainte SQL `CHECK` quand c'est possible.
4. **Les statistiques sont calculées en SQL**, jamais en JavaScript sur toutes les lignes.
5. **Aucune couleur codée en dur** hors `tokens.css` ; tout passe par les tokens et les composants `ui/`.
6. **Aucune ressource externe à l'exécution** (CDN, polices, icônes, scripts, API) — sauf les tuiles de carte configurées (`tile_url`) et leur repli hors-ligne.
7. **Compatible Windows** (poste de développement et serveur) : scripts npm multiplateformes (`cross-env`, pas de `rm -rf`/bash), chemins via `path`, pas de dépendance à un shell Unix.
8. Ne jamais inventer de données réelles (communes, EPIC, agents, statistiques). Les données de démonstration sont marquées `[DEMO]` et purgeables.

---

## 1. CONTEXTE MÉTIER

La **cellule technique de numérisation** de la Wilaya d'Alger travaille avec des **agents à scooter** (contrôle de voirie). Les **anomalies** (« points noirs ») sont signalées par des citoyens dans des **vidéos/publications sur les réseaux sociaux**.

**Circuit :**
1. Un membre de la cellule repère une publication et **enregistre son lien** dans la plateforme (une publication peut montrer **plusieurs** anomalies → plusieurs fiches pour un même lien est un cas normal).
2. Un **agent scooter** vérifie la vidéo : **confirme** ou **infirme** l'anomalie et fournit la **position GPS**.
3. L'**EPIC** compétente intervient selon le **type d'anomalie**, la **daïra**, la **commune** et le **GPS**.
4. Le statut évolue : **non traité → en cours → traité**.
5. **Chaque semaine**, la cellule envoie une **synthèse** : nombre et **pourcentage** d'anomalies traitées / en cours / non traitées, par catégorie, type, daïra, commune et EPIC.

**Glossaire (à respecter dans l'UI et le code) :**
| Terme | Signification | Donnée |
|---|---|---|
| Catégorie / Domaine (المجال) | grande famille d'anomalies | `domaines` |
| Type (طبيعة النقطة السوداء) | nature précise, rattachée à une catégorie | `types_anomalie` |
| EPIC | entité qui intervient | `epics` |
| Agent | scooter qui vérifie | `agents` |
| Cohorte | anomalies reçues sur une période | — |

---

## 2. ARCHITECTURE

### 2.1 Stack imposée
| Couche | Choix |
|---|---|
| Runtime | Node.js ≥ 20 LTS, **ESM partout** (`"type": "module"`), **npm workspaces** : `server`, `client`, `shared` |
| Serveur | Express 4, `better-sqlite3` (WAL, `foreign_keys=ON`, `busy_timeout=5000`), `zod`, `bcryptjs` (coût 12), `helmet`, `express-rate-limit`, `exceljs`, `csv-parse`, `multer`, `cookie` |
| Client | React 18, Vite, **react-router-dom 6 avec `HashRouter`**, **Tailwind CSS 3.4** (propriétés logiques `ms-/me-/ps-/pe-/start-/end-`), Recharts, Leaflet + `leaflet.markercluster`, `lucide-react`, `@fontsource-variable/inter`, `@fontsource/cairo` |
| i18n | dictionnaires maison `fr.json` / `ar.json` + fonction `t(clé, vars)` (pas de lib lourde) |
| Tests | Vitest, Supertest, Playwright + `@axe-core/playwright` (dev) |
| Divers (dev) | `eslint`, `concurrently`, `cross-env` |

**Repli SQLite** : si `better-sqlite3` ne s'installe pas (Windows sans outils de compilation), utiliser `node:sqlite` (Node ≥ 22.5) derrière la même interface `server/src/db/index.js` ; noter dans `DECISIONS.md`. Le reste du code n'importe **jamais** le driver directement.

### 2.2 Arborescence
```
/shared/src   constants.js  normalize.js  url.js  gps.js  dates.js  percent.js  schemas.js  statut.js  index.js
/server/src   app.js server.js  config/ db/(index.js, migrate.js, migrations/*.sql) 
              middleware/(auth, csrf, security, errors, maintenance) routes/ services/ utils/
/server/tests
/client/src   main.jsx App.jsx routes.jsx  api/ i18n/(fr.json, ar.json, index.js) styles/(tokens.css, index.css)
              components/ui/  components/layout/  components/charts/  features/(dashboard, anomalies, map, report, admin, auth, setup)  hooks/
/seed         taxonomie_anomalies.csv
/scripts      setup.js  seed-demo.js  seed-demo-purge.js  admin-reset.js  check-styles.js  check-a11y.js
/data  /backups  /logs  (ignorés par git)
docs/SPEC.md  README.md  PLAN.md  DECISIONS.md  AUDIT.md  .env.example
```

### 2.3 Scripts npm (racine)
`setup` (crée `.env`, dossiers, installe) · `dev` (serveur + Vite, proxy `/api`) · `build` · `start` (lance `setup` si `.env` absent, migre, sert API + client sur `HOST:PORT`) · `test` · `test:e2e` · `lint` · `check:styles` · `check:a11y` · `seed:demo` · `seed:demo:purge` · `admin:reset` (réinitialise le mot de passe admin en interactif) · `backup` · `db:check` (`PRAGMA integrity_check` + versions de migration).

### 2.4 Configuration `.env` (générée par `setup`)
`PORT=3000` · `HOST=0.0.0.0` · `NODE_ENV=production` · `TZ=Africa/Algiers` · `DB_PATH=./data/anomalies.db` · `UPLOAD_DIR=./data/uploads` · `BACKUP_DIR=./backups` · `COOKIE_SECURE=false` (true seulement si HTTPS) · `SESSION_TTL_HOURS=8` · `LOG_LEVEL=info`. Aucun secret n'est requis (les sessions utilisent des jetons aléatoires stockés hachés en base).

### 2.5 Démarrage du serveur (ordre)
1) charger `.env`, forcer `process.env.TZ` · 2) créer dossiers · 3) ouvrir la DB, pragmas · 4) **migrer** (table `schema_migrations`) · 5) importer la taxonomie si `domaines` est vide · 6) créer l'admin si aucun utilisateur (mot de passe aléatoire affiché **une fois** en console **et** `admin:reset` documenté) · 7) sauvegarde automatique du jour si absente · 8) planifier la sauvegarde quotidienne et le nettoyage des sessions expirées · 9) écouter. Route `GET /api/health` → `{ok:true,version,db:true}`.
Le serveur sert `client/dist` (assets avec cache long, `index.html` en `no-cache`) ; toute route non-API renvoie `index.html`.

### 2.6 Routes client (HashRouter — table exhaustive)
```
#/connexion            Connexion
#/assistant            Assistant de démarrage (admin)
#/                     Tableau de bord
#/anomalies            Liste (filtres dans la query du hash : #/anomalies?statut=en_cours&daira=3)
#/anomalies/nouvelle   Saisie
#/anomalies/:id        Fiche
#/anomalies/:id/modifier
#/carte
#/rapport              (?semaine=YYYY-MM-DD, date de début)
#/admin/:onglet        referentiels | utilisateurs | parametres | sauvegardes | audit | import-export | corbeille
#/profil               Changer son mot de passe
```
Le menu actif est **dérivé de la route** (jamais d'un état séparé). Toute route inconnue → page 404 stylée. Routes protégées par rôle côté client **et** serveur.

### 2.7 Dates et fuseau (source classique de bugs — à respecter à la lettre)
- Dates métier = **chaînes `YYYY-MM-DD`** (calendrier d'Alger), jamais des `Date` locales. Horodatages techniques = ISO UTC.
- `todayAlgiers()` = date du jour dans `Africa/Algiers` (UTC+1, sans heure d'été) via `Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Algiers'})`.
- Arithmétique de dates sur des objets `Date` **UTC minuit** construits depuis la chaîne. Jamais de `new Date('YYYY-MM-DD')` interprété en local.
- Début de semaine configurable `week_start_day` (0=dimanche … 6=samedi, **défaut 0**). `weekStart(d) = d − ((dow(d) − wsd + 7) % 7)` jours ; fin = début + 6.
- Affichage : `JJ/MM/AAAA` et `JJ/MM/AAAA HH:mm` (heure d'Alger), **chiffres occidentaux (0-9)** dans les deux langues (`ar-DZ-u-nu-latn`).

---

## 3. MODÈLE DE DONNÉES (migration `001_init.sql`)

Toutes les tables : `created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))`, `updated_at` idem. Dates métier : `TEXT` avec `CHECK (col IS NULL OR col GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')`.

```sql
users(id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE, full_name TEXT NOT NULL,
      password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','operateur','lecteur')),
      actif INTEGER NOT NULL DEFAULT 1, must_change_password INTEGER NOT NULL DEFAULT 1,
      failed_attempts INTEGER NOT NULL DEFAULT 0, locked_until TEXT, last_login_at TEXT, ...);

sessions(id TEXT PRIMARY KEY /*sha256 du jeton*/, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
         csrf_token TEXT NOT NULL, expires_at TEXT NOT NULL, last_seen_at TEXT, ip TEXT, user_agent TEXT, created_at ...);

domaines(id, name_ar TEXT NOT NULL UNIQUE, name_fr TEXT, ordre INTEGER NOT NULL, actif INTEGER NOT NULL DEFAULT 1, ...);
types_anomalie(id, domaine_id INTEGER NOT NULL REFERENCES domaines(id), name_ar TEXT NOT NULL, name_fr TEXT,
               ordre INTEGER NOT NULL, actif INTEGER NOT NULL DEFAULT 1, UNIQUE(domaine_id, name_ar), ...);
dairas(id, name_fr TEXT NOT NULL UNIQUE, name_ar TEXT, actif INTEGER NOT NULL DEFAULT 1, ...);
communes(id, daira_id INTEGER NOT NULL REFERENCES dairas(id), name_fr TEXT NOT NULL, name_ar TEXT,
         actif INTEGER NOT NULL DEFAULT 1, UNIQUE(daira_id, name_fr), ...);
epics(id, name TEXT NOT NULL UNIQUE, sigle TEXT, contact_nom TEXT, contact_tel TEXT, actif INTEGER NOT NULL DEFAULT 1, ...);
epic_domaines(epic_id INTEGER NOT NULL REFERENCES epics(id) ON DELETE CASCADE,
              domaine_id INTEGER NOT NULL REFERENCES domaines(id), PRIMARY KEY(epic_id, domaine_id));
agents(id, full_name TEXT NOT NULL, matricule TEXT UNIQUE, telephone TEXT,
       zone_daira_id INTEGER REFERENCES dairas(id), actif INTEGER NOT NULL DEFAULT 1, ...);

anomalies(
  id INTEGER PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,                       -- ANM-AAAA-NNNNN
  version INTEGER NOT NULL DEFAULT 1,                   -- verrou optimiste
  plateforme TEXT NOT NULL CHECK(plateforme IN ('facebook','instagram','tiktok','youtube','x','whatsapp','telegram','autre')),
  lien_url TEXT NOT NULL CHECK(lien_url LIKE 'http://%' OR lien_url LIKE 'https://%'),
  lien_normalise TEXT NOT NULL,
  date_publication TEXT, date_signalement TEXT NOT NULL,
  domaine_id INTEGER NOT NULL REFERENCES domaines(id),
  type_id INTEGER NOT NULL REFERENCES types_anomalie(id),
  daira_id INTEGER NOT NULL REFERENCES dairas(id),
  commune_id INTEGER NOT NULL REFERENCES communes(id),
  adresse_texte TEXT, lieu_dit TEXT,
  gps_lat REAL CHECK(gps_lat IS NULL OR gps_lat BETWEEN -90 AND 90),
  gps_lng REAL CHECK(gps_lng IS NULL OR gps_lng BETWEEN -180 AND 180),
  verification TEXT NOT NULL DEFAULT 'a_verifier' CHECK(verification IN ('a_verifier','confirmee','infirmee')),
  agent_id INTEGER REFERENCES agents(id), date_verification TEXT,
  statut TEXT NOT NULL DEFAULT 'non_traite' CHECK(statut IN ('non_traite','en_cours','traite')),
  epic_id INTEGER REFERENCES epics(id), intervenant_autre TEXT,
  date_intervention TEXT, date_traitement TEXT,
  priorite TEXT NOT NULL DEFAULT 'normale' CHECK(priorite IN ('normale','haute','urgente')),
  observations TEXT,
  search_norm TEXT NOT NULL DEFAULT '',
  saisi_par INTEGER NOT NULL REFERENCES users(id),
  deleted_at TEXT, deleted_by INTEGER REFERENCES users(id),
  created_at ..., updated_at ...,
  CHECK((gps_lat IS NULL) = (gps_lng IS NULL)),
  CHECK(statut <> 'traite'     OR date_traitement   IS NOT NULL),
  CHECK(statut = 'traite'      OR date_traitement   IS NULL),
  CHECK(statut <> 'en_cours'   OR date_intervention IS NOT NULL),
  CHECK(statut <> 'non_traite' OR date_intervention IS NULL),
  CHECK(statut = 'non_traite'  OR epic_id IS NOT NULL OR (intervenant_autre IS NOT NULL AND intervenant_autre <> '')),
  CHECK(verification <> 'infirmee' OR statut = 'non_traite'),
  CHECK(date_intervention IS NULL OR date_intervention >= date_signalement),
  CHECK(date_traitement   IS NULL OR date_traitement   >= date_signalement),
  CHECK(date_traitement IS NULL OR date_intervention IS NULL OR date_traitement >= date_intervention)
);

anomalie_historique(id, anomalie_id INTEGER NOT NULL REFERENCES anomalies(id), champ TEXT NOT NULL,
                    ancienne_valeur TEXT, nouvelle_valeur TEXT, motif TEXT, user_id INTEGER REFERENCES users(id), at TEXT NOT NULL ...);
pieces_jointes(id, anomalie_id INTEGER NOT NULL REFERENCES anomalies(id), chemin TEXT NOT NULL, nom_original TEXT,
               mime TEXT NOT NULL, taille INTEGER NOT NULL, user_id INTEGER REFERENCES users(id), created_at ...);
rapports_hebdo(id, semaine_debut TEXT NOT NULL, semaine_fin TEXT NOT NULL, version INTEGER NOT NULL,
               snapshot_json TEXT NOT NULL, genere_par INTEGER REFERENCES users(id), created_at ..., UNIQUE(semaine_debut, version));
audit_log(id, user_id INTEGER, username TEXT, action TEXT NOT NULL, entite TEXT, entite_id TEXT, details_json TEXT, ip TEXT, at TEXT NOT NULL ...);
parametres(cle TEXT PRIMARY KEY, valeur TEXT NOT NULL);
compteurs(cle TEXT PRIMARY KEY, valeur INTEGER NOT NULL);          -- ex. 'anm-2026'
schema_migrations(version INTEGER PRIMARY KEY, name TEXT, applied_at TEXT);
```
**Index** : `anomalies(statut)`, `(date_signalement)`, `(date_traitement)`, `(domaine_id,type_id)`, `(daira_id,commune_id)`, `(epic_id)`, `(agent_id)`, `(verification)`, `(lien_normalise)`, `(deleted_at)` ; `anomalie_historique(anomalie_id,at)` ; `audit_log(at)`, `(action)` ; `sessions(expires_at)`. `audit_log` n'a **aucune** route de suppression.

**Paramètres par défaut** : `nom_cellule='Cellule technique de numérisation'`, `week_start_day=0`, `delai_retard_jours=7`, `exiger_verification=1`, `tile_url='https://tile.openstreetmap.org/{z}/{x}/{y}.png'`, `backup_retention_days=30`, `gps_bbox='36.40,2.50,36.95,3.40'` (lat_min,lng_min,lat_max,lng_max, avertissement non bloquant).

**Référence** : `ANM-AAAA-NNNNN` (AAAA = année de création, NNNNN sur 5 chiffres), générée **dans la même transaction** que l'insertion via `compteurs` (incrément atomique). Jamais réutilisée, même après suppression logique.

**Suppression logique uniquement** (`deleted_at`). **Toute** requête de lecture/statistique ajoute `deleted_at IS NULL` (centralisé dans une fonction de construction de requête testée).

**Champ `search_norm`** : concaténation normalisée (cf. § 4.5) de référence, lien, adresse, lieu-dit, observations, noms de catégorie/type/daïra/commune ; recalculé à chaque écriture et si un référentiel est renommé (tâche de recalcul).

---

## 4. RÈGLES MÉTIER (implémentées dans `server/src/services/anomalies.js`, tests exhaustifs)

### 4.1 États et transitions
**Vérification** : `a_verifier → confirmee | infirmee` ; `confirmee → infirmee` (seulement si `statut='non_traite'`) ; `infirmee → a_verifier | confirmee` (motif obligatoire).
- `confirmee` ⇒ `agent_id` obligatoire, `date_verification` (défaut aujourd'hui).
- `infirmee` ⇒ `agent_id` + **motif** obligatoires ; le serveur force `statut='non_traite'`, efface `epic_id`, `intervenant_autre`, `date_intervention`, `date_traitement`. Une anomalie infirmée est **exclue de toutes les statistiques** (sauf bascule « inclure les infirmées »).

**Statut** : `non_traite → en_cours | traite` ; `en_cours → traite | non_traite` ; `traite → en_cours | non_traite` (réouverture).
- Passage vers `en_cours` ou `traite` : exige `verification='confirmee'` (si `exiger_verification=1`), un **intervenant** (`epic_id` **ou** `intervenant_autre` non vide) et les dates ci-dessous.
- `en_cours` : `date_intervention` obligatoire (défaut aujourd'hui), `date_traitement` = NULL.
- `traite` : `date_traitement` obligatoire (défaut aujourd'hui) ; si `date_intervention` est vide, elle prend la valeur de `date_traitement`.
- Retour à `non_traite` : efface `date_intervention` et `date_traitement` (l'historique conserve les anciennes valeurs) ; **motif obligatoire** pour tout retour en arrière (réouverture, annulation d'intervention).
- Ordre des dates : `date_publication ≤ date_signalement ≤ date_intervention ≤ date_traitement ≤ aujourd'hui` (aucune date future).

### 4.2 Intégrité référentielle
`type_id` doit appartenir à `domaine_id` ; `commune_id` à `daira_id` ; les référentiels **inactifs** ne sont pas sélectionnables pour une nouvelle valeur mais restent affichés sur les fiches existantes. Un référentiel lié à des anomalies ne se supprime jamais (désactivation seulement).

### 4.3 Verrou optimiste
Toute modification envoie `version` ; si ≠ version en base → `409 VERSION_CONFLICT` (message : « Cette fiche a été modifiée par un autre utilisateur — rechargez »). Chaque écriture incrémente `version`.

### 4.4 Historique
Un enregistrement par **champ modifié** (`statut`, `verification`, `epic_id`, `agent_id`, `priorite`, `domaine_id`, `type_id`, `daira_id`, `commune_id`, `gps`, dates…) avec ancienne/nouvelle valeur lisible, `motif`, utilisateur, horodatage. La création écrit une ligne `creation`.

### 4.5 Doublons (un lien peut légitimement porter plusieurs anomalies)
- **Doublon de lien** : même `lien_normalise` (non supprimé) → `409 DUPLICATE_LINK` avec la liste des fiches existantes ; le client demande « C'est une anomalie différente de celles-ci ? » ; confirmation → renvoi avec `force_duplicate=true`.
- **Doublon strict** : même `lien_normalise` + même `type_id` + même `commune_id` → `409 DUPLICATE_STRICT`, **non forçable**.
- Normalisation d'URL (`shared/url.js`) : schéma http(s) obligatoire (rejeter `javascript:`, `data:`, etc.), hôte en minuscules sans `www.`/`m.`/`mobile.`, suppression du fragment et des paramètres de suivi (`utm_*`, `fbclid`, `igshid`, `igsh`, `mibextid`, `si`, `feature`, `ref`, `ref_src`, `s`, `t`), tri des paramètres restants, suppression du `/` final. Plateforme déduite de l'hôte : facebook.com/fb.com/fb.watch → `facebook` ; instagram.com → `instagram` ; tiktok.com/vm.tiktok.com → `tiktok` ; youtube.com/youtu.be → `youtube` ; x.com/twitter.com/t.co → `x` ; wa.me/whatsapp.com → `whatsapp` ; t.me → `telegram` ; sinon `autre`.
- **Recherche** (`q`) : chaque mot (AND) doit être contenu dans `search_norm` (`LIKE ... ESCAPE '\'`). `normalize()` (partagée) : NFKC, minuscules, suppression des accents latins, suppression des diacritiques arabes (U+064B–U+065F, U+0670) et du tatweel (U+0640), unification `أ إ آ ٱ → ا`, `ى → ي`, `ة → ه`, espaces compactés.

### 4.6 GPS (`shared/gps.js`)
Accepte : `36.7538, 3.0588` · `36.7538 3.0588` · `36,7538 ; 3,0588` (virgule décimale) · liens Google Maps (`@lat,lng`, `?q=lat,lng`, `ll=`, `!3dLAT!4dLNG`) · liens OSM (`#map=z/lat/lng`, `mlat=…&mlon=…`). Liens courts (`maps.app.goo.gl`) → erreur claire « lien court non résolu hors-ligne, collez les coordonnées ». Si `|lat|>90` et `|lng|≤90` → inversion proposée. Hors `gps_bbox` → **avertissement** non bloquant. Stockage `gps_lat`/`gps_lng` à 6 décimales.

### 4.7 Permissions
| Action | admin | operateur | lecteur |
|---|:-:|:-:|:-:|
| Lire anomalies, stats, rapports, carte | ✔ | ✔ | ✔ |
| Créer / modifier / vérifier / changer statut / pièces jointes | ✔ | ✔ | ✘ |
| Supprimer (logique) / restaurer de la corbeille | ✔ | ✘ | ✘ |
| Exporter | ✔ | ✔ | ✔ |
| Importer, figer un rapport | ✔ | ✔ (figer) | ✘ |
| Référentiels, utilisateurs, paramètres, sauvegardes, audit | ✔ | ✘ | ✘ |
Vérifiées **côté serveur** par middleware ; l'UI masque les actions interdites.

---

## 5. STATISTIQUES (`server/src/services/stats.js` — source unique, testée)

**Population de base** : `deleted_at IS NULL` ET (`verification <> 'infirmee'` sauf `include_infirmees=1`).
**Filtres communs** : `from`, `to`, `domaine`, `type`, `daira`, `commune`, `epic`, `agent`, `plateforme`, `priorite`, `verification`, `statut`, `q`.

### 5.1 Tableau de bord (période P = [from, to] sur `date_signalement` ; défaut = semaine courante)
- **Cohorte** = anomalies avec `date_signalement ∈ P`. Répartition par **statut actuel**. `% = n / total_cohorte`.
- KPI : `total`, `non_traite`, `en_cours`, `traite` (n et %), `taux_traitement = traite/total`, `delai_moyen_jours` = moyenne de `date_traitement − date_signalement` des anomalies dont `date_traitement ∈ P`, `urgentes_ouvertes` (`priorite='urgente'` et `statut<>'traite'`, toutes périodes), `en_retard` (`statut<>'traite'` et `date_signalement < aujourd'hui − delai_retard_jours`, toutes périodes).
- **Variation** vs période précédente de même durée (`P−durée`), en points de pourcentage pour les taux et en valeur relative pour les totaux.
- Option « Toutes périodes » (sans `from/to`).

### 5.2 Rapport hebdomadaire (semaine S..E, **statut à la date E**)
Fonction partagée `statutAu(anomalie, D)` :
```
si date_signalement > D            → n'existait pas encore
si date_traitement <= D            → traite
sinon si date_intervention <= D    → en_cours
sinon                              → non_traite
```
(valide car un retour à `non_traite` efface les dates ; la version **figée** conserve l'état exact.)
- **Reçues** : `date_signalement ∈ [S,E]` → total, et répartition par `statutAu(E)` (n et %).
- **Traitées dans la semaine** : `date_traitement ∈ [S,E]` (toute date de réception).
- **Stock ouvert fin** : `date_signalement ≤ E` et `statutAu(E) <> 'traite'` ; **stock ouvert début** : idem au jour `S−1` ; évolution = fin − début.
- **Taux de traitement cumulé** : traitées à E / total reçu jusqu'à E.
- Délai moyen, urgentes ouvertes, en retard : mêmes définitions, évaluées à E.
- Comparaison avec la semaine précédente (mêmes calculs sur [S−7, E−7]).
- Sections : par catégorie, par type, par daïra, par commune, par EPIC (affectées = `epic_id` non nul, traitées, en cours, taux), liste des **urgentes ouvertes** et des **ouvertes depuis > N jours**.

### 5.3 Pourcentages
`shared/percent.js` : arrondi à 1 décimale par **méthode du plus grand reste** pour que les trois statuts totalisent **exactement 100,0 %** ; total = 0 → `null` affiché « — ». Les pourcentages sont calculés **côté serveur** ; le client n'arrondit rien lui-même.

### 5.4 Formats de réponse
`/stats/group` → `{ rows:[{id,label_ar,label_fr,total,non_traite,en_cours,traite,pct_non_traite,pct_en_cours,pct_traite}], totals:{…} }` trié par `total` décroissant (lignes à 0 exclues sauf `include_empty=1`).
`/stats/timeline?granularity=week` → `[{debut,fin,recues,traitees}]` (12 dernières semaines par défaut).

---

## 6. API REST (`/api`, JSON, UTF-8)

**Conventions** : succès `200/201` `{ item }` ou `{ items, page, pageSize, total }` · erreurs `{ error:{ code, message, fields?, details? } }` avec `400` validation, `401` non connecté, `403` interdit, `404`, `409` conflit/doublon, `413`, `422` règle métier, `429` limitation, `500` (sans trace) · dates `YYYY-MM-DD` · pagination défaut 25, max 200 · tri sur **liste blanche** (`reference, date_signalement, statut, domaine, type, daira, commune, epic, priorite, verification, created_at`) · **CSRF** : en-tête `X-CSRF-Token` obligatoire sur POST/PUT/PATCH/DELETE (jeton renvoyé par `/auth/login` et `/auth/me`).

```
POST /auth/login {username,password}   POST /auth/logout   GET /auth/me   POST /auth/change-password {current,next}
GET  /setup/status → {referentielTerritorialVide, epicsVides, agentsVides, taxonomieOk, premierDemarrage}
GET  /ref/bootstrap  (domaines+types, dairas+communes, epics(+domaines), agents, parametres publics ; ETag)
CRUD /ref/:entite    entite ∈ domaines|types|dairas|communes|epics|agents  (admin)
POST /ref/:entite/import (CSV, aperçu puis validation)   POST /ref/bulk-territoire {texte}  (assistant)
GET  /anomalies?…filtres…&page&pageSize&sort&dir        POST /anomalies        GET /anomalies/:id
PATCH /anomalies/:id {version, …champs, motif?}          DELETE /anomalies/:id (admin, logique)
POST /anomalies/:id/statut {version,statut,epic_id?,intervenant_autre?,date_intervention?,date_traitement?,motif?}
POST /anomalies/:id/verification {version,verification,agent_id,date_verification?,motif?}
POST /anomalies/bulk-statut {ids[],statut,epic_id?,…} → {ok:[ids], echecs:[{id,code,message}]}   (traitement par fiche, succès partiel)
GET  /anomalies/:id/historique     POST /anomalies/:id/restore (admin)
POST /anomalies/:id/pieces (multipart)   GET /pieces/:id/file (authentifié)   DELETE /pieces/:id
GET  /anomalies/check-link?url=…  → {plateforme, lien_normalise, matches:[…]}
GET  /anomalies/export?format=xlsx|csv&…filtres…
POST /anomalies/import/preview (multipart)  POST /anomalies/import/commit {importId,mode}  GET /anomalies/import/template
GET  /stats/overview   GET /stats/group?by=domaine|type|daira|commune|epic|agent|plateforme|priorite   GET /stats/timeline   GET /stats/activite
GET  /reports/weekly?semaine=YYYY-MM-DD[&source=snapshot&version=n]   POST /reports/weekly/snapshot {semaine}   GET /reports/weekly/history
GET/POST/PATCH /users (admin)   POST /users/:id/reset-password   GET/PUT /settings (PUT admin)
GET /admin/backups   POST /admin/backups   GET /admin/backups/:nom/download   POST /admin/backups/:nom/restore {confirm:'RESTAURER'}   DELETE /admin/backups/:nom
GET /admin/audit?action&user&from&to&page   GET /admin/audit/export
```
Création `POST /anomalies` accepte `{plateforme?, lien_url, date_publication?, date_signalement?, domaine_id, type_id, daira_id, commune_id, adresse_texte?, lieu_dit?, gps?:{lat,lng}|null, priorite?, observations?, verification?, agent_id?, statut?, epic_id?, intervenant_autre?, date_intervention?, date_traitement?, force_duplicate?}` ; l'état final est validé par **la même fonction** `validerEtat()` que les modifications. Création + historique + compteur dans **une transaction**.

### Événements d'audit
`LOGIN_OK, LOGIN_FAIL, LOGOUT, PASSWORD_CHANGE, USER_CREATE, USER_UPDATE, USER_RESET_PASSWORD, ANOMALIE_CREATE, ANOMALIE_UPDATE, ANOMALIE_STATUT, ANOMALIE_VERIFICATION, ANOMALIE_DELETE, ANOMALIE_RESTORE, IMPORT_COMMIT, EXPORT, REF_CREATE/UPDATE/DISABLE, PARAM_UPDATE, BACKUP_CREATE, BACKUP_RESTORE, BACKUP_DELETE, REPORT_SNAPSHOT`. Chaque événement a un **libellé FR et AR** dans les dictionnaires (jamais le code brut à l'écran).

---

## 7. SÉCURITÉ (et pièges de configuration)

- **Sessions maison** : jeton aléatoire 32 octets, cookie `sid` (`HttpOnly`, `SameSite=Strict`, `Path=/`, `Secure` = `COOKIE_SECURE`), seul le **hash SHA-256** est stocké ; expiration glissante `SESSION_TTL_HOURS` ; toutes les sessions d'un utilisateur sont supprimées quand son mot de passe change ou qu'il est désactivé.
- Mots de passe : ≥ 10 caractères, au moins 1 lettre et 1 chiffre, différent de l'identifiant ; bcrypt coût 12 ; changement forcé à la première connexion (`must_change_password`) ; **verrouillage 15 min après 5 échecs** ; message de connexion **générique** ; limitation `express-rate-limit` : 10 tentatives/15 min par IP+identifiant sur `/auth/login`, 600 req/min générales.
- **helmet — configuration obligatoire pour ne pas casser l'app en HTTP sur réseau local** :
  `contentSecurityPolicy: { directives: { defaultSrc:["'self'"], scriptSrc:["'self'"], styleSrc:["'self'","'unsafe-inline'"] /*Leaflet/Recharts*/, imgSrc:["'self'","data:","blob:", <origine de tile_url, {s}→*.>], fontSrc:["'self'","data:"], connectSrc:["'self'"], objectSrc:["'none'"], frameAncestors:["'none'"], baseUri:["'self'"], formAction:["'self'"], upgradeInsecureRequests: null } }`, `hsts:false` tant que `COOKIE_SECURE=false`, `crossOriginOpenerPolicy:false`, `originAgentCluster:false`, `crossOriginEmbedderPolicy:false`. (Le défaut `upgrade-insecure-requests` rend la page blanche en HTTP.)
- Requêtes SQL **uniquement paramétrées** ; colonnes de tri/filtre en liste blanche ; validation `zod` partagée sur toutes les entrées ; échappement React par défaut, **jamais** `dangerouslySetInnerHTML` ; liens affichés avec `rel="noopener noreferrer" target="_blank"`.
- **Pièces jointes** : png/jpg/webp uniquement, ≤ 5 Mo, ≤ 5 par anomalie, **type MIME + signature binaire** vérifiés, nom régénéré (UUID), stockées dans `UPLOAD_DIR` (hors dossier statique), servies par la route authentifiée.
- **Exports** : neutraliser l'injection de formules (cellule commençant par `= + - @` → préfixer `'`) ; CSV en UTF-8 avec BOM (compatibilité Excel/arabe).
- **Erreurs** : jamais de stack trace au client ; journal serveur `logs/app.log` (jamais de mots de passe/jetons).
- Mode **maintenance** (restauration de sauvegarde) : middleware renvoyant `503` pendant l'opération.

---

## 8. RÉFÉRENTIELS, SEED, ASSISTANT DE DÉMARRAGE

1. **Taxonomie** : `seed/taxonomie_anomalies.csv` (colonnes `ordre_domaine, domaine_ar, ordre_type, type_ar`) → **70 catégories / 156 types**, importés de façon **idempotente** (upsert sur `name_ar` ; une relance ne remplace jamais un `name_fr` ou un état `actif` modifié par l'admin). Le type `عام` = « Général / عام ». Texte arabe conservé **exactement** (ne pas corriger l'orthographe automatiquement).
2. **Territoire (daïras/communes), EPIC, agents** : **aucune donnée inventée**. Ils sont saisis via l'**Assistant de démarrage** (`#/assistant`, admin, affiché automatiquement à la première connexion tant que le référentiel territorial est vide) :
   - Étape 1 **Territoire** : zone de collage multi-lignes (`Daïra ; Commune` par ligne, ou `Daïra : commune1, commune2, …`) **ou** import CSV ; aperçu (nombre de daïras/communes, doublons, lignes invalides) puis validation.
   - Étape 2 **EPIC** (nom ; sigle ; domaines de compétence cochés par catégorie) — optionnelle mais conseillée.
   - Étape 3 **Agents scooters** (nom ; matricule ; téléphone) — optionnelle.
   - Étape 4 **Paramètres** (nom de la cellule, début de semaine, `tile_url`).
3. Tant que le territoire est vide : le formulaire « Nouvelle anomalie » affiche une alerte bloquante **claire** (« Aucune daïra/commune configurée ») avec un bouton vers l'assistant (admin) ou un message « Contactez l'administrateur » (autres rôles). L'application reste utilisable pour le reste.
4. **Suggestion d'EPIC** : à l'affectation, les EPIC dont les compétences incluent la catégorie sont proposés **en premier** (les autres restent sélectionnables).
5. **Démo** : `seed:demo` crée ≈ 300 anomalies fictives sur 8 semaines, **cohérentes avec toutes les règles** (statuts, dates, vérification, EPIC) via le **même service** que l'API ; si le territoire/EPIC/agents sont vides, il crée des référentiels `[DEMO]` (« [DEMO] Daïra 1 »…) ; chaque ligne porte `observations` commençant par `[DEMO]`. `seed:demo:purge` supprime **uniquement** ces lignes (et les référentiels `[DEMO]` devenus orphelins). Jamais exécuté automatiquement.

---

## 9. INTERFACE

### 9.1 Design system (tokens dans `client/src/styles/tokens.css`, mappés dans Tailwind)
Concept « institutionnel moderne » : vert émeraude (marque), or discret (accent), rouge réservé aux alertes.
```css
:root{
 --brand-950:#04261a;--brand-900:#063b27;--brand-800:#0a5a3a;--brand-700:#0b7048;--brand-600:#0e8a5a;--brand-500:#12a66d;--brand-100:#d9f5e8;--brand-50:#effaf4;
 --gold-500:#c9a227;--gold-100:#faf1cf;
 --bg:#f3f6f5;--surface:#fff;--surface-2:#f8faf9;--border:#e3e9e6;--ink:#0d1b16;--ink-2:#3d4f47;--muted:#5f716a;
 --st-non:#b91c1c;--st-non-bg:#fee2e2;--st-cours:#b45309;--st-cours-bg:#fef3c7;--st-traite:#047857;--st-traite-bg:#d1fae5;
 --danger:#b91c1c;--warning:#b45309;--info:#0369a1;
 --r-sm:8px;--r-md:12px;--r-lg:18px;--r-xl:24px;
 --shadow-1:0 1px 2px rgba(6,59,39,.06);--shadow-2:0 6px 20px -6px rgba(6,59,39,.14);--shadow-3:0 24px 48px -16px rgba(6,59,39,.28);
 --ring:0 0 0 3px rgba(18,166,109,.4);--ease:cubic-bezier(.22,.9,.3,1);color-scheme:light}
[data-theme="dark"]{
 --bg:#08110e;--surface:#0f1b16;--surface-2:#132320;--border:#24392f;--ink:#e8f3ee;--ink-2:#b4c7be;--muted:#92a89e;
 --st-non:#f87171;--st-non-bg:#3a1414;--st-cours:#fbbf24;--st-cours-bg:#3a2a0b;--st-traite:#34d399;--st-traite-bg:#0c3326;
 --brand-50:#0d2a1f;--brand-100:#103a2a;color-scheme:dark}
```
Les couleurs de texte sur fond de statut respectent le contraste AA dans **les deux thèmes** (vérifié par `check:a11y`). Thème initial = `prefers-color-scheme`, puis choix mémorisé (`localStorage` dans un `try/catch`).
- **Typographie** : Inter (latin) + Cairo (arabe) embarquées via npm ; fallback `Segoe UI, Tahoma, Arial`. Chiffres `tabular-nums`. Échelle 12/13/14/16/20/24/32/40. Texte courant 14 px / 1.55.
- **Icônes** : `lucide-react`. Logos de réseaux sociaux : **pastilles typographiques** (initiales sur fond de couleur de marque neutre), pas de logos.
- **Mouvement** (160–220 ms, `--ease`) : apparition échelonnée des cartes, compteurs KPI animés, tracé des graphiques, `active:scale-[.98]` ; **tout désactivé** sous `prefers-reduced-motion`.
- **Mélange arabe/latin** : tout nom issu du référentiel est entouré de `<bdi>` ; `dir` posé sur `<html>`.

### 9.2 Composants `client/src/components/ui/` (utilisés **partout**, aucun style ad hoc)
`Button`(primary/secondary/ghost/danger, sm/md/lg, loading) · `IconButton` · `Card`/`CardHeader` · `StatusBadge`(icône+texte) · `PriorityBadge` · `VerificationBadge` · `Input` · `Textarea`(compteur) · `Select` · `Combobox`(recherche normalisée arabe/latin, clavier complet) · `SegmentedControl` · `Tabs` · `DataTable`(en-tête collant, tri, sélection, densité confortable) · `Pagination`(« Précédent / Suivant », numéros, taille de page, « Affichage 1–25 sur 312 ») · `Skeleton` · `EmptyState`(illustration SVG inline + action) · `Alert`(info/warning/danger/success) · `Toast` · `Dialog`(piège de focus, `Esc`) · `Drawer` · `Tooltip` · `KpiCard`(icône, valeur animée, variation ▲▼, sparkline) · `Gauge` · `ProgressBar` · `Avatar`(initiales) · `Breadcrumbs`.
Règles : champ 44 px de haut, rayon 12 px, libellé au-dessus, erreur sous le champ, focus visible `--ring`, cibles tactiles ≥ 44 px, **jamais la couleur seule** pour porter une information.

### 9.3 Shell
- **Barre latérale** (à droite en arabe) : dégradé `--brand-950 → --brand-800`, monogramme SVG + « Wilaya d'Alger / Cellule technique de numérisation », **bouton CTA « Nouvelle anomalie »** séparé de la navigation, puis : Tableau de bord · Anomalies · Carte · Rapport hebdomadaire · Administration (admin). **État actif** = fond translucide + barre or de 3 px côté début + `aria-current="page"`. Repliable en icônes ; tiroir sur mobile.
- **Motif décoratif** : étoile à 8 branches (deux carrés décalés de 45°) en tuile SVG sans coutures (`shape-rendering:geometricPrecision`, taille de tuile = viewBox), **opacité ≤ 4 %**, masquée par `mask-image` dégradé pour n'apparaître qu'en bas de la barre et **ne jamais croiser les libellés**.
- **Pied de barre** : avatar + nom complet + rôle (« Administrateur »).
- **Barre supérieure** collante (verre léger) : fil d'Ariane, **recherche globale** (raccourci `/` ; résultats en liste déroulante sur référence, lien, adresse, type ; `Entrée` → liste filtrée), bouton « Nouvelle anomalie », bascule **FR | العربية**, bascule thème, **menu utilisateur** (nom, rôle, changer le mot de passe, déconnexion) — tous avec infobulle et `aria-label`.
- **Layout sans débordement** : `grid-template-columns: auto minmax(0,1fr)`, `min-w-0` sur le contenu, aucune largeur `100vw` ; conteneur `max-w-[1480px]` centré, marges 24–32 px (16 mobile). **Aucune barre de défilement horizontale de page** à 390/768/1024/1440 px (testé).
- Écran de **connexion** : panneau marque (dégradé + motif) + formulaire ; erreurs claires ; redirection vers `#/profil` si `must_change_password`.

### 9.4 Page « Nouvelle anomalie » / modification
Sections en cartes, grille 12 colonnes (2 colonnes ≥ 1024 px, 1 colonne sinon), **barre d'actions collante** (Annuler · Enregistrer · **Enregistrer et nouveau** — conserve daïra, date et plateforme).
1. **Source** : Lien (champ large, placeholder complet), plateforme **détectée** (puce modifiable), date de publication, date de signalement (défaut aujourd'hui). Contrôle de doublon **en direct** (`check-link`) : bandeau listant les fiches existantes ; confirmation explicite si on poursuit.
2. **Classification** : Catégorie (Combobox) → Type (filtré), Priorité (segmenté).
3. **Localisation** : Daïra → Commune (filtrée), adresse, lieu-dit, **GPS** (parseur § 4.6, bouton **Ma position**, lien « Ouvrir dans Google Maps/OSM »), mini-carte cliquable (repli hors-ligne identique).
4. **Vérification & traitement** : Vérification, Agent, Statut, EPIC (libellé « Non affecté » ; sinon « Autre intervenant » + champ texte), dates **affichées seulement quand pertinentes** ; les options de statut non permises par l'état courant sont **désactivées avec explication** (« Confirmez d'abord la vérification »).
5. **Observations** (vraie `Textarea` 4 lignes) + **pièces jointes** (glisser-déposer, aperçu).
Validation en ligne avec les schémas partagés, focus sur la première erreur, toast de succès avec lien vers la fiche, gestion du `409 VERSION_CONFLICT` (proposer de recharger).

### 9.5 Liste des anomalies
En-tête : titre + compteur + boutons **Exporter** et **Nouvelle anomalie**. Carte de filtres : recherche, **Statut** (libellé explicite), Vérification, Catégorie→Type, Daïra→Commune, EPIC, Agent, Plateforme, Période, Priorité ; pastilles de filtres actifs, « Réinitialiser », filtres dans l'URL. Tableau : sélection · Référence · Date · Plateforme · Statut (menu inline) · Catégorie · Type · Daïra/Commune · EPIC · Vérification · Priorité · Lien · GPS (copie) · actions. **Barre d'actions groupées** en bas à la sélection (en cours / traité / affecter EPIC, avec saisie des champs requis dans un dialogue et **rapport de succès partiel**). Clic ligne → **tiroir d'aperçu**. **Mobile < 768 px : liste en cartes**. États : skeleton, vide illustré (avec action), erreur avec « Réessayer ».

### 9.5b Fiche détail
Tous les champs, mini-carte, pièces jointes, **chronologie** complète (qui, quand, quoi, motif), actions rapides (Confirmer, Infirmer, Marquer en cours, Marquer traité, Rouvrir — avec dialogues demandant les champs/motifs requis), Modifier, Supprimer (admin, confirmation).

### 9.6 Tableau de bord
En-tête : « Bonjour {nom} », date, `SegmentedControl` période (Cette semaine · Semaine dernière · Ce mois · 30 jours · Toutes · Personnalisé), bascule « Inclure les infirmées », bouton Nouvelle anomalie. Mention explicite « Statut actuel des anomalies reçues sur la période ».
- **6 cartes KPI** : Total · Non traitées · En cours · Traitées · Taux de traitement (jauge) · Délai moyen ; variations ; deux bandeaux cliquables (*Urgentes ouvertes*, *En retard > N jours*).
- **Anneau de statuts** (total au centre, légende n et %), **évolution 12 semaines** (aires reçues vs traitées), **par catégorie** (barres horizontales empilées, top 12 + « Voir tout »), **par type** (avec recherche), **par daïra**, **par commune**, **par EPIC** (barres de progression), **tableau détaillé Catégorie → Type** repliable avec totaux, **activité récente** (10 derniers changements).
- Tout élément est **cliquable** vers la liste pré-filtrée.
- **Graphiques fiables** : chaque graphique dans un conteneur à **hauteur explicite** (`h-[320px]`) avec `ResponsiveContainer width="100%" height="100%"`, enfants de grille en `min-w-0`, couleurs via variables CSS, axes/ordre inversés en RTL, info-bulle personnalisée. **Données à 0** → version « fantôme » du graphique + message « Aucune donnée sur la période » (jamais un cadre vide). États chargement/vide/erreur pour chaque bloc.

### 9.7 Carte
Hauteur `calc(100dvh − topbar)`, panneau latéral repliable (filtres + **liste des anomalies visibles**, clic ↔ centrage), légende, compteur. Centre Alger (36.7538, 3.0588, zoom 11), `fitBounds` si marqueurs. Marqueurs `divIcon` SVG colorés par statut (pas d'images Leaflet par défaut), clustering, info-bulle (référence, type, statut, « Ouvrir la fiche »). `invalidateSize()` à l'ouverture/repli du panneau et au redimensionnement. **Repli hors-ligne** : sur `tileerror`, fond quadrillé aux couleurs du thème + `Alert` discrète (« Fond de carte indisponible — marqueurs actifs ») + lien vers le paramètre `tile_url` pour l'admin. Attribution `prefix:false`, texte « © OpenStreetMap contributors ». Tuiles assombries en thème sombre (filtre CSS). Contrôles Leaflet stylés avec les tokens.

### 9.8 Rapport hebdomadaire
Sélecteur de semaine (◀ `JJ/MM/AAAA → JJ/MM/AAAA` ▶, « Cette semaine »), actions : **Imprimer / PDF** (primaire), Exporter Excel, Figer la synthèse, Copier le résumé ; boutons désactivés **avec infobulle** s'il n'y a rien à exporter. Le rapport est rendu comme une **feuille A4 claire centrée** dans une portée `.report-paper { color-scheme: light; --ink:…; --surface:… }` — identique à l'impression, **même en thème sombre**.
Contenu : en-tête officiel (Wilaya d'Alger — Cellule technique de numérisation, titre, période, date de génération, auteur) · **8 KPI** (reçues, traitées dans la semaine, en cours / non traitées avec n et %, taux de traitement, délai moyen, stock ouvert) avec variation vs semaine précédente · graphiques (anneau, barres par catégorie, évolution 8 semaines) · tableaux par catégorie, type, daïra, commune, EPIC · **urgentes** et **ouvertes depuis > N jours** · bloc signature/visa.
**Impression** : `@media print` A4, marges 12 mm, `print-color-adjust: exact`, en-têtes de tableaux répétés, sauts de page propres, masquage shell/actions, thème clair forcé. **Figer** : crée une **nouvelle version** (`version+1`) ; la liste d'historique permet de rouvrir une version figée (bandeau « Version figée du JJ/MM/AAAA HH:mm »). **Copier le résumé** produit un texte court :
```
Synthèse hebdomadaire — Cellule technique de numérisation, Wilaya d'Alger
Semaine du 25/10/2026 au 31/10/2026
Anomalies reçues : 42 — Traitées : 25 (59,5 %) — En cours : 9 (21,4 %) — Non traitées : 8 (19,0 %)
Traitées durant la semaine (toutes dates de réception) : 31 · Stock ouvert : 57 (▲ 4)
Top catégories : …  · Urgentes ouvertes : 3 · En retard (> 7 j) : 11
```

### 9.9 Administration (onglets, URL `#/admin/:onglet`, admin uniquement)
1. **Référentiels** : sous-onglets catégories, types (filtrés par catégorie), daïras, communes (filtrées par daïra), EPIC (compétences), agents ; `DataTable` + `Drawer` d'édition ; activer/désactiver ; import CSV avec aperçu.
2. **Utilisateurs** : création, rôle, activation, réinitialisation (mot de passe temporaire + changement forcé).
3. **Paramètres** : nom de la cellule, début de semaine, délai de retard, exiger la vérification, `tile_url`, rétention des sauvegardes.
4. **Sauvegardes** : tableau (date/heure lisible, nom, taille, type Manuelle/Automatique/Sécurité), **Télécharger**, **Restaurer**, **Supprimer**, bouton « Nouvelle sauvegarde ». Pagination 10.
5. **Journal d'audit** : `DataTable` thémée — Date/heure · Utilisateur · Action (libellé FR/AR) · Entité · Détail · IP ; filtres action/utilisateur/période ; pagination ; export CSV.
6. **Import / Export** : export xlsx/csv, import avec modèle téléchargeable et aperçu.
7. **Corbeille** : anomalies supprimées, restauration.

### 9.10 Internationalisation et RTL
Bascule FR ↔ AR instantanée et mémorisée, `<html lang dir>` mis à jour. Propriétés logiques Tailwind **partout** ; icônes directionnelles retournées en RTL ; graphiques/tableaux/menus miroités ; polices Cairo en arabe. **Toute chaîne** passe par le dictionnaire ; accents français corrects (test qui échoue sur `categorie, reception, entite, reference, deconnexion, repartition, evolution, traitee` sans accent) ; **parité FR/AR des clés testée**. Noms de référentiel : arabe par défaut ; en français, `name_fr` s'il existe sinon le nom arabe.

### 9.11 Accessibilité, responsive, performance
Contraste **AA** dans les deux thèmes ; focus visible ; navigation clavier complète (combobox, menus, dialogues piégeant le focus, `Esc`) ; `aria-label` sur boutons-icônes ; labels associés ; raccourcis `N` (nouvelle anomalie) et `/` (recherche). Responsive 390/768/1024/1440. Découpage par route (`React.lazy`), carte chargée à la demande, `useMemo` sur les graphiques, liste virtualisée > 200 lignes affichées, bundle initial < 300 ko gzip hors carte. **Zéro erreur/avertissement** console sur les parcours principaux.

---

## 10. IMPORT / EXPORT
- **Export** (respecte les filtres) : xlsx (`exceljs`, en-têtes FR, dates `JJ/MM/AAAA`, % en format natif, largeur auto, volet figé) et csv (BOM). Neutralisation des formules.
- **Modèle d'import** téléchargeable. Colonnes : `lien_url, date_signalement, categorie, type, daira, commune, gps, adresse, priorite, verification, agent, statut, epic, date_intervention, date_traitement, observations`. Correspondance des noms par `normalize()` sur `name_ar`/`name_fr` ; ambiguïté ou inconnu → erreur de ligne explicite.
- **Aperçu** (fichier ≤ 5 Mo, ≤ 5 000 lignes) : par ligne `ok | warning | error` + messages ; **les lignes passent par le même service** que l'API (mêmes règles) ; doublon de lien = avertissement, doublon strict = erreur. **Validation** : mode `valid_only` (défaut, importe les lignes valides et fournit un rapport téléchargeable des erreurs) ou `all_or_nothing` ; une seule transaction ; audit `IMPORT_COMMIT` avec compteurs.

---

## 11. SAUVEGARDE ET RESTAURATION
- Sauvegarde cohérente via l'API de sauvegarde SQLite (`db.backup()`), nom **déterministe** `anomalies-YYYYMMDD-HHmmss-{manuelle|auto|securite}.db`. **Une seule sauvegarde automatique par jour** (idempotente, au démarrage si absente + planificateur quotidien). Rétention `backup_retention_days` (+ toujours les 7 dernières ; 10 dernières « securite »). **Les tests utilisent un dossier temporaire et ne touchent jamais `BACKUP_DIR`.**
- **Restauration** : dialogue de confirmation avec saisie du mot « RESTAURER » → vérification du fichier (`PRAGMA integrity_check`, version de schéma ≤ courante) → **sauvegarde de sécurité** automatique → mode maintenance (503) → checkpoint WAL, fermeture, remplacement du fichier (et suppression de `-wal`/`-shm`), réouverture, migrations → fin de maintenance → audit + toast. Rollback automatique vers la sauvegarde de sécurité en cas d'échec.
- Toute création/restauration/suppression est journalisée dans l'audit.

---

## 12. TESTS ET GARDE-FOUS AUTOMATIQUES

**Unitaires (Vitest)** : `normalize` (arabe/latin), `url` (plateformes, paramètres de suivi, schémas dangereux), `gps` (tous formats, inversion, bbox), `dates` (semaine avec `week_start_day` 0..6, passage de mois/année, fuseau), `percent` (somme = 100,0 ; zéro), `statutAu`, schémas zod.
**Intégration (Supertest, base temporaire)** : auth (verrouillage, CSRF, sessions invalidées au changement de mot de passe), permissions par rôle (matrice § 4.7), toutes les règles § 4.1–4.5 (chaque transition permise/interdite, dates, intervenant, verrou optimiste, doublons lien/strict, intégrité type↔catégorie et commune↔daïra, suppression logique exclue partout), historique, pagination/tri en liste blanche, import (aperçu/validation/erreurs), export (injection de formules), sauvegarde/restauration (dossier temporaire), stats (semaine vide, division par zéro, infirmées exclues, `statutAu`, comparaison S−1, cohérence tableau de bord ↔ rapport), seed (**156 types / 70 catégories**, idempotence), perf (50 000 lignes : stats et liste < 300 ms).
**`npm run check:styles`** : échoue si `bg-white|text-white|bg-gray|text-gray|bg-slate|bg-blue|bg-green|bg-red|text-blue|border-gray|#fff|#[0-9a-f]{3,8}` apparaissent hors `tokens.css` et `components/ui/` ; intégré à `npm test`.
**`npm run check:a11y`** : pour **chaque route** × **thème clair/sombre** × **FR/AR**, avec données de démo, 0 violation axe `color-contrast`, `label`, `button-name`, `link-name` (serious/critical) ; **pas de défilement horizontal de page** à 390/768/1024/1440 px ; le menu actif correspond à la route. Fallback si Playwright est impossible : script Node de calcul de contraste sur les tokens.
**Tests i18n** : parité FR/AR, mots sans accents interdits.
**E2E (`npm run test:e2e`)** : scénarios § 13.

---

## 13. SCÉNARIOS DE RECETTE (tous doivent passer — automatisés si possible)

1. Premier démarrage : mot de passe admin affiché → connexion → changement forcé → assistant → collage du territoire → aperçu → validation → 1 EPIC et 1 agent créés.
2. Saisie d'une anomalie avec lien Facebook : plateforme détectée, cascades catégorie→type et daïra→commune, GPS collé depuis un lien Google Maps, enregistrement → fiche avec référence `ANM-AAAA-00001`.
3. Même lien saisi à nouveau : avertissement `DUPLICATE_LINK` ; confirmation → 2ᵉ fiche créée ; même lien + même type + même commune → refus `DUPLICATE_STRICT`.
4. Tentative de passer « en cours » sans vérification → refus explicite ; vérification « confirmée » avec agent → passage « en cours » avec EPIC et date → « traité » avec date ; l'historique montre 4 lignes lisibles.
5. Réouverture d'une fiche traitée sans motif → refus ; avec motif → `en_cours`, `date_traitement` effacée.
6. Vérification « infirmée » : statut forcé non traité, fiche **absente** des statistiques et réapparaissant avec « Inclure les infirmées ».
7. Modification simultanée de la même fiche par deux sessions → la seconde reçoit `VERSION_CONFLICT`.
8. Liste : combinaison de 5 filtres + recherche arabe sans diacritiques, tri, pagination, export xlsx de la sélection filtrée (nombre de lignes identique).
9. Actions groupées sur 5 fiches dont 1 invalide → 4 succès, 1 échec expliqué.
10. Tableau de bord (démo) : somme des statuts = total, pourcentages = 100,0 %, clic sur une barre → liste filtrée de même effectif.
11. Rapport hebdomadaire : chiffres identiques au tableau de bord pour la même cohorte ; figer → version 1 ; modification d'une fiche puis re-figer → version 2 ; la version 1 reste inchangée ; impression A4 lisible (FR et AR).
12. Carte : marqueurs corrects, repli hors-ligne visible quand les tuiles échouent, filtres et liste latérale cohérents.
13. Sauvegarde manuelle → modification de données → restauration (avec confirmation) → données d'avant retrouvées + sauvegarde de sécurité créée + audit complet.
14. Rôles : un `lecteur` ne voit aucune action d'écriture et reçoit `403` en appel direct ; un `operateur` n'accède pas à l'administration.
15. Bascule FR → AR (RTL) et clair → sombre sur **toutes** les pages : aucun texte illisible, aucun débordement, « Déconnexion » accessible dans le menu utilisateur.
16. Import de 500 lignes (dont 20 erreurs variées) → rapport d'erreurs exact, 480 créées, audit.
17. Purge de la démo → pages en **état vide** soignées (aucun cadre vide muet).

---

## 14. PIÈGES CONNUS (à éviter explicitement)
- CSP `upgrade-insecure-requests` par défaut de helmet ⇒ page blanche en HTTP local (voir § 7).
- Recharts à hauteur 0 si le parent n'a pas de hauteur explicite ; grille/flex sans `min-w-0`.
- Icônes de marqueur Leaflet cassées par le bundler ⇒ `divIcon`.
- Carte grise : `invalidateSize()` oublié après changement de layout.
- `new Date('YYYY-MM-DD')` interprété en local ⇒ semaines décalées.
- Tri/filtre par colonne arbitraire fournie par le client (injection) ⇒ liste blanche.
- Stats calculées sur des lignes `deleted_at` ou infirmées par oubli.
- Classes Tailwind `left/right` en RTL ⇒ propriétés logiques.
- Ordre des champs de date incohérent ⇒ contraintes `CHECK` + validation partagée.
- Tests écrivant dans le vrai dossier de sauvegarde ⇒ dossier temporaire obligatoire.
- Scripts npm avec commandes Unix uniquement ⇒ casser sous Windows.

---

## 15. DOCUMENTATION À LIVRER
`README.md` (installation Windows et Linux, premier démarrage, assistant, usage quotidien, sauvegarde/restauration, réinitialisation du mot de passe admin, pare-feu Windows pour accès réseau local, dépannage) · `PLAN.md` · `DECISIONS.md` · `AUDIT.md` · captures dans `docs/screens/` (FR clair, FR sombre, AR sombre ; 1440 et 390 px).