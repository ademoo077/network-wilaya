# DECISIONS — Plateforme de suivi des anomalies (points noirs)

- **Base legacy** : la base V3 ne contient que des fixtures de test (`Daia Test`, `EPIC Test`, `Admin Test`). Elle est archivée intacte (`data/legacy-v3.db` + copie hors dépôt) et **non importée** ; V4 repart d'une base propre et réimporte la taxonomie officielle du CSV (70/156). Aucune perte : le fichier legacy reste ouvrable.
- **Moteur SQLite** : `better-sqlite3` (v12 installé et fonctionnel). Repli `node:sqlite` non nécessaire.
- **Sessions** : jetons 32 octets, cookie `sid`, seul le SHA-256 est stocké (table `sessions`), expiration glissante `SESSION_TTL_HOURS`.
- **CSRF** : jeton par session, en-tête `X-CSRF-Token` exigé sur POST/PUT/PATCH/DELETE (sauf login).
- **Dates métier** : chaînes `YYYY-MM-DD` (calendrier Alger), arithmétique sur `Date.UTC`, jamais `new Date('YYYY-MM-DD')` local.
- **Pourcentages** : méthode du plus grand reste dans `shared/percent.js`, calculés côté serveur uniquement.
- **Référentiels initiaux** : aucun territoire/EPIC/agent inventé ; saisis via l'assistant ou `seed:demo` (`[DEMO]`).
- **Playwright** : `check:a11y` et E2E utilisent Playwright si le navigateur est disponible ; sinon repli documenté sur un contrôle Node des tokens (contraste) et sur les tests d'intégration.
- **Import Excel** : support CSV et XLSX en lecture ; le modèle téléchargeable est CSV (UTF-8 BOM) + XLSX.
- **`week_start_day`** : défaut 0 (dimanche), configurable 0–6.
- **Jalon pré-V5** : aucun commit V4 n'existait au pivot (la reconstruction entière était non commitée) ; la copie `C:\Users\pc\Desktop\_v5_safe_20261108-104507` préserve l'état exact et le tag `v4-avant-v5` porte une annotation signalant cette situation, plutôt que de prétendre que l'ancien `HEAD` V3 était la V4.
- **Seed des groupes V5** : un groupe existant est retrouvé par les catégories déjà rattachées avant son nom ; seules les catégories sans groupe sont affectées. Une relance ne rétablit donc ni un libellé ni un rattachement modifié par l'administrateur.
- **Tables P2 en migration 002** : `liens_cache` et `boite_reception` sont créées dès 002 comme l'impose la spécification, mais aucune requête sortante ni import de réception n'est activé avant leurs phases P2.
- **Paramètres réseau sûrs** : `enrichissement_en_ligne=0` et `https_actif=0` restent désactivés par défaut ; aucune résolution distante n'est effectuée pendant les phases P1.
- **Types de contenu V5** : les segments propres aux plateformes sont ramenés aux valeurs canoniques du schéma (`p/posts/share/status → post`, `watch/tv/live → video`, `stories → story`, `shorts → short`) afin de ne pas stocker deux vocabulaires.
- **Inversion GPS V5** : `smartPaste` ne propose l'inversion que si la première valeur dépasse 90°, conformément à la V5 ; le parseur V4 `parseGps` conserve son heuristique algéroise `3,36 → 36,3` pour compatibilité des saisies existantes.
- **Bord des polygones** : le bord extérieur appartient à la commune ; le bord et l'intérieur d'un trou n'y appartiennent pas. Les Plus Codes restent au lot P2 comme indiqué dans la spécification.
- **Voisinage territorial** : toutes les anomalies non supprimées et géolocalisées comptent, indépendamment de leur vérification ; il faut au moins deux voisines et 60 % pour une commune, sinon aucune suggestion.
- **Import GeoJSON** : plusieurs entités appariées à la même commune sont fusionnées en `MultiPolygon`; un aperçu peut rester partiel, mais le commit n'enregistre que les correspondances explicites et audite leurs compteurs.
- **E2E navigateur** : `scripts/e2e.js` a été ajouté (health, garde auth, login/logout, anomalies, stats, parse-paste, geo-locate) et passe ; les scénarios UI 18–26 de la V5 ne sont pas exécutés par Playwright faute de navigateurs installés dans l'environnement — vérification navigateur à prévoir avec `npx playwright install` si disponible.
- **Résolution distante** : la garde SSRF complète est livrée et testée en phase 3, mais la route réseau `resolve-link` reste inactive jusqu'au lot P2 conformément à la règle « P1 d'abord ».
- **HTTPS V5** : `scripts/https-setup.js`, variables `HTTPS/HTTPS_CERT/HTTPS_KEY/COOKIE_SECURE`, serveur HTTP/HTTPS et HSTS conditionnel sont câblés ; le bouton « Ma position » est désactivé avec explication hors contexte sécurisé et le presse-papiers direct n'est proposé qu'en contexte sécurisé. La validation complète du certificat local et de la géolocalisation Android/Windows reste manuelle.
- **Collage UI** : la zone Coller capture le `paste` sur les champs ciblés (`smart-paste`, `lien_url`, `gps_text`) et analyse le texte ; l'application ne remplace pas les champs déjà renseignés manuellement sans protection explicite, avec toast « Annuler ». L'EXIF est lu côté navigateur (`exifr`) sans envoi serveur.
- **Limites territoriales** : l'UI admin permet aperçu/import GeoJSON via `/api/admin/limites/import-geojson` (CSRF + rate limit + audit) ; la mini-carte du formulaire peut afficher la limite connue via `/api/geo/limit/:communeId`.

