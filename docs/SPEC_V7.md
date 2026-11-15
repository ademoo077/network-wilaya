# SPÉCIFICATION V7 — Module « Veille citoyenne » : collecte des publications et qualification par mots-clés
**Complète V4 (socle), V5 (collage/GPS/statistiques) et V6 (fiabilisation).** Placer dans `docs/SPEC_V7.md` et `lexique_initial_veille.csv` dans `seed/`.
Priorités : **P1** obligatoire · **P2** après validation des P1 · **P3** optionnel.

---

## 0. CADRE RÉALISTE — CE QUI EST POSSIBLE, ET COMMENT

**Objectif métier** : détecter dans les publications publiques (pages Facebook et autres sources) celles qui parlent d'**anomalies de voirie et d'environnement** à Alger, les classer par **mots techniques** (FR / arabe / darija / arabizi), et les proposer à la cellule pour **qualification** puis création d'une fiche anomalie.

**Vérité technique à respecter (ne rien promettre d'impossible, ne rien contourner)** :
- Facebook **n'offre pas de flux public complet** des pages tierces. CrowdTangle a été arrêté en août 2024 ; la Meta Content Library est réservée à la recherche. La lecture des publications de pages **tierces** via l'API Graph exige la fonctionnalité **« Page Public Content Access »**, soumise à **validation Meta** (App Review, vérification d'entreprise, politique de confidentialité). *Les conditions évoluent : toute décision se vérifie dans la documentation Meta en vigueur.*
- Le **scraping de l'interface Facebook** (automatisation de navigateur, comptes factices, contournement de connexion/captcha) **viole ses conditions**, est fragile, expose l'institution (blocage, litige, atteinte aux données personnelles) et **n'est pas implémenté ici**. Ne pas le proposer, ne pas le contourner.
- Conséquence : **« tout le flux » n'est pas atteignable par une seule voie**. La couverture maximale s'obtient en **combinant des connecteurs légitimes**, avec une architecture où chaque source est interchangeable.

| Connecteur | Nature | Données | Effort | Prio |
|---|---|---|---|---|
| **A. Facebook — pages administrées par la Wilaya** (API Graph, jeton de page) | Officiel | Publications, **commentaires**, mentions, (Messenger) | Moyen | **P1** |
| **B. Capture assistée** (extension navigateur, action manuelle de l'agent) | Action utilisateur | URL + texte sélectionné + métadonnées publiques | Faible | **P1** |
| **C. Flux RSS/Atom** (presse locale, APS, sites officiels, Google Actualités par mots-clés) | Public, standard | Titre, résumé, lien, date | Faible | **P1** |
| **D. Import** CSV / JSON / export WhatsApp `.txt` | Fichier | Liens, textes | Faible | **P1** |
| **E. Facebook — pages publiques tierces** (« Page Public Content Access ») | Officiel **sous réserve de validation Meta** | Publications des pages listées | Élevé (démarches) | P2 (conditionnel) |
| **F. YouTube Data API v3** (recherche par mots-clés, région DZ) | Officiel (quota) | Vidéos, descriptions, commentaires | Moyen | P2 |
| **G. Instagram Graph** (hashtags, compte pro lié) | Officiel (limites strictes) | Médias par hashtag | Moyen | P3 |
| **H. Telegram — canaux publics** (API officielle, lecture seule) | Officiel | Messages publics | Moyen | P3 |
| **I. Prestataire d'écoute sociale agréé** | Licence de données | Flux agrégés | Budget | Alternative |

---

## 1. ARCHITECTURE

**Flux** : `Connecteur → normalisation → analyse (langue, mots-clés, score, territoire, priorité) → dédoublonnage → Boîte de veille (triage humain) → fiche anomalie`. **Un humain valide toujours** avant toute création de fiche (aucune création automatique).

- **Interface connecteur** (`server/src/veille/connectors/*.js`) : `{ id, type, schemaConfig(zod), tester(config), collecter({curseur, depuis}) → {elements[], curseurSuivant}, mapper(brut) → ElementNormalise }`. Ajouter une source = ajouter un fichier, sans toucher au reste.
- **Planificateur** : tâches persistées (`veille_jobs`), exécutées dans le processus (aucune dépendance externe), fréquence par source (`frequence_min`, défaut 30), **verrou** anti-chevauchement, **backoff exponentiel** en cas d'erreur, respect des quotas/limites de débit, reprise après redémarrage, bouton « Collecter maintenant ».
- **Idempotence** : `UNIQUE(source_id, id_externe)` ; une collecte rejouée ne crée jamais de doublon.
- **Secrets** (jetons, clés d'API, secrets d'application) : **chiffrés au repos** (AES-256-GCM, clé `SECRETS_KEY` dans `.env`), jamais journalisés, affichés masqués, rotation possible, alerte avant expiration d'un jeton.
- **Réseau sortant** : réutiliser la couche V6 (proxy `OUTBOUND_PROXY`, liste blanche de domaines par connecteur, protection SSRF pour toute URL fournie par un utilisateur, timeouts, taille de réponse bornée).
- **Hors-ligne partiel** : l'application reste entièrement utilisable si les sources externes sont indisponibles ; l'état de chaque source est visible.
- **Interface** : nouvelle section `#/veille` (voir § 5) ; permissions : `admin` (tout), `operateur` (triage, lecture), `lecteur` (lecture du tableau de veille). Audit de toutes les actions.

---

## 2. DONNÉES (migration `004_veille.sql`)

```sql
veille_sources(id INTEGER PRIMARY KEY, type TEXT NOT NULL CHECK(type IN ('facebook_page_geree','facebook_page_publique','capture_assistee','rss','google_news','youtube','instagram','telegram','import')),
  nom TEXT NOT NULL, config_chiffree TEXT, actif INTEGER NOT NULL DEFAULT 1, frequence_min INTEGER NOT NULL DEFAULT 30,
  derniere_execution TEXT, dernier_statut TEXT, dernier_message TEXT, curseur TEXT, quota_json TEXT, ...);
veille_elements(id INTEGER PRIMARY KEY, source_id INTEGER NOT NULL REFERENCES veille_sources(id), id_externe TEXT NOT NULL,
  url TEXT, url_normalise TEXT, page_nom TEXT, auteur_pseudo TEXT,            -- pseudonyme HMAC, jamais l'identité (§ 6)
  texte TEXT NOT NULL, texte_norm TEXT NOT NULL, langue TEXT,                  -- ar|fr|mix
  date_publication TEXT, collecte_le TEXT NOT NULL, type_media TEXT, metriques_json TEXT,
  gps_lat REAL, gps_lng REAL, simhash TEXT, groupe_doublon_id INTEGER,
  score REAL NOT NULL DEFAULT 0, confiance TEXT CHECK(confiance IN ('haute','moyenne','basse')),
  statut TEXT NOT NULL DEFAULT 'nouveau' CHECK(statut IN ('nouveau','a_qualifier','retenu','rejete','doublon','ignore')),
  raison_rejet TEXT, anomalie_id INTEGER REFERENCES anomalies(id), traite_par INTEGER REFERENCES users(id), traite_le TEXT,
  expire_le TEXT, UNIQUE(source_id, id_externe), ...);
veille_correspondances(element_id INTEGER NOT NULL REFERENCES veille_elements(id) ON DELETE CASCADE, terme_id INTEGER NOT NULL REFERENCES veille_lexique(id),
  occurrences INTEGER NOT NULL, poids_total REAL NOT NULL, PRIMARY KEY(element_id, terme_id));
veille_suggestions(element_id INTEGER NOT NULL REFERENCES veille_elements(id) ON DELETE CASCADE, rang INTEGER NOT NULL,
  groupe_id INTEGER, domaine_id INTEGER, type_id INTEGER, score REAL NOT NULL, commune_id INTEGER, daira_id INTEGER,
  priorite TEXT, source_geo TEXT, PRIMARY KEY(element_id, rang));
veille_lexique(id INTEGER PRIMARY KEY, terme TEXT NOT NULL, terme_norm TEXT NOT NULL, langue TEXT NOT NULL CHECK(langue IN ('ar','fr','dz','mix')),
  role TEXT NOT NULL CHECK(role IN ('theme','urgence','exclusion')), groupe_id INTEGER REFERENCES groupes_domaines(id),
  domaine_id INTEGER REFERENCES domaines(id), type_id INTEGER REFERENCES types_anomalie(id), poids INTEGER NOT NULL CHECK(poids BETWEEN -5 AND 5),
  actif INTEGER NOT NULL DEFAULT 1, origine TEXT NOT NULL DEFAULT 'seed' CHECK(origine IN ('seed','admin','appris')),
  vus INTEGER NOT NULL DEFAULT 0, acceptes INTEGER NOT NULL DEFAULT 0, rejetes INTEGER NOT NULL DEFAULT 0, UNIQUE(terme_norm, langue, role, domaine_id), ...);
veille_alias_lieux(id INTEGER PRIMARY KEY, alias TEXT NOT NULL, alias_norm TEXT NOT NULL, commune_id INTEGER REFERENCES communes(id), daira_id INTEGER REFERENCES dairas(id), UNIQUE(alias_norm));
veille_jetons(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, nom TEXT NOT NULL, hash TEXT NOT NULL UNIQUE,
  portee TEXT NOT NULL DEFAULT 'capture', derniere_utilisation TEXT, revoque INTEGER NOT NULL DEFAULT 0, ...);   -- jeton de l'extension
veille_jobs(id INTEGER PRIMARY KEY, source_id INTEGER NOT NULL REFERENCES veille_sources(id), statut TEXT NOT NULL, debut TEXT, fin TEXT,
  nb_collectes INTEGER DEFAULT 0, nb_nouveaux INTEGER DEFAULT 0, erreur_code TEXT, erreur_message TEXT);
veille_alertes(id INTEGER PRIMARY KEY, regle TEXT NOT NULL, gravite TEXT NOT NULL, titre TEXT NOT NULL, details_json TEXT, lue INTEGER NOT NULL DEFAULT 0, ...);
ALTER TABLE anomalies ADD COLUMN veille_element_id INTEGER REFERENCES veille_elements(id);
```
Index : `veille_elements(statut, date_publication)`, `(source_id)`, `(groupe_doublon_id)`, `(expire_le)`, `(simhash)` ; `veille_lexique(terme_norm)`.
**Paramètres** : `veille_activee=0`, `veille_conservation_jours=90`, `veille_seuil_suggestion=4`, `veille_seuil_pertinent=2`, `veille_filtre_geo='source_ou_lieu'` (`strict` : lieu requis · `source_ou_lieu` · `aucun`), `veille_pseudonymiser_auteurs=1`, `veille_stocker_auteur=0`, `veille_fenetre_doublon_h=72`.
**Seed** : `seed/lexique_initial_veille.csv` (`groupe_fr, domaine_ar, terme, langue, role, poids` ; 270 termes FR/AR/arabizi couvrant les 9 groupes + urgence + exclusion) → `veille_lexique` (idempotent, `origine='seed'`). **C'est une proposition à valider par la cellule** (affichée comme telle dans l'interface), non une vérité.

---

## 3. MOTEUR D'ANALYSE (`shared/veille/` — partagé, testé, déterministe, **sans IA**)

### 3.1 Normalisation du texte
1. NFKC ; minuscules latines ; suppression des accents latins ; chiffres arabes-indiens → `0-9`.
2. **Arabe** : suppression des diacritiques (U+064B–U+065F, U+0670) et du tatweel ; unification `أ إ آ ٱ → ا`, `ى → ي`, `ة → ه` ; compactage des lettres répétées (`ههههه`, `مرااااه` → max 2) ; retrait des préfixes courants (`ال`, `وال`, `بال`, `لل`, `و`, `ب`, `ل`, `ف`, `ك`, `س`) et suffixes (`ات`, `ون`, `ين`, `ها`, `هم`, `ة`) **uniquement pour la comparaison** (racine légère), le texte original est conservé pour l'affichage.
3. **Arabizi / darija écrite en lettres latines** : variantes de substitution `3→ع, 7→ح, 9→ق, 5→خ, 8→غ, 6→ط, 2→ء` appliquées pour produire une forme arabe candidate ; correspondance aussi directe avec les termes `langue='dz'` (ex. `zbel`).
4. **Français** : élimination des apostrophes, pluriels simples (`s`, `x`), élisions (`l'`, `d'`), segmentation par mots ; expressions multi-mots conservées.
5. **Langue** détectée par proportion de lettres arabes (`ar` > 70 %, `fr` < 30 %, sinon `mix`).
6. **Nettoyage** : suppression des URL, `@mentions`, hashtags **conservés** (le `#` retiré, utiles comme mots-clés), emojis ignorés, texte tronqué à 10 000 caractères.

### 3.2 Correspondance et score
- Moteur de recherche multi-motifs compilé (automate Aho-Corasick ou regex alternation par langue) sur le texte normalisé ; expressions multi-mots prioritaires sur les mots isolés ; **chevauchements** : la correspondance la plus longue gagne.
- **Règles de co-occurrence** (P2, table `veille_regles`) : `ET(fuite, eau)` à ≤ 5 mots, avec poids dédié.
- `score_theme(groupe/domaine/type) = Σ poids × min(occurrences, 2)` ; **bonus de diversité** (+1 par terme distinct au-delà du 2ᵉ) ; **malus d'exclusion** (somme des poids négatifs) ; les termes d'**urgence** n'ajoutent pas de thème mais relèvent la priorité (§ 3.5).
- **Multi-étiquettes** : jusqu'à 3 suggestions classées par score (`veille_suggestions`).
- **Confiance** : `haute` si score ≥ `seuil_suggestion` + 3 et ≥ 2 termes distincts ; `moyenne` si ≥ `seuil_suggestion` ; `basse` si ≥ `seuil_pertinent` ; sinon l'élément est `ignore` (**conservé** jusqu'à expiration pour l'audit de rappel).
- **Affinage type/domaine** : un terme rattaché à un `type_id`/`domaine_id` précis oriente la suggestion ; sinon la suggestion est au niveau du **groupe**, et le type est proposé par le moteur de recherche « type d'abord » de la V5 sur les termes détectés.

### 3.3 Territoire
Ordre : (1) **géolocalisation fournie** par la source (lieu/GPS de l'API) → `/geo/locate` ; (2) **alias de lieux** (`veille_alias_lieux` : quartiers, cités, lieux-dits) puis noms de **communes/daïras** FR/AR du référentiel (avec la normalisation du § 3.1) ; (3) **liste blanche de sources locales** (page rattachée à une commune/daïra → territoire par défaut). Le filtre `veille_filtre_geo` écarte (ou pénalise de −2) les éléments sans rattachement à Alger. Les alias sont enrichis par **apprentissage** : un alias absent mais fréquent dans les éléments retenus d'une commune est **proposé** à l'admin.

### 3.4 Dédoublonnage
(1) même `id_externe` ; (2) même `url_normalise` (V4 § 4.5) ; (3) **simhash 64 bits** du texte normalisé, distance de Hamming ≤ 3 dans `veille_fenetre_doublon_h` → `groupe_doublon_id` ; (4) **événement** = même type/groupe + même commune + 48 h : regroupés (compteur de sources, de partages) — un événement multi-sources est un **indicateur de gravité**.

### 3.5 Priorité
`urgente` si terme d'urgence **et** (viralité élevée **ou** groupe « Risques naturels/Bâtiments ») ; `haute` si terme d'urgence ou viralité élevée ; sinon `normale`. **Viralité** = rang percentile des (réactions + 2×commentaires + 3×partages) parmi les 30 derniers jours **de la même source** (seuil `p90`), jamais un seuil absolu.

### 3.6 Apprentissage explicable (P1, sans IA)
À chaque décision (retenu / rejeté / type corrigé), mettre à jour `vus/acceptes/rejetes` des termes concernés. Calculer et **proposer** (jamais appliquer seul) : **termes candidats** (n-grammes fréquents dans les éléments retenus non couverts), **termes à retirer** (précision < 20 % sur ≥ 20 occurrences), **alias de lieux candidats**. Écran « Suggestions du moteur » où l'admin accepte/refuse en un clic. Mesures : **précision** (retenus / (retenus + rejetés)) par terme, source, groupe ; **audit de rappel** hebdomadaire (échantillon aléatoire de 20 éléments `ignore` à revoir).

### 3.7 IA locale (P3 — optionnel, hors-ligne uniquement)
Similarité sémantique par **embeddings multilingues exécutés localement** et/ou classification par **LLM local** avec **sortie JSON stricte** pour aider au rappel (dialecte, fautes). **Aucun texte n'est envoyé à un service cloud.** Résultat = suggestion supplémentaire, jamais décisionnelle ; validation humaine toujours.

---

## 4. CONNECTEURS (spécifications)

### 4.A Facebook — pages administrées par la Wilaya (P1)
Prérequis administratifs (checklist, § 8) puis : configuration `{app_id, app_secret, page_id, page_token (longue durée)}` ; **collecte par interrogation (polling) par défaut** (aucune exposition d'Internet vers le serveur interne).
- Lecture : publications de la page (`/{page_id}/feed` avec `message, created_time, permalink_url, place, shares, reactions.summary(true), comments.summary(true)` et pagination par curseur/`since`) ; **commentaires** des publications récentes (`/{post_id}/comments`) car ce sont souvent les citoyens qui signalent ; publications où la page est **mentionnée/identifiée** (`/{page_id}/tagged`).
- Chaque commentaire/publication devient un **élément** ; l'auteur d'un commentaire est **pseudonymisé** (HMAC + sel) ou non stocké (§ 6).
- **Erreurs Graph typées** : jeton expiré/invalide (190), limite de débit (4, 17, 32, 613), permission manquante (10, 200–299), page introuvable (100), indisponibilité temporaire → états visibles dans « Sources » + alerte avant expiration du jeton ; **jamais de boucle d'échec silencieuse**.
- **Webhooks** (P2, optionnels) : `GET/POST /api/veille/webhooks/facebook` avec handshake `hub.verify_token` et **vérification de la signature `X-Hub-Signature-256`** (HMAC-SHA256 du corps brut avec le secret d'application) ; exigent un point d'entrée HTTPS public → **à placer derrière un relais en DMZ**, décision de sécurité de l'administrateur ; le polling reste suffisant.
- **Messenger** (P2) : messages reçus par la page → éléments `a_qualifier` ; **accusé de réception** automatique « Signalement reçu, référence ANM-… » (modèle validé, fenêtre de réponse Meta respectée), jamais de réponse libre automatique.

### 4.B Capture assistée par extension navigateur (P1)
Extension **Manifest V3** (Edge/Chrome), dossier `/extension`, installable en mode développeur ou par stratégie de l'organisation.
- **Permissions minimales** : `activeTab`, `scripting`, `storage` ; **aucun** script de contenu permanent, **aucune** permission d'hôte large, **aucun** code distant ; communique uniquement avec l'URL de la plateforme (configurée).
- **Action utilisateur obligatoire** : l'agent clique sur l'icône → l'extension lit **uniquement** `location.href`, `document.title`, la **sélection de texte** et les métadonnées publiques `og:*` de la page active → affiche un **formulaire d'aperçu éditable** (URL, texte, page/auteur public, date) → bouton **Envoyer**. **Pas de défilement automatique, pas de collecte en masse, pas de lecture d'autres onglets.**
- Authentification par **jeton personnel de capture** (généré dans `#/profil`, portée `capture` uniquement, révocable, haché en base) ; `POST /api/veille/capture` (limité à 60/h/jeton, corps ≤ 100 Ko, validation zod) → crée un élément analysé immédiatement ; réponse : suggestions (type, commune, priorité) affichées dans l'extension avec un lien « Ouvrir dans la plateforme ».
- README d'installation, journal des modifications, **aucune télémétrie**.

### 4.C RSS / Atom / Google Actualités (P1)
Lecture standard (`If-Modified-Since`/`ETag`, 1 requête/flux/30 min, ≤ 2 Mo), dédoublonnage par `guid`/URL. **Google Actualités par mots-clés** : générateur de requêtes (ex. `"fuite d'eau" Alger`) vers le flux RSS public avec paramètres de langue/région. L'admin ajoute des flux de **sources locales qu'il choisit** (aucune liste inventée). Le texte récupéré est limité au titre + résumé publics ; le lien renvoie à l'article.

### 4.D Import (P1)
CSV/JSON/`.txt` WhatsApp (≤ 5 Mo, ≤ 20 000 lignes) → éléments ; réutilise l'analyseur de collage V5/V6 pour liens et positions.

### 4.E–H (P2/P3)
**E. Pages publiques tierces** : même connecteur que A, sur une **liste de pages surveillées** ; si l'API répond « permission/feature non approuvée », afficher un message explicite et la marche à suivre, **sans repli sur du scraping**. **F. YouTube** : `search.list` (mots-clés du lexique, `regionCode=DZ`, `publishedAfter`), suivi du **quota** (≈ 100 unités/recherche) et plafonnement automatique. **G/H** : selon les limites officielles de chaque API, mêmes principes (jeton chiffré, quotas, erreurs typées).

---

## 5. INTERFACE « VEILLE » (`#/veille/*`) — moderne, simple, rapide

Règles V4–V6 applicables (tokens, thèmes, FR/AR RTL, états de chargement/vide/erreur, réactivité, aucun écran blanc, tests géométriques).

**5.1 Boîte de veille (triage)** — l'écran principal :
- Disposition liste + détail ; onglets avec **compteurs** (À qualifier · Retenus · Rejetés · Doublons · Ignorés) ; filtres : source, groupe/domaine, commune, confiance, priorité, période, état ; recherche plein texte normalisée (arabe/latin).
- **Carte d'élément** : icône de source, page/auteur public, date relative, **extrait avec mots détectés surlignés**, puces de suggestion (groupe › type · commune · priorité) avec niveau de confiance, **viralité**, nombre de **doublons/sources** de l'événement, lien « Ouvrir la publication ».
- **Actions** : **Retenir** (ouvre le formulaire anomalie **pré-rempli** via l'analyseur V5/V6 : lien, plateforme, type, commune, GPS si disponible, texte en observations ; crée la fiche avec `veille_element_id`) · **Rejeter** (raisons rapides : hors-sujet, publicité, hors Alger, déjà traité, autre) · **Doublon de…** (choix d'une fiche ou d'un élément) · **Suivre** · **Urgent** ; actions groupées sur la sélection.
- **Mode rafale** : un élément à la fois, grands boutons, **raccourcis clavier** `J/K` (suivant/précédent), `A` retenir, `R` rejeter, `D` doublon, `U` urgent, `E` éditer la suggestion, `Z` annuler la dernière action (restaure l'état, retire les mises à jour d'apprentissage).
- Les décisions alimentent l'**apprentissage** (§ 3.6) de façon transparente.

**5.2 Sources** : liste des connecteurs avec état (dernier passage, éléments/jour, erreurs, quota, expiration du jeton), **Tester la connexion**, activer/désactiver, « Collecter maintenant », journal des tâches ; formulaire de configuration guidé par connecteur ; secrets masqués.
**5.3 Lexique** : tableau (terme, langue, rôle, groupe/type, poids, précision, origine, actif) avec recherche, édition en ligne, import/export CSV ; zone **« Tester un texte »** : on colle un message → l'interface montre termes détectés (surlignés), scores par groupe, suggestion de type/commune/priorité, et pourquoi (explicabilité) ; écran **Suggestions du moteur** (termes candidats/à retirer, alias de lieux) ; gestion des **alias de lieux**.
**5.4 Tableau de veille** : éléments collectés/pertinents/retenus par jour et par source ; **précision et rappel estimé** ; répartition par groupe et par commune ; **tendances et pics** (z-score vs moyenne mobile 4 semaines, par groupe × commune) ; **publications virales** ; **événements multi-sources** ; carte des mentions ; **délai de réaction** (publication → prise en compte → traitement) ; taux de conversion élément → anomalie ; santé des sources.
**5.5 Intégration au rapport hebdomadaire** : section « Veille » (collectés, pertinents, retenus, délai médian de réaction, sujets émergents, événements) dans la page 1/2 et l'export Excel ; section dans le résumé copiable.
**5.6 Alertes** (cloche + P2 e-mail/Telegram) : pic par groupe × commune, publication très virale, termes critiques (effondrement, danger…), source en erreur, jeton proche de l'expiration, éléments `a_qualifier` en attente depuis > N heures.

---

## 6. CONFORMITÉ, ÉTHIQUE ET SÉCURITÉ (P1 — non négociable)

*Ce chapitre est une base technique, pas un avis juridique : à valider avec le service juridique de la Wilaya.*
- **Finalité unique** : améliorer le traitement d'anomalies matérielles de l'espace public. **Pas de surveillance d'individus, d'opinions ou de profils.** Mentionner la finalité dans l'interface et la charte.
- **Minimisation** : ne stocker que le texte **public** de la publication, l'URL, le nom de la **page publique**, la date et les métriques agrégées ; **pas** de profils de citoyens, pas de photos/vidéos/miniatures tierces, pas de listes d'amis/abonnés. Auteurs de commentaires **non stockés** par défaut (`veille_stocker_auteur=0`) ou **pseudonymisés** par HMAC-SHA256 avec sel secret (`veille_pseudonymiser_auteurs=1`) pour regrouper sans identifier.
- **Conservation** : purge automatique quotidienne des éléments non retenus après `veille_conservation_jours` (défaut 90) ; les éléments **retenus** restent liés à la fiche mais les champs d'auteur sont effacés ; **procédure d'effacement sur demande** (par URL/identifiant) avec trace d'audit.
- **Cadre légal** : loi n° 18-07 (protection des personnes physiques dans le traitement des données à caractère personnel) et exigences de l'**ANPDP** (déclaration/autorisation à vérifier avec le juridique) ; **conditions d'utilisation de Meta** et des autres plateformes (usages permis, durée de stockage, suppression sur demande de la plateforme).
- **Registre de traitement** généré (page « Conformité » : finalités, catégories de données, durées, destinataires, mesures de sécurité) + **charte d'usage** d'une page.
- **Sécurité** : secrets chiffrés (§ 1) ; jetons de capture hachés et révocables ; signature des webhooks vérifiée ; entrées validées (zod) et bornées ; texte tiers **traité comme une donnée** (échappé, jamais interprété) ; liens ouverts avec `rel="noopener noreferrer"` ; limitation de débit sur les endpoints de capture/webhook ; audit : `VEILLE_SOURCE_*`, `VEILLE_CAPTURE`, `VEILLE_RETENU`, `VEILLE_REJETE`, `VEILLE_LEXIQUE_*`, `VEILLE_PURGE`, `VEILLE_EFFACEMENT`.
- **Accès** : lecture/triage restreints aux rôles autorisés ; export des éléments bruts réservé à l'admin.

---

## 7. TESTS ET QUALITÉ

- **Unitaires** : normalisation (arabe : diacritiques, alef/yaa/taa marbuta, lettres répétées, préfixes/suffixes ; arabizi ; français), détection de langue, correspondance (multi-mots, chevauchements, exclusions, co-occurrence), score/confiance (seuils juste en dessous/au-dessus), territoire (alias, communes, géotag), priorité/viralité (percentile), simhash (distance 0/3/4), regroupement en événements, détection de pics (z-score), apprentissage (mises à jour, suggestions, précision < 20 %), pseudonymisation (stabilité, non-réversibilité), chiffrement des secrets (aller-retour, mauvaise clé).
- **Jeu d'évaluation étiqueté** `tests/fixtures/veille-eval.json` : **≥ 120 publications fictives** réalistes (FR, AR standard, darija écrite, arabizi, mix, bruit/publicités/humour, hors-Alger) avec groupe, type, commune et priorité attendus. Objectifs sur ce jeu synthétique : **précision ≥ 70 % et rappel ≥ 80 %** ; rapport de matrice de confusion généré par `npm run veille:eval`. **Après le pilote**, recalibrer sur **≥ 200 éléments réels** étiquetés par la cellule (seuils et lexique).
- **Connecteurs avec faux serveurs** : faux API Graph (pagination, curseur, erreurs 190/4/17/32/613/10/100, jeton expirant), faux flux RSS (ETag, 304, XML invalide, énorme), faux API YouTube (quota dépassé) ; idempotence de la collecte ; reprise après redémarrage ; backoff ; verrou anti-chevauchement ; signature de webhook valide/invalide/rejouée ; endpoint de capture (jeton révoqué, portée, taille, débit).
- **Extension** : test de l'extension avec Playwright (chargement non empaqueté) : n'accède qu'à l'onglet actif, aucun appel hors plateforme, aperçu éditable, envoi.
- **UI/E2E** : triage au clavier (`J/K/A/R/D/U/Z`), surbrillance des mots, pré-remplissage du formulaire anomalie, « Tester un texte », annulation avec retrait des mises à jour d'apprentissage, thèmes clair/sombre, FR/AR RTL, rechargement dur de chaque route `#/veille/*` (V6 § 8.2), assertions géométriques et axe.
- **Performance** : 10 000 éléments/jour : analyse < 20 ms/élément ; liste de triage < 300 ms ; purge sans bloquer les lectures.

---

## 8. PRÉREQUIS ADMINISTRATIFS (à préparer par la cellule en parallèle du développement)
1. **Compte Meta Business** de la Wilaya, **vérification de l'entreprise/organisme**, rôles d'administrateur sur la page officielle.
2. **Application Meta** (type Business) avec **URL de politique de confidentialité** et URL de **suppression des données** (la plateforme fournit les deux pages), utilisateurs de test.
3. **Permissions** à demander (à confirmer dans la documentation en vigueur) : lecture des publications/engagement/commentaires de la page gérée ; pour les pages tierces, **Page Public Content Access** (App Review avec vidéo de démonstration et description d'usage conforme à la finalité).
4. Jeton de page **longue durée** et procédure de renouvellement ; point de contact sécurité.
5. Validation **juridique** (loi 18-07, ANPDP) et **charte** interne signée avant mise en production du module.
6. Liste **validée par la cellule** des pages locales/flux à surveiller (**aucune liste n'est inventée par le développement**).

---

## 9. IDÉES D'AMÉLIORATION SUPPLÉMENTAIRES (classées)
**P2** : accusé de réception citoyen (Messenger) avec référence et suivi de statut · **événements** : fusion automatique des publications multi-sources en un événement avec carte de chaleur citoyenne · **lexique saisonnier** activable (inondations, canicule, Aïd/afflux de déchets, rentrée scolaire) · **lexique collaboratif** : les agents scooters proposent des mots du terrain et de la darija depuis leur mobile · **indicateur de couverture** : part des anomalies découvertes par la veille vs signalées par les agents, et taux de traitement des anomalies issues de la veille · **journal de veille hebdomadaire** auto-rédigé (faits marquants déterministes) · **export** d'un lot de publications pertinentes vers une EPIC (sans données personnelles).
**P3** : **OCR arabe/français** (hors-ligne) sur images jointes par capture assistée pour lire panneaux/affiches ; **détection visuelle** de nids-de-poule/déchets sur photos des agents (modèle local, simple aide à la qualification) ; **classification par LLM local** (§ 3.7) ; **géocodage par gazetteer local** appris des fiches validées (noms de quartiers) ; **réponse type** proposée à la modération pour les pages gérées (validation humaine obligatoire) ; **tableau « thermomètre citoyen »** par commune normalisé sur l'historique propre de la commune.

---

## 10. SCÉNARIOS DE RECETTE V7 (s'ajoutent aux 52 précédents ; **tous** doivent passer)
53. Seed : lexique chargé (270 termes), idempotent, éditable ; zone « Tester un texte » : un message FR, un AR, un darija et un arabizi donnent le bon groupe, des termes surlignés et une explication.
54. Message de bruit (publicité, « à vendre ») → ignoré ; message hors Alger avec filtre `strict` → écarté.
55. Capture assistée : jeton généré → extension → aperçu éditable → envoi → élément analysé et suggestions renvoyées ; jeton révoqué → refus.
56. Faux API Graph : collecte de publications + commentaires avec pagination ; rejouer la collecte ne crée **aucun doublon** ; jeton expiré → source en erreur avec message clair et alerte ; limite de débit → backoff puis reprise.
57. Flux RSS (304, XML invalide, trop gros) gérés sans plantage ; Google Actualités par mots-clés génère des éléments.
58. Import WhatsApp de 50 messages → éléments corrects (liens, positions).
59. Doublons : même texte copié par deux pages → `groupe_doublon_id` ; 3 publications même sujet/commune/48 h → un **événement** avec 3 sources.
60. Triage au clavier de 20 éléments : retenir → formulaire pré-rempli → fiche créée avec `veille_element_id` ; rejeter avec raison ; `Z` annule ; compteurs exacts.
61. Apprentissage : après 20 rejets d'un terme, il apparaît dans « à retirer » (suggestion, rien d'appliqué seul) ; terme candidat proposé après plusieurs retenus.
62. Priorité : terme d'urgence + viralité p90 → `haute`/`urgente` selon les règles ; seuil de viralité propre à chaque source.
63. Tableau de veille : pic détecté sur un groupe × commune simulé ; délais de réaction calculés ; cohérence avec la section « Veille » du rapport hebdomadaire et de l'export Excel.
64. Conformité : purge à J+90 des éléments non retenus (auteurs effacés sur les retenus) ; effacement sur demande tracé ; secrets chiffrés (base ouverte à la main : aucun jeton lisible) ; aucun jeton/secret dans les logs ; texte tiers jamais interprété en HTML.
65. Résilience : toutes les sources externes coupées → l'application reste utilisable, états de sources visibles ; rechargement dur de chaque route `#/veille/*` sans écran blanc ; thèmes clair/sombre et FR/AR OK.
66. **Régression** : les 52 scénarios V4–V6 passent toujours.

---

## 11. LIVRABLES V7
Migration `004_veille.sql` · `shared/veille/*` (normalisation, lexique, matching, score, territoire, simhash, priorité, pics) · `server/src/veille/*` (planificateur, connecteurs A–D, routes, purge, chiffrement) · pages `#/veille/*` · `/extension` (MV3) + README · `seed/lexique_initial_veille.csv` · jeu d'évaluation + `npm run veille:eval` · page Conformité (registre, charte, pages confidentialité/suppression de données) · `AUDIT_V7.md` · README et `DECISIONS.md` mis à jour · tests verts (`npm run qa` inclut le module).