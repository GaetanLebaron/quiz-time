# Quiz Time pour Android TV

Petite appli Android qui affiche le site Quiz Time en plein écran sur une TV Android ou Google TV. Le jeu lui-même reste le site : l'appli l'ouvre, garde l'écran allumé et apparaît dans le lanceur de la TV avec sa bannière. Le téléphone du Maître du Jeu sert toujours de télécommande via le QR code.

L'appli charge le site en ligne : la TV doit être connectée à Internet, et chaque mise à jour du site apparaît sans réinstaller l'appli.

## Récupérer l'APK

GitHub compile l'APK automatiquement à chaque modification du dossier `android-tv`.

1. Ouvre l'onglet **Actions** du dépôt, puis la dernière exécution de **APK Android TV** (point vert).
2. En bas de la page, dans **Artifacts**, télécharge **quiz-time-tv** : c'est un zip qui contient `quiz-time-tv.apk`.
3. Dézippe-le.

Tu peux aussi lancer une compilation à la main : **Actions → APK Android TV → Run workflow**.

## Installer sur la TV

1. Sur la TV, autorise l'installation d'applis de sources inconnues (Paramètres → Système ou Sécurité → Sources inconnues), pour l'appli qui va recevoir le fichier.
2. Envoie `quiz-time-tv.apk` sur la TV, par exemple avec l'appli **Send Files to TV** (installée sur le téléphone ou l'ordinateur et sur la TV), puis ouvre le fichier sur la TV pour l'installer.
3. Quiz Time apparaît dans la liste des applis de la TV.

L'APK est signé avec une clé de test, différente à chaque compilation. Pour installer une nouvelle version, désinstalle d'abord l'ancienne.

## Utilisation

- L'appli ouvre directement l'écran TV avec le QR code.
- **OK** sur la télécommande : réessayer si la TV n'avait pas de connexion.
- **Retour** : quitter l'appli.

## Modifier

- Adresse du site : `app/src/main/res/values/strings.xml` (`site_url`).
- Bannière du lanceur : `app/src/main/res/drawable-xhdpi/banner.png` (320 × 180) et `drawable-xxxhdpi/banner.png` (640 × 360).
- Icône : `app/src/main/res/mipmap-*/ic_launcher.png`.

Le projet s'ouvre aussi dans Android Studio (dossier `android-tv`).
