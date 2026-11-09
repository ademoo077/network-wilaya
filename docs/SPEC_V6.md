# SPÉCIFICATION V6 — Correctifs complets et fiabilisation
**Complète `docs/SPEC.md` (V4) et `docs/SPEC_V5.md` (V5).** Ce document **gagne** sur ses sujets. Placer dans `docs/SPEC_V6.md`.
Priorités : **B** = bloquant (rien n'est « terminé » tant qu'il n'est pas vert) · **P1** · **P2**.

---

## 1. CONSTATS (observés sur captures de la V5 en fonctionnement)

| # | Écran | Symptôme | Cause probable (à confirmer dans le code/console) | Correctif | Prio |
|---|---|---|---|---|---|
| C1 | `#/carte`, `#/anomalies/nouvelle` | **Écran blanc après rechargement (F5)** ; fonctionne quand on y arrive par la navigation interne | Rendu avant que `/auth/me` et `/ref/bootstrap` soient chargés → accès à `undefined` (`.map`, `.find`) → exception non rattrapée → React démonte tout (pas d'`ErrorBoundary`). Aggravants possibles : initialisation Leaflet sur conteneur absent/de taille nulle, double montage StrictMode, chunk `React.lazy` en échec, `Suspense` sans repli | § 2 | **B** |
| C2 | Saisie | Collage de **liens courts de localisation** (`maps.app.goo.gl`…) : **aucune position** | Résolution serveur absente, désactivée par défaut, ou bloquée (proxy/pare-feu/SSRF trop strict, redirection de consentement, page HTML sans coordonnées dans l'URL finale) | § 4 | **B** |
| C3 | Saisie | Coller dans **Lien** ou **GPS** : **aucun message**, plateforme reste « Autre » ; la zone « Collage intelligent » exige de cliquer **Aperçu** | Gestionnaires `paste`/`input` non branchés sur les champs, pas d'état de retour visible | § 3.3–3.5 | **B** |
| C4 | Saisie | **Logique du formulaire** fragile (champs écrasés, états incohérents, réponses asynchrones tardives qui écrasent des valeurs) | État éparpillé dans plusieurs composants, pas de suivi de l'origine des valeurs, pas d'annulation des requêtes obsolètes | § 3.1–3.2 | **B** |
| C5 | Saisie | Champs **Catégorie, Type, Daïra, Commune** : aucun texte indicatif (seule une loupe) ; select **« Détails »** sans signification | Placeholders et libellés manquants | § 3.4 | P1 |
| C6 | Saisie | Sous « Statut » : **« Plateforme détectée : À vérifier »** (clé i18n/hint erronée) | Mauvaise clé de dictionnaire | § 3.4 | P1 |
| C7 | Saisie | Zone **« Motif »** visible à la **création** | Affichée en permanence | § 3.4 | P1 |
| C8 | Saisie | Barre d'actions flottante **recouvre** les champs (Commune) ; carte « Classification » étirée avec un grand vide | Barre `fixed` non réservée dans la mise en page ; grille sans `items-start` | § 3.6 | P1 |
| C9 | Carte | Légende et attribution **se chevauchent**, attribution en gros, tache blanche près du zoom, bandeau « Fond de carte indisponible » alors que la carte peut être partiellement chargée | CSS Leaflet non maîtrisé, détection `tileerror` trop sensible | § 5 | P1 |
| C10 | Carte | 1 anomalie affichée alors que le tableau de bord en compte 2 | Anomalies sans GPS non signalées | § 5.3 | P1 |
| C11 | Tableau de bord | Cartes « Par catégorie / Par daïra » **étirées** (une seule barre dans 800 px de vide) ; barres sans légende ni valeur ; **« Activité récente » répétée** (4 lignes identiques « ANM-2026-00001 · 15:16 ») sans texte d'action | Grille à hauteurs égales ; une ligne par champ modifié | § 6 | P1 |
| C12 | Global | **Manque de réactivité** : pas de retour immédiat, états de chargement/survol/focus insuffisants | Pas de couche de données (cache, mutations optimistes), pas de squelettes systématiques | § 7 | P1 |

Les écrans non capturés (liste, fiche, rapport, administration, connexion, thème sombre, arabe) doivent être **audités par le protocole du § 8** — ne rien supposer.

---

## 2. ROBUSTESSE DU DÉMARRAGE ET DU ROUTAGE (B)

**Règle d'or : aucune exception ne doit jamais produire un écran blanc.**

2.1 **Séquence de démarrage** (`App.jsx`) — machine d'états explicite : `boot → authChecking → (anonyme → #/connexion) | (connecté → refLoading → ready) | fatal`.
- `/auth/me` puis `/ref/bootstrap` sont chargés **avant** de rendre les routes protégées ; pendant ce temps : **squelette plein écran** (logo + barre de progression).
- Échec réseau ou 5xx : écran **FatalError** (message FR/AR, bouton **Réessayer**, détail technique repliable « Copier »), jamais de blanc.
- 401 en cours de session : redirection vers `#/connexion?next=<route>` et retour à la route après connexion.
2.2 **`ErrorBoundary` à deux niveaux** : global (autour de l'application) et **par route** (autour de chaque page) ; le repli affiche un message clair, **Recharger la page**, **Retour au tableau de bord**, détail copiable. Le shell (barre latérale/supérieure) reste utilisable si une page plante.
2.3 **Journal d'erreurs client** : `window.onerror`, `unhandledrejection` et `ErrorBoundary` envoient `POST /api/client-errors {message, stack, route, userAgent, version}` (limité à 20/min/IP, taille bornée, **sans donnée personnelle**), stocké dans une table `erreurs_client` (rétention 30 jours) et affiché dans **Administration › Santé › Erreurs client récentes**.
2.4 **Programmation défensive** : tout accès à des données asynchrones utilise `data?.items ?? []` ; les réponses API sont **validées par zod** à la frontière (`api/client.js`) ; en cas d'écart de schéma : avertissement console (dev) + valeur de repli, jamais d'exception.
2.5 **Chargement paresseux fiable** : `React.lazy` enveloppé dans un `lazyWithRetry` (1 nouvelle tentative, puis rechargement unique de la page via `vite:preloadError`, puis écran d'erreur) ; `Suspense` avec **squelette de page** ; `vite.config` : `base: './'`.
2.6 **Cycle de vie Leaflet** (carte et mini-carte) : création dans `useEffect` uniquement quand le conteneur existe ; **`map.remove()` au démontage** ; garde contre le double montage StrictMode (ne pas recréer sur le même nœud) ; `ResizeObserver` → `invalidateSize()` ; aucune manipulation des icônes par défaut de Leaflet (`divIcon` SVG) ; plugins (`markercluster`, `heat`) importés **dans le module de carte**, jamais au niveau global ; le composant carte entier est dans un `ErrorBoundary` dédié (la page reste affichée si la carte échoue).
2.7 **HashRouter** : toutes les routes de la V4 § 2.6 + `*` (404 stylée) ; la query vit dans le hash (`#/anomalies?statut=…`) ; un rechargement sur n'importe quelle route avec session valide rend la page **sans passer par un état vide**.
2.8 **Test bloquant** (§ 8) : rechargement dur de **chaque** route × thème × langue × (base vide / base de démo) → zéro `pageerror`, zéro `console.error`, contenu visible en < 3 s.

---

## 3. FORMULAIRE « NOUVELLE ANOMALIE » — RÉÉCRITURE COMPLÈTE (B)
Réécrire le formulaire (création **et** modification) sur la base suivante ; supprimer l'ancien code devenu inutile.

### 3.1 Architecture d'état (un seul endroit)
Hook `useAnomalieForm()` basé sur **un reducer unique** :
```
state = {
  values: { lien_url, plateforme, contenu_type, date_publication, date_signalement, domaine_id, type_id,
            daira_id, commune_id, adresse_texte, lieu_dit, gps:{lat,lng}|null, priorite, observations,
            verification, agent_id, statut, epic_id, intervenant_autre, date_intervention, date_traitement, motif },
  meta:   { [champ]: { origin:'defaut'|'manuel'|'auto', source?:string, confiance?:'haute'|'moyenne', estimee?:bool } },
  tasks:  { parse, resolve, locate, duplicates, nearby, exif, submit }   // chacun { status:'idle'|'loading'|'ok'|'warning'|'error', id, message?, data? }
  suggestions: [ { champ, valeur, source, confiance } ],                // propositions non appliquées
  undo:   [ { champsModifies:{champ:ancienneValeur}, etiquette } ],      // une entrée par action d'auto-remplissage
  errors: { [champ]: code }, touched: { [champ]: bool }, dirty: bool
}
```
**Règles** :
1. Toute valeur automatique est posée par l'action `AUTOFILL(champ, valeur, source, confiance)` ; **elle n'écrase jamais** un champ `origin='manuel'` : dans ce cas elle devient une **suggestion** (« Remplacer par … ? [Remplacer] [Ignorer] »).
2. Toute édition utilisateur pose `origin='manuel'`.
3. **Requêtes asynchrones** (`resolve`, `locate`, `duplicates`, `nearby`) : chacune a un `requestId` incrémental et un `AbortController` ; **seule la dernière réponse est appliquée** ; changer l'entrée annule la précédente ; timeouts : resolve 8 s, locate 3 s, autres 5 s.
4. **Une action d'auto-remplissage = une entrée `undo`** ; le toast « Champs remplis — **Annuler** » restaure exactement les anciennes valeurs (et les `meta`).
5. Validation = **schémas zod partagés** (`shared/schemas.js`) ; erreurs affichées **au blur** puis à chaque frappe une fois touchées, et **toutes** à la soumission (focus sur la première erreur + résumé `role="alert"` en haut).
6. Brouillon : sauvegarde automatique (debounce 800 ms, `localStorage` en `try/catch`, repli mémoire) ; à l'ouverture : « Reprendre la saisie en cours ? [Reprendre] [Recommencer] ».

### 3.2 Table des remplissages automatiques
| Champ | Source automatique | Appliqué sans clic ? |
|---|---|---|
| `lien_url` | collage (zone, champ Lien, page) ; URL nettoyée (suivi retiré, schéma ajouté si absent) | oui |
| `plateforme`, `contenu_type` | hôte et chemin de l'URL | oui |
| `date_publication` | estimation TikTok/Instagram (« estimée ») | oui si vide |
| `gps` + badge source | lien de carte, DMS, décimaux, geohash Waze, Plus Code, **lien court résolu**, EXIF, carte, appareil | oui si une seule position ; sinon puces de choix |
| `adresse_texte` | nom de lieu extrait d'un lien Google Maps résolu | suggestion seulement |
| `daira_id`, `commune_id` | `/geo/locate` (polygone = haute ; voisinage = moyenne) | haute : oui ; moyenne : suggestion |
| `observations` | texte restant du message collé (≥ 10 car.) | case à cocher, cochée par défaut |
| `domaine_id` | choix du **type** (recherche « type d'abord ») | oui |

### 3.3 Collage : comportements EXACTS (aucun bouton « Aperçu »)
- **Zone « Collage intelligent »** : `textarea` à hauteur automatique, **autofocus** à l'ouverture ; analyse **immédiate** sur `paste` (via `event.clipboardData`) **et** sur `input` (debounce 300 ms) ; bouton **Effacer** ; glisser-déposer de texte/image ; **Ctrl+V sur la page quand aucun champ éditable n'a le focus** → le texte part dans la zone. Le bouton « Coller depuis le presse-papiers » n'existe **que** si `window.isSecureContext` (sinon texte d'aide « Faites Ctrl+V »).
- **Champ Lien** : sur `paste`, `blur` et saisie (debounce 300 ms) : nettoyage de l'URL, détection plateforme/contenu, estimation de date, contrôle de doublon (`check-link`), **message visible sous le champ** (§ 3.5). Un lien saisi sans schéma (`facebook.com/...`) est corrigé en `https://…` avec message d'information. Un collage **contenant plusieurs éléments** (lien + coordonnées + texte) dans ce champ est **redirigé** vers l'analyseur complet (la partie lien reste dans le champ, le reste est appliqué aux autres champs).
- **Champ GPS** : sur `paste`, `blur`, saisie (debounce 400 ms) : analyse de **tous** les formats (§ 4.2), y compris liens de carte et liens courts ; une fois valide, le champ est **normalisé** (`36.753800, 3.058800`), le marqueur de la mini-carte se déplace, le badge de source s'affiche ; vidé → marqueur retiré ; invalide → erreur « Format non reconnu » avec 3 exemples cliquables.
- Un collage de **lien social dans le champ GPS** (ou de lien de carte dans le champ Lien) est **redirigé** vers le bon champ avec un message (« Ce lien est une publication : placé dans Lien »).
- **Puces « ce que j'ai compris »** sous la zone : une puce par élément (Lien · Plateforme · Contenu · Date estimée · Position · Commune suggérée · Photo), états `✔` (ok), spinner (en cours), `⚠` (avertissement), `✖` (échec + action) ; chaque puce est cliquable/supprimable.

### 3.4 Champs, libellés, aides (corrections C5–C7)
Ordre : **Collage → Source → Classification → Localisation → Options avancées (repliées) → Observations et pièces jointes.**
- **Source** : `Lien de la publication *` (placeholder `https://www.facebook.com/…`) · `Plateforme` (select + badge « détectée ») · **`Type de contenu`** (remplace « Détails » : Reel · Vidéo · Publication · Story · Photo · Short · Direct · Autre) · `Date de publication` (aide « estimée » si déduite) · `Date de signalement *` (défaut aujourd'hui, pas de date future).
- **Classification** : `Catégorie *` (placeholder « Choisir une catégorie… ») et `Type *` (placeholder « Rechercher un type… ») — les deux **affichent la valeur choisie** ; recherche « type d'abord » (taper `حفرة` propose `الطريق › حفرة` et renseigne la catégorie) ; `Priorité` (segmenté).
- **Localisation** : `Daïra *` (« Choisir une daïra… »), `Commune *` (« Choisir une commune… », désactivée tant que la daïra est vide, avec aide « Choisissez d'abord la daïra »), `Adresse`, `Lieu-dit`, `Coordonnées GPS` (+ badge de source, `Ma position`, `Ouvrir dans Maps`, `Copier`), mini-carte, « Anomalies proches ».
- **Options avancées** (section repliée à la **création**, dépliée en modification ou si l'utilisateur change statut/vérification) : `Vérification`, `Agent`, `Statut`, `EPIC` (« Non affecté » / « Autre intervenant »), dates d'intervention/traitement **selon le statut**. **`Motif` n'apparaît que lorsqu'il est requis** (retour en arrière de statut, infirmation, réouverture).
- Aides sous les champs (**textes exacts, aucune clé réutilisée**) : Statut → « Pour passer en *en cours* ou *traité* : vérification confirmée, agent et intervenant requis. » ; options de statut non permises **désactivées avec raison**.
- **Test i18n** : aucun hint ne peut afficher la valeur d'un autre champ ; un test de rendu vérifie l'absence de la chaîne « Plateforme détectée » sous « Statut » et l'absence de tout champ sans libellé accessible.

### 3.5 Retours visibles — catalogue (FR ; AR équivalent, parité testée)
`lien.ok` « Lien reconnu : {plateforme} · {contenu} » · `lien.plateformeInconnue` « Plateforme non reconnue — choisissez-la si besoin » · `lien.invalide` « Le lien doit commencer par http:// ou https:// » · `lien.corrige` « https:// ajouté automatiquement » · `date.estimee` « Date de publication estimée : {date} (modifiable) » · `gps.ok` « Position reconnue : {lat}, {lng} · {source} » · `gps.invalide` « Format de coordonnées non reconnu » · `gps.horsZone` « Cette position semble hors de la wilaya d'Alger — vérifiez » · `gps.aucune` (message V5 § 0 + 3 actions) · `resolve.encours` « Résolution du lien court… » · `resolve.ok` « Position trouvée via le lien court » · `resolve.echec.reseau` « Internet indisponible depuis le serveur — ouvrez le lien, copiez l'adresse complète, collez-la ici » · `resolve.echec.delai` « Le lien met trop de temps à répondre — réessayez » · `resolve.echec.sansCoord` « Ce lien ne contient pas de coordonnées » · `resolve.echec.bloque` « Ce lien n'est pas autorisé » · `resolve.desactive` « Résolution des liens désactivée par l'administrateur » · `locate.ok` / `locate.suggestion` / `locate.aucune` · `dup.lien` · `dup.strict` · `dup.geo` · `exif.ok` / `exif.aucune`. Chaque message est affiché **sous le champ concerné** ET sous forme de puce, avec **icône + texte**, `aria-live="polite"`.

### 3.6 Mise en page (corrections C8)
- Grille de sections `grid-cols-1 lg:grid-cols-2 items-start gap-6` : **aucune carte n'est étirée**. Colonne gauche : Classification + Options avancées ; colonne droite : Localisation (avec carte). Source en pleine largeur.
- **Barre d'actions collante** : `position: sticky; bottom: 0` **dans le conteneur de défilement**, **pleine largeur de la colonne de contenu**, fond opaque + ombre haute, `padding-bottom` de la page = hauteur de la barre (+ zone sûre mobile) → **ne recouvre jamais un champ** (test géométrique § 8.4). Boutons : Annuler · Enregistrer · **Enregistrer et nouveau** ; sur mobile empilés.
- Mini-carte : hauteur 280 px (240 mobile), centre Alger zoom 11, passe à zoom 16 dès qu'une position existe ; clic/déplacement du marqueur → met à jour le GPS (`origin:'manuel'`, source `carte`).

### 3.7 Soumission
Bouton en état `loading` (désactivé, spinner) ; validation complète ; `POST /anomalies`. Gestion : `409 DUPLICATE_LINK` → boîte de dialogue listant les fiches (**Voir** · **C'est une autre anomalie** → renvoi `force_duplicate` · **Annuler**) ; `409 DUPLICATE_STRICT` → erreur sous le lien ; `422` → erreurs placées sur les champs ; `409 VERSION_CONFLICT` → proposition de recharger ; erreur réseau → formulaire conservé + toast + **Réessayer**. Succès : toast avec lien vers la fiche ; « Enregistrer » → fiche ; « Enregistrer et nouveau » → formulaire réinitialisé (daïra, date, plateforme conservées), focus dans la zone Collage, brouillon effacé.
Territoire vide : alerte bloquante claire (V4 § 8.3) à la place du formulaire, jamais un formulaire inutilisable.

---

## 4. LIENS ET POSITIONS GPS (B)

### 4.1 Chaîne de décision (ordre fixe)
1. **Analyse locale instantanée** (`shared/smartPaste.js`, hors-ligne) → si position trouvée : **terminé**.
2. Sinon, si un **lien court de carte** est présent : **résolution serveur automatique** (§ 4.3), avec puce « Résolution… ».
3. Sinon, si le message contient un **lien social** : détecter plateforme/contenu/date ; **message « aucune position »** + 3 actions (placer sur la carte, ma position, joindre une photo).
4. Toujours : EXIF des photos jointes, mini-carte, géolocalisation appareil.

### 4.2 Formats reconnus localement (un test par format ; ≥ 40 vecteurs)
Tous ceux de la V5 § 2.2 **plus** :
- **Waze lien court `waze.com/ul/h<geohash>`** : décoder le **geohash** hors-ligne (alphabet `0123456789bcdefghjkmnpqrstuvwxyz`) ; vecteur de référence : `ezs42` → ≈ (42.605, −5.603).
- **Plus Codes** complets **et courts** (`V75V+8R Alger`, `V75V+8R`) : décodage OLC hors-ligne ; les codes courts sont **récupérés** (`recoverNearest`) avec le point de référence = centre de la wilaya (36.7538, 3.0588) ; tests par aller-retour encode/décode et vecteur de la spécification OLC `849VCWC8+R9` ≈ (37.4223, −122.0846) à ±0,0005.
- **Google Maps** : `…/maps/place/<nom>/@lat,lng,…/data=!3m1!4b1!4m…!3dLAT!4dLNG` (**épingle `!3d!4d` prioritaire**), `?q=lat,lng`, `?q=<nom>&ll=`, `/maps/search/?api=1&query=lat%2Clng`, `/maps/@lat,lng,17z`, `/maps/dir/…/lat,lng` (dernière position = destination, avertissement), `google.dz` et autres domaines Google ; **nom de lieu** extrait de `/place/<nom>/` (décodé, `+`→espace) pour suggérer `adresse_texte`.
- **Bing** `cp=lat~lng` ; **Yandex** `ll=lng%2Clat` (**ordre inversé**) ; **HERE** `map=lat,lng,zoom` (P2).
- Chiffres arabes-indiens, `٫`, `،`, DMS, `N/S/E/W`, liens enveloppés (`l.facebook.com`, `google.com/url?q=`, `consent.google.com/…?continue=`).
- **Priorité en cas de plusieurs positions** : épingle (`!3d!4d`, `q=`, `ll=`) > `@` (centre de vue) > coordonnées en texte ; si deux positions distinctes (> 100 m) subsistent : puces de **choix** (rien d'appliqué).

### 4.3 Résolution des liens courts — **doit fonctionner par défaut**
**Paramètres** : `resolution_liens` = `cartes` (**défaut**) | `tous` | `aucune` ; `cartes` = liens courts de **cartes** uniquement ; `tous` = + liens courts de réseaux sociaux (TikTok `vm.`/`vt.`, `fb.watch`, `facebook.com/share/…`, `instagr.am`) pour **normaliser et dater** ; `enrichissement_metadonnees` = 0 (défaut, oEmbed titre/auteur). Variables d'environnement : `OUTBOUND_PROXY` (ex. `http://proxy:8080`), `NODE_EXTRA_CA_CERTS` (inspection TLS).
**Domaines courts de cartes à résoudre** : `maps.app.goo.gl`, `goo.gl/maps`, `g.co/kgs`, `share.google`. Liste blanche des **sauts de redirection** : `*.google.com`, `*.google.dz`, `*.google.fr`, `goo.gl`, `maps.app.goo.gl`, `g.co`, `share.google`, `consent.google.com`.

`POST /tools/resolve-link {url}` (authentifié, CSRF, 30 req/min/utilisateur) → `{ ok, coords?:{lat,lng,source:'lien_court'}, urlFinale?, lieu?, code? , message? }` :
1. Valider l'URL et le domaine ; consulter le **cache** (`liens_cache`, succès 7 j, échec 5 min).
2. **Boucle de redirections manuelle** (`redirect:'manual'`, **6 sauts max**) avec `undici` : `User-Agent` de navigateur, `Accept-Language: fr,ar;q=0.8,en;q=0.5`, **aucun cookie**, timeout global **6 s**. À chaque saut : revalider le domaine (liste blanche), **résoudre le DNS et refuser toute adresse privée/loopback/lien-local (IPv4/IPv6)** via un `lookup` personnalisé du connecteur (anti-rebinding), puis tenter `parseCoordsFromUrl(location)` ; **arrêt au premier succès**. Déballer `consent.google.com/...?continue=<url>`.
3. Si le dernier saut est une page HTML **sans coordonnées dans l'URL** : lire ≤ 512 Ko et chercher dans l'ordre : `!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)` → `center=(-?\d+\.\d+)%2C(-?\d+\.\d+)` (balise `og:image`) → `\[null,null,(-?\d{1,2}\.\d{3,}),(-?\d{1,3}\.\d{3,})\]` → `@(-?\d+\.\d+),(-?\d+\.\d+)` ; vérifier la plausibilité (dans une zone élargie de l'Algérie) sinon confiance basse.
4. Si seul un **nom de lieu** est trouvé : renvoyer `lieu` (suggestion pour `adresse_texte`), `code:'NO_COORDINATES'`.
5. **Codes d'échec typés** : `DISABLED`, `NETWORK_UNAVAILABLE` (DNS/ECONNREFUSED/ETIMEDOUT), `TIMEOUT`, `BLOCKED_HOST`, `TOO_MANY_REDIRECTS`, `TLS_ERROR` (`UNABLE_TO_VERIFY_LEAF_SIGNATURE` → conseil `NODE_EXTRA_CA_CERTS`), `NO_COORDINATES`, `UPSTREAM_ERROR`. Le client traduit chaque code en message du § 3.5.
6. **Repli manuel intégré** à la puce d'échec : bouton **« Ouvrir le lien »** (nouvel onglet, `rel="noopener noreferrer"`) + mode d'emploi en 3 lignes (« 1. Ouvrez · 2. Copiez l'adresse de la page · 3. Collez-la ici ») + **Réessayer**. Le formulaire reste **entièrement utilisable** pendant et après l'échec.
**Administration › Santé › « Connectivité sortante »** : bouton **Tester** → vérifie DNS, accès HTTPS (`https://www.google.com/generate_204`), proxy utilisé, erreurs TLS, et affiche un diagnostic lisible + conseil (proxy, pare-feu, certificat). Résultat mis en cache 60 s.
**Sécurité inchangée** (V5 § 2.4) : aucune authentification contournée, pas de cookies, taille bornée, aucune donnée tierce stockée (hors `liens_cache` de coordonnées), audit des **échecs répétés** (`RESOLVE_FAIL` agrégé).
**Testabilité** : le résolveur reçoit `fetchImpl`/`lookupImpl` **injectables** ; les tests lancent un **faux serveur HTTP local** simulant : redirection 302→302→URL avec `@lat,lng` ; URL finale avec `!3d!4d` ; enveloppe `consent.google.com` ; page HTML contenant `center=` ; redirection vers `127.0.0.1` (refusée) ; boucle infinie (refusée) ; timeout ; 5xx ; domaine hors liste. Un test **réel** optionnel (`E2E_LIVE=1`, lien fourni par `TEST_SHORT_LINK`) vérifie le fonctionnement en conditions réelles.

### 4.4 Liens de réseaux sociaux
Rappel V5 § 0 : **aucune position dans ces URL**. Traitement : plateforme, `contenu_type`, nettoyage, estimation de date (TikTok, Instagram), doublon ; avec `resolution_liens=tous`, les liens courts sociaux sont d'abord résolus pour obtenir l'URL longue (ID TikTok → date). Message « aucune position » + 3 actions. **Jamais de position inventée.**

---

## 5. CARTES (corrections C9, C10)

### 5.1 Page Carte
- Mise en page : panneau de filtres/liste à gauche (repliable), carte `calc(100dvh − topbar)`. **Légende dans le panneau** (repliable) et **non sur la carte** ; attribution **11 px**, en bas à droite, **jamais chevauchée** (z-index et marges testés) ; supprimer toute « tache » parasite près des contrôles de zoom.
- **Détection de repli fiable** : le bandeau « Fond de carte indisponible » s'affiche **seulement si** aucune tuile n'a été chargée après **6 s** ou si **≥ 5 erreurs consécutives sans aucun chargement** ; il disparaît dès qu'une tuile se charge ; le fond quadrillé reste derrière les marqueurs.
- `fitBounds` avec `maxZoom: 16` ; clustering ; bascule **Densité** (V5) ; clic sur un marqueur → popup (référence, type, statut, « Ouvrir la fiche »).
- **Cohérence des comptes** : chip « **N anomalie(s) sans position** — non affichées » → lien vers `#/anomalies?gps=absent` (nouveau filtre `gps=absent|present` côté API et liste).
- Aucune exception si la carte échoue : `ErrorBoundary` dédié + message + liste latérale toujours fonctionnelle.
### 5.2 Mini-carte du formulaire
Mêmes règles (cycle de vie, repli, attribution) ; clic = place le point ; marqueur déplaçable ; anomalies proches en marqueurs fantômes ; affichage du badge de source.

---

## 6. TABLEAU DE BORD (correction C11)
- Grille **`items-start`** : aucune carte n'est étirée pour égaler sa voisine. Blocs « Par catégorie / daïra / type / commune / EPIC » : **hauteur selon le contenu**, `max-h-[420px] overflow-auto` si la liste est longue, « Voir tout » ; **« Activité récente » dans sa propre ligne/colonne**, `max-h-[520px] overflow-auto`.
- **Barres** : couleurs de **statut** (non traité / en cours / traité) avec **légende commune**, valeurs `n` et `%` visibles, info-bulle, clic → liste filtrée ; état vide « fantôme ».
- **Activité récente** : regrouper par `(anomalie, utilisateur, minute)` et **afficher l'action en clair** : « ANM-2026-00001 — Statut : Non traité → Traité · Administrateur · 08/11/2026 15:16 » (plusieurs champs = une ligne résumée « 4 modifications » dépliable) ; ne jamais répéter des lignes identiques.
- Tous les blocs : squelette → contenu ; erreur → message + Réessayer.

---

## 7. RÉACTIVITÉ, INTERACTIONS, DESIGN (correction C12)

**Couche de données** : adopter **`@tanstack/react-query`** (cache, `staleTime`, déduplication, `keepPreviousData`, retry maîtrisé, invalidation ciblée) pour toutes les lectures ; **mutations optimistes** avec retour arrière en cas d'erreur pour : changement de statut/vérification en liste, sélection de vues, bascules. Préchargement de la route au survol des liens du menu.
**Standards mesurables** (vérifiés par tests où possible) :
- Réponse visuelle à toute interaction **< 100 ms** (survol, focus, clic) ; toute opération asynchrone affiche un état (spinner/squelette/bouton désactivé) **< 100 ms** après le geste ; transitions de route **< 150 ms** perçues (squelette immédiat) ; saisie sans latence perceptible (debounce ≥ 250 ms pour réseau, 0 ms pour feedback local).
- **Chaque élément interactif** a des états distincts : repos, survol, `:focus-visible`, actif, désactivé (avec infobulle de raison), chargement ; curseur correct ; zones cliquables ≥ 44 px.
- **Chaque action** produit un retour : toast succès/erreur, ou mise à jour visible ; aucune action silencieuse.
- Animations sobres (160–220 ms, `prefers-reduced-motion` respecté) : apparition des cartes, ouverture des tiroirs/sections, compteurs, puces du collage (entrée/sortie), chevauchements interdits.
- **Responsive** : 390 / 768 / 1024 / 1440 px ; sidebar → tiroir < 1024 px ; liste → cartes < 768 px ; formulaire 1 colonne ; barre d'actions empilée ; **aucun défilement horizontal de page**.
- **Performance** : bundle initial < 300 ko gzip hors carte ; `React.lazy` par route ; `useMemo`/`memo` sur graphiques et lignes de tableau ; listes virtualisées > 200 lignes ; pas de re-rendu global à chaque frappe (état du formulaire isolé).
- **Design** : tokens V4 ; aucune couleur en dur ; thèmes clair/sombre ; FR/AR (RTL, propriétés logiques) ; hiérarchie typographique nette ; densité aérée ; états vides illustrés ; cohérence totale des composants `ui/`.

---

## 8. PROTOCOLE DE TEST EN NAVIGATEUR RÉEL (obligatoire — le modèle ne peut pas « voir », il **mesure**)

### 8.1 Infrastructure (à construire **en premier**, Phase 1)
- Playwright (Chromium) en `devDependency` ; `npx playwright install chromium`. Si l'installation est impossible : le noter dans `AUDIT_V6.md` et utiliser **jsdom + Testing Library** pour les tests de composants **plus** des tests d'API ; les vérifications visuelles deviennent alors une **liste de contrôle manuelle** fournie à l'utilisateur.
- `tests/e2e/helpers.js` : `startTestServer()` (base temporaire, port aléatoire, **faux serveur de redirections** pour les liens courts, dossier de sauvegardes temporaire) · `loginAs(role)` (cookie via l'API) · `collectErrors(page)` (écoute `pageerror`, `console.error`, `requestfailed` hors tuiles volontairement bloquées) · `expectNotBlank(page)` (`#root` contient un `h1`/`main` visible et ≥ 50 caractères de texte en < 3 s) · `pasteText(page, selector, texte)` (dispatch d'un vrai `ClipboardEvent('paste')` avec `DataTransfer`) · `blockTiles(page)` (`route.abort()` sur l'hôte de tuiles).
- Scripts : `npm run test:e2e` · `npm run qa` = build + lint + `check:styles` + unitaires + intégration + e2e + `check:a11y`.
### 8.2 Rechargement dur de chaque route (**bloquant**)
Pour **chaque route** de la V4 § 2.6 × {clair, sombre} × {FR, AR} × {base vide, base de démo} : `goto` → `reload` → `reload` ; assertions : zéro `pageerror`/`console.error`, `expectNotBlank`, titre de page attendu visible. Variantes : API `/ref/bootstrap` en 500 → écran **FatalError** (pas de blanc) puis **Réessayer** fonctionne ; chunk JS bloqué → rechargement unique puis écran d'erreur ; tuiles bloquées → repli de carte conforme ; réseau lent (latence 1,5 s) → squelettes visibles.
### 8.3 Tests de collage et de formulaire
Fichier `tests/fixtures/paste-vectors.json` (≥ 40 entrées : texte collé → plateforme, contenu, position attendue ou « aucune », date estimée, champs remplis) couvrant tous les formats du § 4.2, des messages WhatsApp réalistes FR/AR, liens enveloppés, deux positions distinctes, liens courts (faux serveur) ; **chaque vecteur est joué** dans : la zone Collage, le champ Lien, le champ GPS, et par Ctrl+V sur la page. Assertions : champs remplis, **message visible**, aucun bouton requis, **valeur manuelle jamais écrasée**, **annulation** restaure, **dernière requête gagne** (deux collages rapprochés), résolution lente → puce « en cours » puis résultat sans blocage du formulaire.
### 8.4 Assertions géométriques (remplacent le regard humain)
- La barre d'actions collante **n'intersecte aucun** champ/bouton visible ; scroller jusqu'en bas → dernier champ entièrement visible au-dessus de la barre.
- Dans une même ligne de grille, **aucune carte n'a plus de 120 px de vide** sous son contenu (hauteur de la carte ≤ hauteur du contenu + 120).
- **Aucun défilement horizontal** de page (`document.documentElement.scrollWidth ≤ innerWidth`) à 390/768/1024/1440.
- Légende et attribution de carte : rectangles **sans intersection** ; aucun élément visible de largeur nulle.
- Tout `input/select/textarea` visible a un **nom accessible** non vide et un placeholder ou une valeur lisible.
- Axe (`@axe-core/playwright`) : 0 violation `color-contrast`, `label`, `button-name`, `link-name`, `aria-*` (serious/critical) sur chaque route et thème.
### 8.5 Captures
Chaque route est capturée (FR clair, FR sombre, AR sombre ; 1440 et 390 px) dans `docs/screens/` **pour examen humain**, mais **aucune validation ne dépend d'un regard** : tout critère ci-dessus est vérifié par assertion.

---

## 9. SCÉNARIOS DE RECETTE V6 (s'ajoutent aux 32 de V4+V5 ; **tous** doivent passer)
33. F5 sur chaque route, connecté, 4 combinaisons thème×langue, base vide et démo → jamais de blanc, console propre.
34. F5 sur `#/anomalies/nouvelle` avec territoire vide → alerte claire, pas de blanc.
35. `/ref/bootstrap` en erreur 500 → FatalError avec **Réessayer** qui fonctionne.
36. Chunk de page bloqué → un rechargement automatique puis écran d'erreur stylé.
37. Coller un lien Google Maps long dans la zone → champs remplis en < 1 s **sans clic**, toast **Annuler** fonctionnel.
38. Coller un lien Facebook dans **Lien** → plateforme = Facebook, type de contenu, message visible ; lien inconnu → « non reconnue ».
39. Coller des coordonnées dans **GPS** → normalisées, marqueur déplacé, badge de source.
40. Coller un lien court (faux serveur, 2 redirections) → puce « Résolution… » puis position, commune suggérée.
41. Lien court impossible à résoudre (réseau coupé simulé) → puce rouge avec raison, **Ouvrir le lien**, **Réessayer**, mode d'emploi ; formulaire utilisable.
42. Deux liens courts collés à la suite → seule la **dernière** réponse est appliquée.
43. Champ modifié à la main puis collage contenant une autre valeur → pas d'écrasement ; suggestion « Remplacer ? ».
44. Waze geohash, Plus Code court, DMS, chiffres arabes, `consent.google.com/?continue=` → positions correctes.
45. Mise en page : barre collante sans chevauchement, aucun grand vide, 390 px propre.
46. Libellés : aucun champ sans nom ; « Type de contenu » présent ; hint de Statut correct ; **Motif** invisible à la création et visible quand requis.
47. Carte : tuiles OK → pas de repli ; tuiles bloquées → repli après la règle des 6 s/5 erreurs ; légende et attribution sans chevauchement ; chip « N sans position » exact.
48. Tableau de bord : pas de carte étirée ; barres avec légende et valeurs ; activité récente groupée et lisible.
49. Réactivité : API ralentie à 1,5 s → squelette/spinner < 100 ms, boutons désactivés, aucune action silencieuse ; changement de statut en liste **optimiste** avec retour arrière sur erreur.
50. Santé › Connectivité sortante : diagnostic correct (OK / proxy / TLS / DNS) avec conseil.
51. Page Santé › Erreurs client : une erreur provoquée volontairement y apparaît.
52. **Régression** : les 32 scénarios V4+V5 passent toujours.

---

## 10. LIVRABLES V6
Code corrigé et réécrit (formulaire, résolveur, cartes, dashboard, couche de données) · migration `003_v6.sql` (`erreurs_client`, paramètres `resolution_liens`, `enrichissement_metadonnees`, filtre `gps`) · `tests/e2e/*`, `tests/fixtures/paste-vectors.json`, faux serveur de redirections · `npm run qa` vert · `AUDIT_V6.md` (chaque constat C1–C12 : cause réelle trouvée, correctif, test associé) · README mis à jour (proxy sortant, HTTPS, `qa`, dépannage « écran blanc ») · captures `docs/screens/`.