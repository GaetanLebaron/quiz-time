# Quiz Time

Application de quiz pour un Maître du Jeu : un **écran TV** affiche les questions, et le **smartphone** du Maître du Jeu sert de télécommande.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Page de l'application |
| `style.css` | Apparence |
| `app.js` | Logique du jeu |
| `questions.json` | **Toutes les questions**, thèmes et niveaux |
| `qrcode.js` | Génération du QR code |
| `manifest.webmanifest`, `sw.js`, `icon-192.png`, `icon-512.png` | Installation sur l'écran d'accueil (PWA) |

Tous les fichiers doivent rester dans le même dossier, à la racine du dépôt GitHub.

## Mise en ligne (GitHub Pages)

1. Dans le dépôt, **Add file → Upload files**, puis glisse **les fichiers** (pas le dossier qui les contient) et valide avec **Commit changes**. Les fichiers qui existent déjà (comme `index.html`) sont remplacés.
2. Attends le point vert dans l'onglet **Actions**, puis recharge la page de la TV en forçant l'actualisation (Cmd + Maj + R sur Mac, Ctrl + Maj + R sous Windows).

## Utilisation

1. Ouvre l'adresse du site sur la **TV** : un QR code s'affiche.
2. Scanne-le avec le **smartphone** du Maître du Jeu : l'écran de configuration s'ouvre (équipes, tours, niveau, timer).
3. Lance la partie depuis le téléphone.

Le téléphone mémorise la connexion : une fois la page ajoutée à l'écran d'accueil (« Ajouter à l'écran d'accueil » dans le menu du navigateur), l'icône rouvre directement la télécommande. Pour utiliser un appareil comme écran TV à la place, ouvre `adresse-du-site/?tv`, ou touche le lien « Utiliser cet appareil comme écran TV » en bas de l'écran de configuration.

## Ajouter des questions

Ouvre `questions.json` et ajoute des lignes dans la liste `"questions"`, sans oublier la virgule entre deux questions :

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
| `fausses` | non | Liste d'au moins 3 fausses propositions à utiliser à la place du tirage automatique |

Les thèmes et les noms de niveaux se modifient en haut du même fichier. Une erreur de virgule ou de guillemet rend le fichier illisible : l'application affiche alors un message d'erreur. Tu peux vérifier le fichier sur jsonlint.com avant de le déposer.

## Parties enregistrées

Les parties sont conservées dans le navigateur de la TV (les 10 dernières). Utilise le même navigateur, hors navigation privée. Si une question est retirée de `questions.json`, une partie enregistrée qui l'utilisait reprend avec une autre question.

## Si le téléphone reste sur « Écran TV : en recherche »

L'écran d'attente affiche le **code de l'écran** (4 derniers caractères) sur la TV comme sur le téléphone, et l'état des envois.

- **Codes différents :** le téléphone a mémorisé un autre écran. Touche « Scanner le QR code d'un autre écran », puis scanne le QR code de la TV.
- **« service saturé (429) » :** le service gratuit ntfy.sh limite le nombre de requêtes par connexion Internet (TV et téléphone sur le même Wi-Fi comptent ensemble). Le plus efficace : passer le téléphone en données mobiles (Wi-Fi coupé), il a alors sa propre limite. Sinon, ferme les pages Quiz Time inutiles et patiente 2 minutes. Aucun message n'est perdu : la TV comme le téléphone renvoient automatiquement chaque message refusé, dans l'ordre, avec une attente croissante (5 s, 10 s… jusqu'à 60 s). Le motif exact donné par le service s'affiche entre guillemets (par exemple « limit reached: too many requests »).
- **« daily message quota reached » :** le quota quotidien gratuit de ntfy.sh est épuisé pour cette connexion Internet. Avec la liaison directe, une partie ne consomme plus que quelques messages ; en attendant la remise à zéro du quota (le lendemain), passe le téléphone en données mobiles ou utilise une autre connexion pour la TV.
- **Aucune erreur, mais pas de réponse :** vérifie que la page de la TV est ouverte et active (certaines TV mettent les onglets en veille).

Des lignes de diagnostic complètent l'écran d'attente du téléphone :

- **Liaison : directe par le Wi-Fi ✓ / via ntfy.sh.** Voir « Échange de messages » ci-dessous. Cette ligne apparaît aussi en bas de l'écran de configuration du téléphone et sur l'écran d'attente de la TV.

- **Réception en temps réel : ouverte / fermée.** « Fermée » signifie que le téléphone n'arrive pas à garder la liaison continue avec le service.
- **Lecture de secours : OK (n message(s) de la TV).** Si la liaison temps réel est fermée ou si la TV ne répond pas, le téléphone lit directement, toutes les 10 secondes, les derniers messages publiés par la TV. La partie reste jouable dans ce mode, avec un peu de retard. « 0 message » indique que la TV ne publie rien : regarde alors la ligne « Envoi » affichée sur la TV. Tant que la TV n'a pas répondu, le téléphone renvoie un signal toutes les 30 secondes.

## Échange de messages

1. **Mise en relation via ntfy.sh** (service public, sans compte) : le téléphone envoie une demande de liaison directe, la TV y répond en un seul message. Soit environ 2 messages par connexion.
2. **Liaison directe WebRTC par le Wi-Fi** : ensuite, toutes les actions de jeu passent directement entre la TV et le téléphone, sans serveur relais. Le quota gratuit de ntfy.sh (quelques centaines de messages par jour et par connexion Internet) n'est donc plus consommé pendant la partie. Un serveur STUN public (Google) sert seulement à connaître son adresse ; aucun message de jeu n'y passe.
3. **Secours** : si la liaison directe échoue (téléphone en 4G, Wi-Fi « invité » qui isole les appareils…) ou se coupe, tout repasse automatiquement par ntfy.sh, et le téléphone retente une liaison directe.

Les noms d'équipes, questions et scores qui passent par ntfy.sh sont protégés par un code aléatoire contenu dans le QR code. Pour un usage plus sensible, il faudrait héberger son propre serveur ntfy : il suffit alors de définir `window.QT_BASE='https://mon-serveur/'` avant le chargement de `app.js` dans `index.html`.
