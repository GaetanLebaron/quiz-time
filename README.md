# Quiz Time

Application de quiz pour un Maître du Jeu : un **écran TV** affiche les questions, et le **smartphone** du Maître du Jeu sert de télécommande.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Page de l'application |
| `css/style.css` | Apparence |
| `js/base.js` | Réglages, rôle de l'appareil (TV, télécommande, équipe, hôte sans TV) et fonctions communes |
| `js/moteur.js` | Déroulement de la partie avec Maître du Jeu |
| `js/liaison.js` | Échange de messages entre la TV et les téléphones (ntfy.sh, Nostr, liaison directe) |
| `js/libre.js` | Partie sans Maître du Jeu : chaque équipe joue sur son téléphone |
| `js/app.js` | Écrans et démarrage de l'application |
| `js/qrcode.js` | Génération du QR code |
| `donnees/questions.json` | **Toutes les questions**, thèmes et niveaux |
| `polices/lilita-one.woff2`, `polices/nunito.woff2` | Polices (Lilita One et Nunito, licence SIL Open Font License) |
| `manifest.webmanifest`, `sw.js`, `images/icon-192.png`, `images/icon-512.png` | Installation sur l'écran d'accueil (PWA) |
| `images/favicon.png` | Icône de l'onglet du navigateur (fond transparent) |
| `outils/` | Script d'ajout de lots de questions (`outils/ajouter-lot.py`) et lots déjà ajoutés (`outils/lots/`) |

`index.html`, `sw.js` et `manifest.webmanifest` restent à la racine du dépôt GitHub ; les autres fichiers gardent leurs dossiers.

## Mise en ligne (GitHub Pages)

1. Dans le dépôt, **Add file → Upload files**, puis glisse **les fichiers et les dossiers** (`css`, `js`, `donnees`, `images`, `polices`), pas le dossier qui les contient, et valide avec **Commit changes**. Les fichiers qui existent déjà (comme `index.html`) sont remplacés.
2. Attends le point vert dans l'onglet **Actions**, puis recharge la page de la TV en forçant l'actualisation (Cmd + Maj + R sur Mac, Ctrl + Maj + R sous Windows).

## Utilisation

1. Ouvre l'adresse du site sur la **TV** et choisis **Avec Maître du Jeu** : un QR code s'affiche.
2. Scanne-le avec le **smartphone** du Maître du Jeu : l'écran de configuration s'ouvre (équipes, tours, mode de jeu, niveau, timer).
3. Lance la partie depuis le téléphone. La TV affiche d'abord les règles du jeu ; quand les équipes les ont lues, touche **Lancer la partie** sur le téléphone pour passer à la première question.
4. Pour chaque question, l'équipe peut répondre directement (5 points). Sinon, affiche les 4 propositions : touche sur le téléphone la proposition donnée par l'équipe, puis **Valider** (3 points si elle est juste, 1 point après un 50/50). La TV montre la bonne réponse et, si elle est fausse, la proposition choisie.

Le téléphone mémorise la connexion : une fois la page ajoutée à l'écran d'accueil (« Ajouter à l'écran d'accueil » dans le menu du navigateur), l'icône rouvre directement la télécommande. Pour utiliser un appareil comme écran TV à la place, ouvre `adresse-du-site/?tv`, ou touche le lien « Utiliser cet appareil comme écran TV » en bas de l'écran de configuration.

À la fin d'une partie, la TV garde le classement affiché (même après un rechargement) jusqu'à ce que le Maître du Jeu touche « Nouvelle partie » sur son téléphone. Si le téléphone n'est plus connecté, la TV affiche un QR code au-dessus du classement : il suffit de le scanner puis de toucher « Nouvelle partie ». Ouvrir `adresse-du-site/?tv` sur la TV efface aussi la partie en cours et revient à l'écran d'accueil. Dans l'application installée, où l'adresse ne se modifie pas, fais défiler l'écran de la TV jusqu'en bas : le bouton **Réinitialiser l'écran TV** fait la même chose (la partie reste dans les parties enregistrées).

## Partie sans Maître du Jeu

Sur la TV, choisis **Sans Maître du Jeu** avant de scanner le QR code (ou, sur l'écran de configuration du téléphone, choisis **Sans** Maître du Jeu, puis **Avec la TV** ou **Sans TV**). Le téléphone qui configure est l'hôte : il joue aussi pour son équipe. Les autres équipes (8 au total au maximum) scannent le QR code affiché sur ce téléphone et entrent le nom de leur équipe. Avec la TV, dès que l'hôte est connecté, la TV affiche à son tour le QR code des équipes : chacune peut la scanner directement.

- Toutes les équipes répondent en même temps à la même question, chacune sur son téléphone.
- Réponse tapée directement : 5 points (les petites fautes d'orthographe sont acceptées). Quand la réponse est une personne, le nom de famille suffit (« Hugo » pour « Victor Hugo », « de Gaulle » ou « Gaulle » pour « Charles de Gaulle »), sauf pour un souverain numéroté (« Louis XIV ») ou désigné par un surnom (« Charles le Chauve »). Avec les 4 propositions : 3 points. Après un 50/50 : 1 point. Chaque équipe choisit son aide sans que les autres le voient, et une réponse envoyée est définitive.
- La question se termine quand toutes les équipes ont répondu ou à la fin du timer (30 s par défaut). Une équipe sans réponse marque 0.
- Avec la TV, celle-ci montre qui a déjà répondu, puis la bonne réponse, la réponse de chaque équipe et ses points. Sans TV, tout s'affiche sur les téléphones.
- Chaque équipe touche **Prêt** pour passer à la question suivante ; l'hôte peut forcer la suite avec **Question suivante**.
- Une équipe peut rejoindre la partie en cours (elle joue à partir de la question suivante) ou la quitter sans bloquer les autres.

Sans TV, l'hôte ouvre l'adresse du site sur son téléphone et choisit **Sans Maître du Jeu** : il configure la partie, puis montre son QR code aux autres équipes (il peut aussi ouvrir directement `adresse-du-site/?host`). Son téléphone fait alors tourner la partie : il doit rester allumé jusqu'à la fin. Pour ajouter une TV, touche **Avec la TV** sur son écran de configuration : il suffit alors d'ouvrir le site sur la TV, de choisir **Sans Maître du Jeu** et de scanner son QR code avec le téléphone de l'hôte (le nom de l'équipe et les réglages sont conservés ; les équipes déjà inscrites rescannent le QR code de l'hôte).

## Modes de jeu

- **Standard** : toutes les questions sont du niveau choisi.
- **Crescendo** : choisis au moins deux niveaux. La partie commence par le plus facile et finit par le plus difficile ; les tours sont répartis entre les niveaux choisis (il faut au moins un tour par niveau). Par exemple, 7 tours sur les niveaux 1, 3 et 5 donnent : tours 1 à 3 en Très facile, tours 4 et 5 en Moyen, tours 6 et 7 en Expert. L'écran de configuration affiche cette répartition, et la TV annonce chaque passage au niveau supérieur.

## Ajouter des questions

Ouvre `donnees/questions.json` et ajoute des lignes dans la liste `"questions"`, sans oublier la virgule entre deux questions :

```json
{"theme":0,"niveau":2,"groupe":"capitales","question":"Quelle est la capitale du Portugal ?","reponse":"Lisbonne","anecdote":"Lisbonne est l'une des plus anciennes villes d'Europe."}
```

| Champ | Obligatoire | Signification |
|---|---|---|
| `theme` | oui | Numéro du thème, de 0 à 5 : 0 Géographie, 1 Divertissements, 2 Histoire, 3 Arts et Littérature, 4 Sciences et Nature, 5 Sports et Loisirs |
| `niveau` | oui | De 1 (Très facile) à 5 (Expert) |
| `question` | oui | Texte affiché |
| `reponse` | oui | Bonne réponse |
| `anecdote` | conseillé | Affichée après la réponse |
| `groupe` | non | Étiquette de famille (ex. `capitales`). Les fausses propositions sont tirées parmi les réponses du même groupe : donne le même groupe aux questions du même type |
| `annee` | non | `true` si la réponse est une année : les fausses propositions sont alors des années proches |
| `fausses` | non | Liste d'au moins 3 fausses propositions à utiliser à la place du tirage automatique. Toutes les questions de niveau 3 à 5 en ont. Aux niveaux 4 et 5, les trois leurres sont proches de la réponse (même époque, même domaine) ; au niveau 3, un seul l'est et les deux autres sont plus connus ou plus éloignés |

Les thèmes et les noms de niveaux se modifient en haut du même fichier. Une erreur de virgule ou de guillemet rend le fichier illisible : l'application affiche alors un message d'erreur. Tu peux vérifier le fichier sur jsonlint.com avant de le déposer.

## Parties enregistrées

Les parties sont conservées dans le navigateur de la TV (les 10 dernières). Utilise le même navigateur, hors navigation privée. Si une question est retirée de `donnees/questions.json`, une partie enregistrée qui l'utilisait reprend avec une autre question.

## Si le téléphone reste sur « Écran TV : en recherche »

Sur la TV comme sur le téléphone, touche **« Détails de connexion »** (replié par défaut pour ne pas encombrer l'écran des joueurs ; un ⚠ s'y ajoute en cas de problème d'envoi) pour voir le **code de l'écran** (4 derniers caractères) et l'état des envois.

- **Codes différents :** le téléphone a mémorisé un autre écran. Touche « Scanner le QR code d'un autre écran », puis scanne le QR code de la TV.
- **« service saturé (429) » :** le service gratuit ntfy.sh limite le nombre de requêtes par connexion Internet (TV et téléphone sur le même Wi-Fi comptent ensemble). Le plus efficace : passer le téléphone en données mobiles (Wi-Fi coupé), il a alors sa propre limite. Sinon, ferme les pages Quiz Time inutiles et patiente 2 minutes. Aucun message n'est perdu : la TV comme le téléphone renvoient automatiquement chaque message refusé, dans l'ordre, avec une attente croissante (5 s, 10 s… jusqu'à 60 s). Le motif exact donné par le service s'affiche entre guillemets (par exemple « limit reached: too many requests »). Si au moins un relais Nostr est connecté, les messages passent par lui et ce blocage n'empêche plus de jouer.
- **« daily message quota reached » :** le quota quotidien gratuit de ntfy.sh est épuisé pour cette connexion Internet. Avec la liaison directe, une partie ne consomme plus que quelques messages ; en attendant la remise à zéro du quota (le lendemain), passe le téléphone en données mobiles ou utilise une autre connexion pour la TV.
- **Aucune erreur, mais pas de réponse :** vérifie que la page de la TV est ouverte et active (certaines TV mettent les onglets en veille).

Des lignes de diagnostic complètent l'écran d'attente du téléphone :

- **Liaison : directe par le Wi-Fi ✓ / via ntfy.sh et Nostr.** Voir « Échange de messages » ci-dessous. Cette ligne apparaît aussi en bas de l'écran de configuration du téléphone et sur l'écran d'attente de la TV.

- **Relais : ntfy.sh OK / saturé (429) · Nostr n/3 connecté(s).** État de chacune des deux voies de relais.
- **Réception en temps réel : ouverte / fermée.** « Fermée » signifie que le téléphone n'arrive pas à garder la liaison continue avec le service.
- **Lecture de secours : OK (n message(s) de la TV).** Si la liaison temps réel est fermée ou si la TV ne répond pas, le téléphone lit directement, toutes les 10 secondes, les derniers messages publiés par la TV. La partie reste jouable dans ce mode, avec un peu de retard. « 0 message » indique que la TV ne publie rien : regarde alors la ligne « Envoi » affichée sur la TV. Tant que la TV n'a pas répondu, le téléphone renvoie un signal toutes les 30 secondes.

## Échange de messages

1. **Mise en relation via ntfy.sh et Nostr, en parallèle** (services publics, sans compte) : le téléphone envoie une demande de liaison directe, la TV y répond en un seul message. Soit environ 2 messages par connexion. Chaque message part à la fois vers ntfy.sh et vers 3 relais Nostr publics (relay.damus.io, nos.lol, relay.primal.net) ; le premier qui l'accepte suffit, et le destinataire ignore les doublons. Si ntfy.sh est saturé ou en panne, un relais Nostr prend le relais, et inversement. Les messages Nostr sont « éphémères » : les relais les transmettent sans les conserver. Chaque page les signe avec une clé jetable, sans compte. Sur un navigateur trop ancien (sans BigInt ou WebCrypto), seul ntfy.sh est utilisé.
2. **Liaison directe WebRTC par le Wi-Fi** : ensuite, toutes les actions de jeu passent directement entre la TV et le téléphone, sans serveur relais. Le quota gratuit de ntfy.sh (quelques centaines de messages par jour et par connexion Internet) n'est donc plus consommé pendant la partie. Un serveur STUN public (Google) sert seulement à connaître son adresse ; aucun message de jeu n'y passe.
3. **Secours** : si la liaison directe échoue (téléphone en 4G, Wi-Fi « invité » qui isole les appareils…) ou se coupe, tout repasse automatiquement par ntfy.sh et Nostr, et le téléphone retente une liaison directe.

Les noms d'équipes, questions et scores qui passent par ntfy.sh ou Nostr sont protégés par un code aléatoire contenu dans le QR code (ils ne sont pas chiffrés : quelqu'un qui connaîtrait ce code pourrait les lire). Pour un usage plus sensible, il faudrait héberger son propre serveur ntfy : il suffit alors de définir `window.QT_BASE='https://mon-serveur/'` avant le chargement de `js/base.js` dans `index.html`. De même, `window.QT_NOSTR=['wss://mon-relais']` remplace la liste des relais Nostr (`[]` les désactive).
