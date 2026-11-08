# SPÉCIFICATION V5 — Améliorations : GPS intelligent, statistiques détaillées, optimisation de chaque fonction
**Complément de `docs/SPEC.md` (V4).** Tout ce qui n'est pas modifié ici reste régi par la V4. En cas de contradiction, **ce document gagne** pour les sujets qu'il traite.
Placer ce fichier dans `docs/SPEC_V5.md` et `groupes_domaines.csv` dans `seed/`.

**Priorités** : **P1** = obligatoire dans cette version · **P2** = à faire après validation complète des P1 · **P3** = optionnel si tout le reste est vert.
**Philosophie UX** : *zéro saisie quand c'est possible, 3 clics maximum, l'application comprend ce qu'on lui colle, jamais de blocage sans explication ni solution proposée.*

---

## 0. VÉRITÉ TECHNIQUE À RESPECTER (ne pas promettre l'impossible)

**Les liens Facebook, TikTok, Instagram, YouTube ou X ne contiennent PAS de coordonnées GPS.** Aucun traitement du lien seul ne peut en déduire une position. L'application doit donc obtenir la position par **tous les moyens réalistes** et le dire clairement quand elle n'en trouve pas :

| Source de position | Fiabilité | Fonctionne hors-ligne |
|---|---|---|
| Lien de localisation collé (Google Maps long, OSM, Waze, Apple Plans, `geo:`, coordonnées brutes, DMS, Plus Code complet) | haute | oui |
| Lien court Google Maps (`maps.app.goo.gl`, `goo.gl/maps`) | haute | non → résolution serveur si Internet (§ 2.4) |
| Coordonnées ou lien de carte présents dans la **légende** d'une publication | moyenne | non (métadonnées publiques, § 2.4) |
| **Photo avec EXIF** (prise par l'agent) jointe à la fiche | haute | oui (lecture dans le navigateur) |
| Géolocalisation de l'appareil | haute | oui, **mais exige un contexte sécurisé HTTPS** (§ 2.6) |
| Clic / glisser sur la carte | selon l'utilisateur | oui |
| **Déduction de la commune/daïra** depuis la position (polygones importés, sinon anomalies voisines) | haute / moyenne | oui |

Ce que l'application fait **à partir du lien social lui-même** (hors-ligne) : détecter la plateforme et le type de contenu, nettoyer l'URL, **estimer la date de publication** (TikTok et Instagram, § 2.3), détecter les doublons. Elle **ne contourne jamais** une authentification et ne « scrape » jamais au-delà des métadonnées publiques ; l'enrichissement en ligne est **désactivé par défaut** (paramètre admin).
Quand aucune position n'est trouvée, message exact (FR/AR) : *« Aucune position dans ce lien — les liens Facebook, TikTok et Instagram ne contiennent pas de coordonnées. Collez le lien de localisation envoyé par l'agent, placez le point sur la carte ou joignez une photo. »* avec trois boutons d'action.

---

## 1. MIGRATION `002_v5.sql` (ne casse aucune donnée existante ; testée sur une copie de base)

```sql
ALTER TABLE anomalies ADD COLUMN gps_source TEXT CHECK(gps_source IS NULL OR gps_source IN
  ('manuel','lien_carte','lien_court','legende','exif','appareil','carte','voisinage'));
ALTER TABLE anomalies ADD COLUMN gps_precision_m INTEGER CHECK(gps_precision_m IS NULL OR gps_precision_m >= 0);
ALTER TABLE anomalies ADD COLUMN gps_verifiee INTEGER NOT NULL DEFAULT 0;        -- confirmée sur place par l'agent
ALTER TABLE anomalies ADD COLUMN lie_a_id INTEGER REFERENCES anomalies(id);       -- signalement répété d'un même point
ALTER TABLE anomalies ADD COLUMN contenu_type TEXT;                               -- reel|video|post|story|short|photo|autre
ALTER TABLE anomalies ADD COLUMN date_publication_estimee INTEGER NOT NULL DEFAULT 0;
ALTER TABLE anomalies ADD COLUMN legende TEXT;                                    -- légende publique éventuelle
ALTER TABLE anomalies ADD COLUMN auteur_publication TEXT;
CREATE INDEX idx_anomalies_gps ON anomalies(gps_lat, gps_lng) WHERE gps_lat IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_anomalies_lie ON anomalies(lie_a_id);

CREATE TABLE groupes_domaines(id INTEGER PRIMARY KEY, name_fr TEXT NOT NULL UNIQUE, name_ar TEXT, ordre INTEGER NOT NULL, actif INTEGER NOT NULL DEFAULT 1, ...);
ALTER TABLE domaines ADD COLUMN groupe_id INTEGER REFERENCES groupes_domaines(id);
CREATE TABLE limites_communes(commune_id INTEGER PRIMARY KEY REFERENCES communes(id), geojson TEXT NOT NULL,
                              min_lat REAL NOT NULL, min_lng REAL NOT NULL, max_lat REAL NOT NULL, max_lng REAL NOT NULL, ...);
CREATE TABLE liens_cache(url_normalise TEXT PRIMARY KEY, url_finale TEXT, meta_json TEXT, fetched_at TEXT NOT NULL);
CREATE TABLE vues_sauvegardees(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                               nom TEXT NOT NULL, page TEXT NOT NULL, filtres_json TEXT NOT NULL, partagee INTEGER NOT NULL DEFAULT 0, ...);
CREATE TABLE boite_reception(id INTEGER PRIMARY KEY, lien_url TEXT, texte TEXT, gps_lat REAL, gps_lng REAL, gps_source TEXT,
                             auteur TEXT, date_message TEXT, origine TEXT NOT NULL CHECK(origine IN ('collage','whatsapp','manuel')),
                             statut TEXT NOT NULL DEFAULT 'a_completer' CHECK(statut IN ('a_completer','converti','ignore')),
                             anomalie_id INTEGER REFERENCES anomalies(id), saisi_par INTEGER REFERENCES users(id), ...);
```
La règle « `gps_source` non nul ⇒ GPS présent » est vérifiée dans le service (pas de CHECK ajoutable via `ALTER`).
**Nouveaux paramètres** (valeurs par défaut) : `rayon_doublon_m=50`, `objectif_taux_traitement=80`, `sla_urgente_j=2`, `sla_haute_j=5`, `sla_normale_j=10`, `delai_verification_cible_j=2`, `enrichissement_en_ligne=0`, `rapport_auto_fige=1`, `https_actif=0`.
**Seed** `seed/groupes_domaines.csv` (`ordre_groupe, groupe_fr, groupe_ar, domaine_ar`) : 9 groupes thématiques couvrant les 70 catégories — **proposition modifiable** par l'admin (idempotent, ne réécrase jamais une modification admin).

---

## 2. LOT A — GPS INTELLIGENT ET « COLLAGE INTELLIGENT » (P1)

### 2.1 Principe d'interface : une seule zone « Coller »
En tête du formulaire « Nouvelle anomalie », une zone large et visible (bordure en pointillés, icône, texte : *« Collez ici le lien de la publication, le lien de localisation, des coordonnées — ou tout le message reçu »*). Elle accepte : texte collé, **glisser-déposer** de texte, **glisser-déposer ou Ctrl+V d'une image** (devient pièce jointe, EXIF lu).
- Le collage est capté par un écouteur `paste` **sur toute la page du formulaire** : si le focus est dans le champ **Lien**, le champ **GPS** ou la zone Coller, le contenu est analysé ; dans les autres champs de texte, le collage reste **normal** (jamais d'interception silencieuse ailleurs).
- Bouton **« Coller depuis le presse-papiers »** utilisant `navigator.clipboard.readText()` **uniquement si `window.isSecureContext`** ; sinon le bouton est masqué et la zone explique « Faites Ctrl+V ici » (l'événement `paste` fonctionne en HTTP, pas la lecture directe).
- Résultat affiché immédiatement sous la zone sous forme de **puces « ce que j'ai compris »** : `✔ Lien · Facebook · Reel` · `✔ Position 36.753800, 3.058800 · via lien Google Maps` · `✔ Date de publication estimée 12/10/2026` · `✔ Commune suggérée : …`. Chaque puce est modifiable/supprimable.
- **Application automatique** quand le résultat est sans ambiguïté, avec toast « Champs remplis — **Annuler** » (un clic annule tout le remplissage). Quand plusieurs positions distinctes (> 100 m d'écart) sont trouvées : puces de choix, aucune appliquée tant qu'on n'a pas choisi.
- Les champs déjà remplis **manuellement** ne sont jamais écrasés sans confirmation.

### 2.2 Analyseur `shared/smartPaste.js` → `parseSmartPaste(texte)`
Retourne `{ urls:[{brut, type:'social'|'carte'|'autre', plateforme, contenuType, normalise, coords?}], coords:[{lat,lng,source,confiance,precision_m?}], dates:[{date,estimee,source}], texteRestant }`. Pipeline :
1. **Normalisation du texte** : convertir les chiffres arabes-indiens `٠١٢٣٤٥٦٧٨٩` et persans en `0-9`, le séparateur décimal arabe `٫` et la virgule décimale en `.`, retirer caractères de direction (U+200E/F, U+202A–E), décoder les entités HTML.
2. **Extraction des URL** (regex robuste, y compris collées à du texte arabe) ; retirer la ponctuation finale (`) ] . , ; : ! ? ، ؛ »`) ; accepter les URL sans schéma pour les domaines connus (`facebook.com/...`).
3. **Déballage des liens enveloppés** : `l.facebook.com/l.php?u=`, `lm.facebook.com`, `google.com/url?q=`, `l.instagram.com/?u=`, `out.tiktok.com`, `t.co` (non résolu hors-ligne).
4. **Classification** : réseaux sociaux (hôtes de la V4 § 4.5) avec `contenuType` : Facebook `reel|watch|videos|posts|share|story|photo` ; Instagram `reel|p|tv|stories` ; TikTok `video|photo` (+ `vm.`/`vt.` courts) ; YouTube `shorts|watch|live` ; X `status`.
5. **Coordonnées** — formats à supporter (tests pour **chacun**) :
   - décimaux : `36.7538, 3.0588` · `36.7538 3.0588` · `36.7538;3.0588` · `lat: 36.7538 lng: 3.0588` · `36,7538 3,0588`
   - DMS : `36°45'13.8"N 3°03'31.7"E` · `N36 45.230 E3 03.528` · variantes avec `′ ″` et lettres arabes `ش/ج/شرق/غرب` si présentes
   - **Google Maps** (priorité décroissante, la **épingle** prime sur le centre de vue) : `!3dLAT!4dLNG` > `?q=LAT,LNG` / `&query=` > `ll=` > `@LAT,LNG,zoom` ; formes `maps.google.com/?q=`, `google.com/maps/place/…`, `google.com/maps?q=` (celles envoyées par WhatsApp)
   - **Waze** `waze.com/ul?ll=LAT%2CLNG` · **Apple Plans** `maps.apple.com/?ll=` / `?q=` · **OSM** `#map=Z/LAT/LNG`, `mlat=&mlon=` · URI `geo:LAT,LNG` · **Plus Code complet** (Open Location Code, décodage hors-ligne) (P2)
   - Liens courts (`maps.app.goo.gl`, `goo.gl/maps`) : détectés, marqués `a_resoudre`, résolus selon § 2.4.
6. **Validation** : `|lat| ≤ 90`, `|lng| ≤ 180` ; inversion lat/lng proposée si `|lat|>90 && |lng|≤90` ; hors `gps_bbox` → **avertissement non bloquant** (pas d'erreur) ; rejeter `0,0`. Précision : nombre de décimales → `precision_m` estimée.
7. **Dates** : date de publication estimée (§ 2.3) et dates explicites JJ/MM/AAAA présentes dans le texte (suggestion, jamais appliquée seule).
8. `texteRestant` = texte sans URL/coordonnées → proposé pour **Observations** (case « Ajouter le message aux observations », cochée si le texte fait ≥ 10 caractères).

### 2.3 Estimation de la date de publication à partir de l'URL (hors-ligne, heuristique P1)
- **TikTok** `…/video/<ID>` (ID de 18–19 chiffres) : `timestamp_s = Number(BigInt(ID) >> 32n)`.
- **Instagram** `/p|reel|tv/<CODE>/` : décoder `CODE` (alphabet `A-Za-z0-9-_`, 64 symboles, **BigInt**) → `media_id` ; `timestamp_ms = Number((media_id >> 23n)) + 1314220021721`. Pour les codes longs (> 11 caractères) n'utiliser que les **11 premiers**.
- **Garde-fous** : accepter uniquement si la date obtenue est entre `2016-01-01` et `aujourd'hui + 1 jour` ; sinon ignorer silencieusement. Résultat converti en date **Africa/Algiers**, `date_publication_estimee=1` (affichée « estimée », modifiable). Facebook/YouTube/X : aucune estimation.
- **Tests** : aller-retour par **vecteurs synthétiques** (encoder une date connue → ID/code → décoder → même jour), cas limites, valeurs hors plage.

### 2.4 Résolution de lien et enrichissement en ligne (optionnel, P2 — **désactivé par défaut**)
`POST /tools/resolve-link {url}` (authentifié, 30 req/min/utilisateur, mis en cache 7 jours dans `liens_cache`). Actif seulement si `enrichissement_en_ligne=1` **et** Internet joignable ; sinon renvoie `{disponible:false}` et l'UI affiche l'explication.
- **Garde SSRF obligatoire** : schéma http(s) ; **liste blanche de domaines** (`maps.app.goo.gl`, `goo.gl`, `www.google.com`, `maps.google.com`, `tiktok.com`, `www.tiktok.com`, `vm.tiktok.com`, `youtube.com`, `youtu.be`) ; résolution DNS puis **refus des adresses privées/loopback/lien-local** (IPv4 et IPv6) ; max **5 redirections**, chaque saut revalidé ; **timeout 4 s** ; taille de réponse ≤ 512 Ko ; `User-Agent` explicite ; aucun cookie.
- Résultats : URL finale (puis parsée par § 2.2 → `gps_source='lien_court'`) ; métadonnées **publiques uniquement** (oEmbed TikTok/YouTube : titre, auteur) → `legende`, `auteur_publication` ; si la légende contient des coordonnées/lien de carte → `gps_source='legende'` (proposé, jamais appliqué sans confirmation) ; correspondance du texte avec les **noms de communes/daïras** du référentiel pour suggérer une commune. **Ne stocker ni miniature ni vidéo** tierce.
- Aucune dépendance bloquante : l'échec (réseau, timeout, blocage de la plateforme) n'empêche **jamais** la saisie.

### 2.5 Déduction automatique daïra/commune depuis la position (P1)
Ordre de décision, appelé (debounce 400 ms) à chaque changement de position via `POST /geo/locate {lat,lng}` :
1. **Polygones** (`limites_communes`) : filtrage par boîte englobante puis **point-dans-polygone** (`shared/geo.js`, ray casting, `Polygon` et `MultiPolygon`, trous gérés) → `{commune_id, daira_id, methode:'polygone', confiance:'haute'}`.
2. **Voisinage** : commune majoritaire parmi les anomalies non supprimées à **≤ 300 m** (≥ 2 anomalies, majorité ≥ 60 %) → `methode:'voisinage', confiance:'moyenne'` (suggestion à confirmer).
3. Sinon `{methode:null}` (rien n'est préselectionné).
Affichage : puce « Commune suggérée : X · *polygone* » ; avec confiance haute la sélection est appliquée avec le toast **Annuler** ; avec confiance moyenne elle est seulement **proposée**.
**Admin → « Limites territoriales »** : import d'un **GeoJSON** (`FeatureCollection` de `Polygon/MultiPolygon`, ≤ 20 Mo), choix de la **propriété** portant le nom de commune, correspondance par `normalize()` avec les communes du référentiel, **rapport des non-appariés** (association manuelle possible), aperçu sur carte, validation. Sans GeoJSON, seule la méthode « voisinage » fonctionne ; l'app le dit clairement. Option P2 : couche « Limites » affichable sur la carte.

### 2.6 HTTPS local (prérequis de la géolocalisation et du presse-papiers) (P1)
`navigator.geolocation` et `navigator.clipboard.readText` **sont bloqués en HTTP** (hors `localhost`). Fournir :
- `npm run https:setup` : génère un certificat auto-signé (SAN = nom d'hôte, IP(s) locales saisies) dans `data/certs/` (paquet `selfsigned`) et écrit `HTTPS=true`, `HTTPS_CERT`, `HTTPS_KEY`, `COOKIE_SECURE=true` dans `.env` ; le serveur démarre alors en HTTPS (HSTS activé seulement dans ce mode, helmet ajusté en conséquence).
- Le README documente l'installation du certificat/de l'autorité interne sur Windows et Android (ou l'usage de **mkcert**) pour supprimer l'alerte navigateur.
- Tant que la page n'est pas en contexte sécurisé : le bouton **« Ma position »** est affiché **désactivé avec infobulle explicative** (« Nécessite HTTPS — voir Administration › Santé »), jamais caché sans explication ; la page **Administration › Santé** affiche l'état (HTTP/HTTPS, certificat, expiration).

### 2.7 Position : sélecteur de carte et contrôles (P1)
- **Mini-carte du formulaire** : clic = place le point ; marqueur **déplaçable** ; mode « réticule » ; recherche d'une commune (zoom sur ses limites si importées) ; bouton « Ma position » (§ 2.6) ; bouton « Ouvrir dans Google Maps / OSM / Waze » ; copier les coordonnées.
- **Badge de source** à côté du GPS : `Lien Google Maps` · `Photo (EXIF)` · `Appareil` · `Carte` · `Voisinage` · `Manuel` ; case **« Position confirmée sur place »** (`gps_verifiee`, cochée par la vérification de l'agent).
- **Anomalies proches** : sous la mini-carte, marqueurs fantômes des anomalies à ≤ 150 m (couleur par statut) et liste des 3 plus proches.
- **Photo avec EXIF** : à l'ajout d'une pièce jointe JPEG, lecture **dans le navigateur** (`exifr`, aucune donnée envoyée) de la position et de la date de prise de vue → proposer « Utiliser la position de la photo (précision ~X m) » ; une capture d'écran sans EXIF → message clair.

### 2.8 Doublon géographique et signalements répétés (P1)
`GET /anomalies/nearby?lat&lng&radius&type&exclude` (boîte englobante en SQL puis **Haversine** dans `shared/geo.js`). À la saisie : si une anomalie **non traitée** du **même type** (ou même catégorie) existe à ≤ `rayon_doublon_m` (défaut 50 m) → bandeau « Probablement déjà signalée : ANM-… (à 32 m, en cours) » avec **trois actions** : *Voir la fiche* · *C'est une autre anomalie* · **« Lier comme signalement répété »** (renseigne `lie_a_id`, crée la fiche mais la rattache ; la fiche mère affiche « Signalée N fois »). Les liens `lie_a_id` alimentent les **points noirs récurrents** (§ 3.8). Aucune de ces options n'est bloquante (avertissement uniquement).

### 2.9 API et tests du lot A
`POST /tools/parse-paste {texte}` (même analyseur partagé, utilisé aussi par la boîte de réception) · `POST /geo/locate` · `GET /anomalies/nearby` · `POST /tools/resolve-link` (P2) · `POST /admin/limites/import-geojson` (aperçu puis validation).
**Tests** : un test **par format de coordonnées** de § 2.2 (≥ 30 vecteurs dont chiffres arabes, DMS, liens WhatsApp), priorité épingle > centre de vue, liens enveloppés, ponctuation finale, 2 positions distinctes → choix, inversion lat/lng, bbox, estimation TikTok/Instagram (aller-retour), point-dans-polygone (intérieur, extérieur, bord, trou, MultiPolygon), voisinage (majorité/minorité), Haversine (valeur connue), SSRF (IP privée, redirection vers interne, domaine hors liste, timeout), parité des champs `gps_source`/`gps`.

---

## 3. LOT B — STATISTIQUES DÉTAILLÉES ET SYNTHÈSE HEBDOMADAIRE ENRICHIE (P1, sauf mention)

Tout est calculé **en SQL** dans `services/stats.js` (fenêtres SQLite pour médiane/percentiles), avec les conventions V4 § 5 (population de base, `statutAu(E)`, plus grand reste, fuseau Alger). Nouveau point d'entrée : `GET /stats/detail?from&to&…filtres` (+ enrichissement de `GET /reports/weekly`).

**3.1 Entonnoir de traitement** (cohorte reçue sur [S,E], état à E) : `reçues → vérifiées → confirmées → en cours ou traitées → traitées`, avec **taux de passage** entre étapes et **délais** : signalement→vérification, vérification→intervention, intervention→traitement (moyenne et médiane). `infirmées` affichées à part (taux d'infirmation).
**3.2 Délais de traitement** (traitées dont `date_traitement ∈ [S,E]`) : **moyenne, médiane, percentile 90**, distribution en tranches `0–2 j · 3–7 · 8–14 · 15–30 · >30`, par priorité et par EPIC.
**3.3 Respect des délais cibles (SLA)** : cible par priorité (`sla_urgente_j`, `sla_haute_j`, `sla_normale_j`) ; `% dans les délais = traitées avec délai ≤ cible / traitées` ; idem pour la **vérification** (`delai_verification_cible_j`).
**3.4 Ancienneté du stock ouvert** à E : tranches `0–7 · 8–14 · 15–30 · >30 j` × priorité ; plus ancienne anomalie ouverte (référence + âge).
**3.5 Flux et tendance** : reçues / traitées / stock sur 12 semaines, **moyenne mobile 4 semaines**, tendance du stock ; **estimation de résorption** = `stock / (moyenne traitées 4 s − moyenne reçues 4 s)` **uniquement si le net est positif**, sinon texte « stock en hausse ».
**3.6 Objectif** : `objectif_taux_traitement` (défaut 80 %) → jauge, écart en points, statut (atteint / proche / en retard).
**3.7 Ventilations** (n, % par statut, délai moyen/médian, % dans les délais) : par **plateforme**, par **groupe thématique** (via `groupes_domaines`), catégorie, type, daïra, commune, **EPIC** (affectées, traitées, en cours, stock, délai, SLA), **agent** (vérifications, % confirmées, % infirmées, délai de vérification moyen), par **jour de la semaine** (reçues) et **heatmap semaine × jour** sur 12 semaines.
**3.8 Points noirs récurrents** : regroupement par **grille ≈ 100 m** en SQL (`printf('%.3f,%.3f', gps_lat, gps_lng)`) incluant les liens `lie_a_id` ; **top 10** (nombre d'anomalies, nombre ouvertes, dernière date, type dominant, commune) + **carte de chaleur** (`leaflet.heat`, bascule « Densité » sur la page Carte).
**3.9 Qualité des données** : % **géolocalisées**, % de positions **confirmées sur place**, % de fiches avec intervenant quand en cours/traité (doit être 100 %), liste des fiches « à compléter » (sans GPS, sans agent, sans photo) cliquable.
**3.10 « Faits marquants » automatiques** (règles déterministes, **sans IA**, gabarits FR/AR, gravité *info / attention / critique*, lien vers la liste filtrée) :
1. taux < objectif − 5 pts · 2. reçues ≥ +25 % vs moyenne 4 s · 3. un groupe/catégorie > 25 % des reçues · 4. daïra en plus forte hausse · 5. EPIC dont le délai moyen > 1,5 × cible · 6. urgentes ouvertes hors SLA · 7. stock en hausse 3 semaines consécutives · 8. nouveau point noir récurrent (≥ 3 en ~100 m) · 9. taux de géolocalisation < 90 % · 10. anomalies « à vérifier » depuis > `delai_verification_cible_j`.
**3.11 Rapport hebdomadaire — nouvelle structure (A4, FR/AR)** : p.1 **Synthèse exécutive** (8 KPI + objectif, faits marquants, 3 graphiques) · p.2 **Catégories et groupes** · p.3 **Territoire** (daïras, communes, points noirs récurrents, mini-carte) · p.4 **EPIC, délais et SLA** (entonnoir, distribution) · p.5 **Qualité et annexes** (urgentes, > N jours, fiches à compléter) + visa. Export Excel multi-feuilles (une par section, formats natifs). Comparaison systématique **semaine précédente** et **moyenne 4 semaines**.
**3.12 Rapport de période libre / mensuel** (P2) : `GET /reports/period?from&to` réutilise le même moteur (comparaison avec la période précédente de même durée).
**3.13 Figeage automatique** (P2) : si `rapport_auto_fige=1`, au premier démarrage/jour après la fin d'une semaine, créer la **version 1** figée de la semaine écoulée (une seule fois, audit `REPORT_SNAPSHOT_AUTO`).
**3.14 Copier le résumé** : texte enrichi (reçues, % par statut, objectif, délai médian, SLA, top 3 faits marquants, urgentes).
**Tests** : médiane/P90 (nombre pair/impair, valeur unique, vide), bornes des tranches (2/3, 7/8, 14/15, 30/31 jours), SLA, ancienneté, entonnoir monotone (confirmées ≤ vérifiées ≤ reçues), moyenne mobile, estimation de résorption (net négatif/nul/positif), grille de points noirs (liens inclus), qualité des données, chaque règle de faits marquants (seuil juste en dessous/au-dessus), cohérence tableau de bord ↔ rapport ↔ export Excel.

---

## 4. LOT C — AMÉLIORATIONS PAR FONCTION

### 4.1 Saisie
- **P1** Sélection **« type d'abord »** : en tapant `حفرة` ou « fuite », la liste propose `Catégorie › Type` (recherche normalisée sur tous les types) et renseigne la catégorie automatiquement ; les **5 types récemment utilisés** par l'utilisateur en tête.
- **P1** **« Enregistrer et dupliquer »** (même lien/date/daïra, nouveau type/position) pour les vidéos montrant plusieurs anomalies ; `POST /anomalies/:id/dupliquer`.
- **P1** **Brouillon automatique** du formulaire (mémoire de session + `localStorage` en `try/catch`) avec restauration « Reprendre la saisie en cours ? ».
- **P1** Raccourcis : `Ctrl+Entrée` enregistrer, `Ctrl+Maj+Entrée` enregistrer et nouveau, `N` nouvelle anomalie.
- **P2** **Boîte de réception** (`#/reception`) : coller **plusieurs** liens/messages (un par ligne) ou **importer un export WhatsApp (.txt)** → extraction des liens, positions, auteur et date → éléments « à compléter » ; « Compléter » ouvre le formulaire pré-rempli ; « Ignorer » ; compteurs dans le menu. Même analyseur que § 2.2.
- **P3** Modèles de saisie rapide (« Fuite d'eau – commune habituelle »).

### 4.2 Liste
- **P1** **Onglets rapides avec compteurs** (Tout · À vérifier · Non traitées · En cours · Traitées · Urgentes · En retard).
- **P1** **Vues enregistrées** par utilisateur (filtres nommés, partageables par l'admin) — `vues_sauvegardees`.
- **P2** Colonnes configurables, tri multiple, mémorisation de la densité ; **P3** édition en ligne.

### 4.3 Fiche
- **P1** Bouton **« Itinéraire »** (liens Google Maps / Waze vers les coordonnées) et **« Copier le message pour l'EPIC »** : texte prêt à envoyer (FR/AR) — référence, catégorie › type, commune/daïra, lien de localisation, lien de la vidéo, priorité.
- **P1** Dialogues d'action **qui ne demandent que ce qui manque** (agent, EPIC, date, motif), valeurs par défaut intelligentes.
- **P2** **Bon d'intervention imprimable** (A5/A4) pour l'EPIC ; **commentaires internes** horodatés ; comparaison **avant/après** des photos.

### 4.4 Carte
- **P1** Bascule **Densité** (heatmap) ; filtre **semaine** ; clic sur un point noir récurrent → liste.
- **P2** Couche **Limites territoriales** ; **dessin d'une zone** (rectangle) → liste/statistiques de la zone.

### 4.5 Tableau de bord et navigation
- **P1** Page **« À faire »** (file de travail par rôle) : à vérifier depuis > cible, urgentes hors SLA, fiches à compléter, éléments de la boîte de réception.
- **P1** **Cloche de notifications** intégrée (calculée à la volée, sans table) : urgentes hors SLA, « à vérifier » en retard, sauvegarde du jour manquante, certificat HTTPS proche de l'expiration (admin).
- **P2** **Palette de commandes `Ctrl+K`** (nouvelle anomalie, aller à…, rechercher une référence) ; widgets personnalisables.

### 4.6 Administration et sécurité
- **P1** Page **Santé** : version, taille de la base, nombre de lignes par table, dernière sauvegarde, espace disque, mode HTTP/HTTPS, validité du certificat, état de l'enrichissement en ligne, test d'intégrité `db:check`.
- **P2** **2FA TOTP** (hors-ligne, `otplib`) pour les comptes admin ; **P2** export complet (zip base + pièces).
- **P3** Chiffrement des sauvegardes.

### 4.7 Mode terrain pour les agents scooters (P2)
Rôle supplémentaire `agent` (reconstruction de la table `users` via migration pour modifier le `CHECK` de `role` ; lien `users.agent_id`). Permissions : lecture des anomalies **à vérifier** de sa zone, **vérification** (confirmer/infirmer), pièces jointes, position confirmée ; rien d'autre. Page `#/terrain` **mobile-first** : liste des anomalies à vérifier (triées par proximité si la géolocalisation est disponible), fiche plein écran, **grands boutons Confirmer / Infirmer**, **photo via l'appareil** (`<input accept="image/*" capture="environment">`) avec lecture EXIF, **capture GPS** (HTTPS requis), envoi en un geste. Prérequis documentés : accès réseau des agents (VPN/Wi-Fi) et HTTPS.

---

## 5. SÉCURITÉ DES NOUVEAUTÉS
Aucune requête sortante hors `resolve-link` (liste blanche + garde SSRF, § 2.4) ; `exifr` s'exécute **côté client** ; le texte collé est **traité comme une donnée** (jamais interprété, jamais injecté en HTML) ; les URL ouvertes depuis l'app gardent `rel="noopener noreferrer"` ; le GeoJSON importé est validé (schéma, taille, nombre de sommets plafonné) ; `boite_reception.texte` échappé à l'affichage ; l'import WhatsApp est borné (≤ 5 Mo, ≤ 20 000 lignes) ; toute nouvelle route respecte permissions + CSRF + limitation de débit + audit (`TOOLS_PARSE`, `GEO_LOCATE` non audités ; `LIMITES_IMPORT`, `INBOX_IMPORT`, `INBOX_CONVERT`, `VUE_SAVE`, `REPORT_SNAPSHOT_AUTO` audités).

---

## 6. SCÉNARIOS DE RECETTE SUPPLÉMENTAIRES (s'ajoutent aux 17 de la V4 ; tous doivent passer)
18. Coller un lien Google Maps long dans la zone « Coller » → position + commune suggérée remplies, toast **Annuler** fonctionnel.
19. Coller **un message WhatsApp complet** (lien TikTok + lien de localisation + phrase en arabe) → lien, plateforme, **date estimée**, position, texte restant en observations ; aucun champ rempli à la main écrasé.
20. Coller uniquement un lien Facebook/Instagram/TikTok → plateforme et type de contenu détectés ; **message « aucune position »** avec les 3 boutons d'action ; aucune position inventée.
21. Coller des coordonnées avec **chiffres arabes** et en **DMS** → même résultat que les décimales.
22. Deux positions distinctes dans un même collage → puces de choix, rien d'appliqué avant choix.
23. Joindre une photo JPEG avec EXIF → proposition d'utiliser sa position ; capture d'écran sans EXIF → message clair.
24. En **HTTP** : bouton « Ma position » désactivé avec infobulle ; en **HTTPS** (`https:setup`) : fonctionne.
25. Position dans une commune dont les **limites sont importées** → commune/daïra appliquées (polygone) ; sans limites → suggestion « voisinage » seulement.
26. Saisir une anomalie du même type à 30 m d'une anomalie ouverte → bandeau doublon géographique ; « Lier comme signalement répété » → fiche mère « Signalée 2 fois ».
27. Semaine de démo : toutes les sections du rapport (entonnoir, médiane/P90, SLA, ancienneté, plateforme, groupe, agent, jours, points noirs récurrents, qualité, faits marquants) **cohérentes avec le tableau de bord et l'export Excel** ; PDF A4 de 5 pages lisible FR et AR.
28. Faits marquants : forcer une situation (taux sous l'objectif, EPIC lent) → la règle correspondante apparaît avec le bon lien filtré.
29. Boîte de réception : import d'un export WhatsApp de 50 messages (liens, positions, bruit) → éléments corrects, conversion en fiche pré-remplie (P2).
30. Vues enregistrées, onglets avec compteurs exacts, page « À faire » et cloche cohérentes avec la base.
31. « Enregistrer et dupliquer » sur une vidéo montrant 2 anomalies → 2 fiches, même lien, avertissement de lien accepté.
32. Thèmes clair/sombre + FR/AR (RTL) sur **toutes** les nouvelles pages et composants : `check:styles` et `check:a11y` toujours verts.

---

## 7. LIVRABLES V5
Migration `002_v5.sql` · modules `shared/smartPaste.js`, `shared/geo.js` (Haversine, point-dans-polygone, grille), `shared/gps.js` étendu · services/routes de § 2.9 et § 3 · composants UI (zone Coller, puces « ce que j'ai compris », badge de source, mini-carte sélecteur, vues enregistrées, cloche, onglets à compteurs, graphiques de § 3) · scripts `https:setup` · README et `DECISIONS.md` mis à jour · captures `docs/screens/` régénérées · **tous les tests V4 + V5 verts**.