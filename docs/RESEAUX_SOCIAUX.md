# Répertoire des réseaux sociaux

## Accès et usage

- Répertoire : `/#/reseaux-sociaux`.
- Administration : `/#/admin/reseaux-sociaux`.
- Statistiques : `/#/reseaux-sociaux?onglet=statistiques`.

Les utilisateurs connectés peuvent consulter les fiches, leurs noms, leurs liens,
les statistiques et les exports CSV/Excel. Seul un administrateur peut ajouter,
corriger, vérifier, désactiver ou importer des fiches.

Il s'agit d'un **annuaire manuel de comptes**, distinct des connecteurs de veille.
Aucune publication n'est collectée, aucun nom n'est récupéré sur Internet et aucun
chiffre d'audience, d'abonnés ou de réactions n'est déduit des liens.

## Fiches et corrections

Une fiche comprend le nom, le réseau, le type (`page`, `profil`, `groupe`, `chaine`
ou `autre`), le CA, la commune, le lien fourni, les observations, l'état de
vérification et l'activité. Les CA correspondent aux daïras du référentiel existant.

Pour une saisie manuelle, le nom et un lien HTTP(S) valide sont obligatoires. La
commune doit appartenir au CA choisi. Sans correspondance certaine, des libellés
libres peuvent être conservés ; ils ne créent pas de référentiel.

La désactivation conserve la fiche. Un lien équivalent reste un doublon, même
parmi les fiches inactives. L'identité du compte est normalisée dans `shared/`,
sans accès réseau ; le lien fourni reste distinct. Un lien de publication est
signalé et conservé, sans inventer son auteur.

Chaque modification envoie la version de la fiche. Un conflit HTTP `409` bloque
la sauvegarde jusqu'à un rechargement manuel réussi : aucune réécriture forcée ni
tentative automatique. Les erreurs conservent le formulaire ; la fermeture d'un
brouillon demande confirmation. Les créations, modifications et imports sont audités.

## Tableau LIEN fourni

Le fichier local `docs/base de données réseaux sociaux (2).xlsx` est conservé tel
que fourni. L'extraction vérifiée utilisée par l'application est
`seed/reseaux-sociaux-lien.json`.

Le classeur original reste local, hors du commit de ce module ; seule l'extraction
**LIEN** est versionnée. Son empreinte SHA-256 au contrôle est
`c8031d3b299319e011dc6bbf7f7d9b4a2423fcb4fc4a5114990a170b23bed5a3`.

Seule la feuille **LIEN** est importée :

| Colonne | Contenu | Règle |
| --- | --- | --- |
| A | CA | Propagation des cellules fusionnées/vides dans le même groupe |
| B | COMMUNES | Propagation dans le même CA |
| C / D | lien / nom | Page par défaut |
| E / F | autres / nom | Profil par défaut |

Un groupe identifiable dans l'URL est classé comme groupe. Ces catégories restent
provisoires : toutes les fiches importées sont **À vérifier**. Un nom absent reste
vide, affiché comme « Nom non renseigné », et doit être renseigné avant vérification.

L'extraction contient **89 lignes, 95 liens et 4 lignes sans lien** : 94 liens
Facebook et 1 lien TikTok, provisoirement 79 pages, 10 profils et 6 groupes. Les
autres feuilles ne sont ni consultées pour l'import ni mélangées aux anomalies.

La provenance Excel (fichier, feuille, ligne, colonne, nom, CA et commune source)
est conservée séparément et n'est pas modifiable par l'API. Les noms et
rattachements courants restent corrigibles par l'administrateur.

### Rattachements à confirmer

Les variantes orthographiques connues, dont `DELY BRAHIM` → `Dely Ibrahim`, servent
uniquement à retrouver un référentiel existant. Aucune commune n'est déplacée.
Avec le référentiel fourni, quatre liens restent sans commune certaine :

- `36:C` : `DAR EL BEIDA / MOHAMADIA` ; Mohammadia appartient à El Harrach.
- `40:C` : `DAR EL BEIDA / AIN TAYA` ; Aïn Taya appartient à Rouiba.
- `81:C` et `82:C` : `SIDI ABDELLAH / SIDI ABDELLAH` ; Sidi Abdallah est un CA,
  pas une commune du référentiel (Mahelma et Rahmania).

Ces libellés source restent visibles et exportables. Une correction exige une
décision explicite de l'administrateur, pas une affectation devinée à l'import.

## Import sûr

Dans l'administration, **Importer le tableau** permet d'analyser le tableau
fourni ou un fichier `.xlsx` (maximum 5 Mo), puis de consulter les nouvelles fiches,
fiches existantes, doublons et erreurs avant confirmation. Seules les nouvelles
fiches valides sont ajoutées. L'aperçu est réservé à son administrateur et expire
après 15 minutes.

L'application effectue une sauvegarde SQLite cohérente avant l'application. Les
doublons sont revérifiés au moment de la transaction. Une relance ne modifie ni
les corrections, ni la vérification, ni les désactivations déjà enregistrées.
Une confirmation répétée du même aperçu n'ajoute pas de doublon.

La commande est en **aperçu sans modification** par défaut : même les migrations
nécessaires à cet aperçu sont exécutées sur une copie temporaire isolée.

```powershell
npm run reseaux:import
npm run reseaux:import -- --file "docs/base de données réseaux sociaux (2).xlsx"
```

Uniquement après validation de l'aperçu et autorisation de modifier la base :

```powershell
npm run reseaux:import -- --commit
```

Le mode `--commit` sauvegarde avant les migrations et l'import, ajoute les fiches
et affiche les compteurs ainsi que l'intégrité SQLite. Une erreur de lien bloque
ce mode CLI ; corriger le fichier plutôt que contourner la validation.

## Statistiques et exports

La recherche, le réseau, le type, le CA, la commune, la vérification et l'activité
définissent la même population pour la liste, les statistiques SQL et les exports.
Les filtres, le tri, la pagination, l'onglet et la fiche ouverte sont conservés
dans l'URL. Cliquer un compteur ou une répartition ouvre la liste correspondante.

La couverture porte sur les communes actives du référentiel dans le périmètre
territorial choisi. Les comptes rattachés à un territoire désactivé ne disparaissent
pas des listes et répartitions. Les comptes non rattachés restent comptés sous
leurs libellés, avec un détail filtré exact.

CSV et Excel exportent **tous les comptes filtrés**, indépendamment de la page
affichée, en respectant le tri. Les formules de tableur sont neutralisées. Le
classeur contient `Répertoire`, `Par réseau`, `Par type`, `Par CA`, `Par commune`
et `Périmètre`, avec la date d'export d'Alger et les filtres appliqués. Les exports
sont suspendus pendant la mise à jour des filtres pour éviter une sélection périmée.

## Déploiement et erreur « Ressource introuvable »

Le module utilise la migration additive `011_reseaux_sociaux.sql`. Le démarrage
applique la migration, **mais n'importe jamais automatiquement le tableau**.

Une interface reconstruite peut afficher le répertoire tandis qu'un ancien
processus Express ne connaît pas encore `/api/reseaux-sociaux`. Dans ce cas, l'API
retourne `404` et « Ressource introuvable ». Reconstruire le client ne suffit pas :
après une sauvegarde cohérente pré-migration et enregistrement des saisies en cours,
redémarrer uniquement le processus de cette application. Ne pas réinitialiser la
base, les comptes ou les sessions.

```powershell
npm run build
npm start
```

Ne pas démarrer une seconde instance si le port `3000` est déjà occupé. Après
redémarrage, `/api/health` doit répondre `200` ; le répertoire et `/stats` répondent
`401 UNAUTHORIZED` sans session (routes présentes et protégées), puis `200` avec
une session autorisée. Actualiser le navigateur avec `Ctrl + F5` pour recharger les
assets. Voir `docs/RESEAU_LOCAL.md` pour l'accès LAN et la vérification séparée depuis
un autre appareil.

## Recette

Les tests utilisent exclusivement des bases temporaires isolées :

```powershell
npx vitest run shared/tests/reseauxSociaux.test.js server/tests/reseaux-sociaux.test.js
npm run build
npx playwright test tests/e2e/reseaux-sociaux.spec.js
npm run qa
```

Les scénarios couvrent les permissions, CSRF, versions, doublons inactifs, import
fourni/uploadé et idempotence, provenance, erreurs et brouillons, pagination,
filtres/tri/statistiques/exports, rechargements, FR/AR RTL, thèmes clair/sombre,
accessibilité clavier/axe et géométrie à 390, 768, 1024 et 1440 px.

## Contrôles de livraison du 16/11/2026

- `npm run qa` réussi : **607 tests Vitest**, **11 scénarios API**, **106 tests
  Playwright**, build, lint, styles et contrastes clair/sombre. Les 15 scénarios
  du répertoire et les anciennes régressions de sauvegarde des synthèses passent.
- La revue visuelle FR/AR a conduit à isoler les compteurs, pourcentages et ratios
  numériques en LTR à l'intérieur de l'interface RTL. Une régression vérifie les
  valeurs, leur séparation géométrique et le ratio de couverture aux quatre largeurs.
- Les assertions de migration ont été étendues à `011` sans retirer les contrôles
  historiques. Les connexions des copies de test sont fermées en `finally`, même
  en cas d'échec d'assertion ; la base source est comparée octet par octet.
- Répétition du CLI sur une copie pré-`011` : sauvegarde cohérente encore en
  migration `010`, puis `011` et 95 ajouts. Une relance ajoute zéro fiche et
  conserve la correction et la désactivation effectuées sur cette copie.
- Redémarrage réel après sauvegarde
  `backups/anomalies-20261116-153516-securite.db` ; application de `011`, sans
  changement des anomalies, utilisateurs, référentiels, synthèses ou sessions.
- Import réel : **95 ajouts, zéro erreur**, après sauvegarde
  `backups/anomalies-20261116-155235-securite.db`. La comparaison avant/après
  confirme la conservation des données préexistantes et l'intégrité SQLite
  (`ok`, aucune violation de clé étrangère). Le fichier Excel fourni est inchangé.
- Compteurs au contrôle : 79 pages, 10 profils, 6 groupes, 94 comptes Facebook et
  1 TikTok ; tous à vérifier. 14 CA et 38 communes représentés ; les quatre
  rattachements à confirmer restent sans commune. Un nouvel aperçu trouve
  **95 fiches existantes et zéro nouvelle fiche**.
- Sur le poste serveur, `127.0.0.1:3000` et `192.168.117.163:3000` répondent :
  health `200`, routes du répertoire `401` sans session, plus de `404` de route
  absente. Les assets servis correspondent exactement au build vérifié.
  La connexion publique charge et se recharge en FR/mobile et AR/RTL/sombre,
  sans erreur JavaScript ni débordement horizontal.
- **À confirmer par l'utilisateur** : consultation/sauvegarde avec sa session
  réelle et accès depuis un autre appareil. Aucun identifiant réel n'a été essayé
  ou réinitialisé ; les essais de saisie authentifiés utilisent des bases isolées.
