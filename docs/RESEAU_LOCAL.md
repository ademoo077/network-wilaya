# Accès à la plateforme sur le réseau local

## Adresse à utiliser

- Interface du serveur : **Ethernet 2**.
- Adresse IPv4 : **192.168.117.163**.
- Masque : **255.255.255.0** (`/24`).
- Passerelle : **192.168.117.1** ; ce n'est pas l'adresse de la plateforme.
- Plateforme : **http://192.168.117.163:3000**.
- Nouvelle anomalie : **http://192.168.117.163:3000/#/anomalies/nouvelle**.

Depuis un autre ordinateur ou téléphone du même réseau, ouvrir cette adresse et se connecter avec un compte existant. Ne pas utiliser `localhost` : cela désignerait l'appareil client, pas le serveur. Le poste serveur doit rester allumé et l'application démarrée.

## Configuration et démarrage

Le serveur Express sert déjà le client compilé et l'API sur le même port. Il n'est pas nécessaire d'exposer Vite (`5173`), de configurer CORS ou de modifier les adresses de l'API dans le client.

Les valeurs utiles du fichier `.env` existant sont :

```dotenv
HOST=0.0.0.0
PORT=3000
NODE_ENV=production
```

`0.0.0.0` permet l'écoute sur les interfaces IPv4 du poste, dont `192.168.117.163`. Ce n'est pas une adresse à saisir dans le navigateur. Ne pas remplacer tout le fichier `.env` : conserver les chemins de données, le secret de session et les autres paramètres existants.

Si l'application n'est pas déjà en cours d'exécution, lancer depuis le dossier du projet :

```powershell
npm run build
npm start
```

Ne pas lancer une deuxième instance sur le port `3000` si une instance fonctionne déjà. Ces commandes n'impliquent ni réinitialisation de l'administrateur ni réimport des données.

## Pare-feu Windows

Au contrôle du 10/11/2026, Ethernet 2 utilise le profil **Public**, et une règle entrante existante autorise Node.js sur ce profil. Aucune règle existante n'a été supprimée ou modifiée.

Si l'accès est bloqué depuis un autre poste, un administrateur Windows peut ajouter la règle ciblée suivante dans PowerShell **exécuté en tant qu'administrateur** :

```powershell
if (-not (Get-NetFirewallRule -Name 'Wilaya-Anomalies-LAN-3000' -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule `
        -Name 'Wilaya-Anomalies-LAN-3000' `
        -DisplayName 'Plateforme anomalies - LAN 192.168.117.0/24' `
        -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 `
        -LocalAddress 192.168.117.163 -RemoteAddress 192.168.117.0/24 `
        -InterfaceAlias 'Ethernet 2' -Profile Any
}
```

Cette nouvelle règle est limitée à l'interface, à l'adresse du serveur, au sous-réseau et au port indiqués. Elle ne restreint pas les autorisations d'autres règles préexistantes. Ne pas désactiver le pare-feu, changer globalement les profils réseau ou ouvrir une redirection de port sur la passerelle.

## Vérifications

Sur le poste serveur :

```powershell
Invoke-RestMethod 'http://192.168.117.163:3000/api/health'
Get-NetTCPConnection -State Listen -LocalPort 3000
```

Le diagnostic doit retourner `ok: true` et `db: true`. La connexion d'écoute doit indiquer `0.0.0.0` ou `192.168.117.163`.

Sur **un autre poste du réseau** :

```powershell
Test-NetConnection 192.168.117.163 -Port 3000
```

Puis ouvrir l'adresse de la plateforme. Si le test échoue, vérifier l'adresse du client (`192.168.117.x/24`), la règle de pare-feu, l'isolation des clients/VLAN et, en cas de machine virtuelle, son mode réseau. Un succès depuis le serveur seul ne prouve pas l'accès depuis un autre appareil.

Pour garder cette URL stable, prévoir une réservation DHCP de `192.168.117.163` sur la passerelle ou une adresse fixe validée par l'administrateur réseau ; ne pas choisir une adresse déjà utilisée.

## HTTP et HTTPS

L'accès actuellement vérifié est en **HTTP**. `COOKIE_SECURE=false` est requis pour ce mode ; passer ce paramètre à `true` sans HTTPS empêcherait les navigateurs d'envoyer les cookies de session sur l'adresse LAN.

HTTP ne chiffre ni les identifiants ni les données. Pour un usage régulier avec des données sensibles, utiliser HTTPS avec un certificat approuvé par les appareils clients, puis `COOKIE_SECURE=true`. L'outil `npm run https:setup` existe, mais aucune rotation de certificat ni bascule HTTPS n'a été effectuée pour cette mise à disposition réseau.

Sur une IP LAN en HTTP, la géolocalisation du navigateur et la lecture directe du presse-papiers nécessitant un contexte sécurisé restent indisponibles. Le collage manuel et la saisie GPS restent utilisables.

## Contrôles réalisés le 10/11/2026

- Adresse `192.168.117.163/24` présente sur Ethernet 2.
- Serveur existant en écoute sur `0.0.0.0:3000`.
- Client et `/api/health` : HTTP `200`, diagnostic de base valide.
- Navigateur réel à `390` et `1440` px : écran de connexion chargé, appels API sur la même adresse LAN, aucune erreur JavaScript ou requête échouée inattendue, aucun débordement horizontal. La route nouvelle anomalie reste protégée sans session.
- Accès depuis un autre appareil : **à confirmer sur ce réseau**.
