# Extension de capture assistée — Veille citoyenne (Wilaya d'Alger)

Extension **Manifest V3** pour Edge/Chrome. Elle permet à un agent autorisé de
transmettre **manuellement** une publication publique (Facebook, presse locale,
site officiel…) vers la boîte de veille de la plateforme.

## Ce que fait l'extension — et ce qu'elle ne fait pas

**Elle lit uniquement l'onglet actif, après un clic de l'agent :**

- l'URL (`location.href`, lien canonique, `og:url`) ;
- le titre de la page et les métadonnées publiques `og:*` ;
- la **sélection de texte** visible effectuée par l'agent.

**Elle ne fait pas :**

- aucun défilement automatique, aucune collecte en masse, aucune lecture d'autres onglets ;
- aucun script de contenu permanent, aucune permission d'hôte large, aucun code distant ;
- aucune télémétrie ; elle ne communique qu'avec l'adresse de plateforme configurée ;
- aucune création automatique de fiche anomalie : l'envoi crée un élément à qualifier,
  qu'un humain doit ensuite retenir.

## Installation (mode développeur)

1. Ouvrir `edge://extensions` (Edge) ou `chrome://extensions` (Chrome).
2. Activer **Mode développeur**.
3. Cliquer **Charger l'extension non empaquetée** et choisir le dossier `extension/`
   du dépôt.
4. Ouvrir les **Réglages** de l'extension (icône ⚙ ou clic droit → Options).

Aucune publication sur un magasin n'est nécessaire ; l'extension peut aussi être
déployée par stratégie d'organisation.

## Configuration

1. Dans la plateforme : **Profil → Capture assistée**, créer un jeton nommé
   (par exemple « Poste agent 3 »), puis le copier immédiatement — il n'est
   affiché qu'une fois.
2. Dans les réglages de l'extension :
   - **Adresse de la plateforme** : `http://192.168.117.163:3000` (réseau local)
     ou l'adresse HTTPS de production, **sans** `/api` ;
   - **Jeton personnel de capture** : le jeton copié.
3. Enregistrer, puis rouvrir le popup.

Le jeton est stocké dans `chrome.storage.local` du navigateur, jamais synchronisé.
Il est révocable à tout moment depuis le profil ; un jeton révoqué est refusé (401).

## Utilisation

1. Se placer sur la publication publique à signaler.
2. Sélectionner le passage utile (sinon l'extension propose la description publique).
3. Cliquer sur l'icône de l'extension, puis **Lire la page active**.
4. Vérifier et corriger l'aperçu : URL, page, date, texte.
5. **Envoyer à la veille** : la réponse affiche le statut, la priorité et les
   suggestions, avec un lien **Ouvrir dans la plateforme**.

Une capture en double (même URL ou texte très proche) ne crée pas de doublon :
la plateforme répond alors « déjà présente ».

## Sécurité et conformité

- Authentification par **jeton Bearer** personnel, à portée `capture` uniquement,
  haché en base et limité à **60 captures par heure** et **100 Ko** par envoi.
- Le serveur n'accepte le CORS que pour les origines `chrome-extension://` /
  `moz-extension://` sur `POST /api/veille/capture` ; aucune origine web n'est
  autorisée.
- Le texte tiers est stocké comme donnée (jamais interprété en HTML) et purgé
  après la durée de conservation configurée s'il n'est pas retenu.
- Finalité unique : traiter les anomalies **matérielles** de l'espace public.
  Pas de surveillance d'individus, d'opinions ou de profils.
- En HTTP (réseau local), le trafic n'est pas chiffré : préférer HTTPS pour
  l'exploitation. L'accès au presse-papiers peut nécessiter HTTPS ; le jeton
  reste copiable manuellement depuis le profil.

## Développement

- Aucune étape de build : les fichiers sont chargés tels quels.
- Les fichiers `shared.js`, `popup.js` et `options.js` sont des scripts locaux ;
  la CSP par défaut de MV3 interdit tout script distant.
- Vérifications automatiques : `npx vitest run server/tests/veille-extension.test.js`.

## Journal

Voir `CHANGELOG.md`.
