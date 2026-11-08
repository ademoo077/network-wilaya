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
