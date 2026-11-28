# Applications natives (iOS et Android)

Les apps sont des coquilles [Capacitor](https://capacitorjs.com) autour du build web. Tout le code du jeu reste dans `src/` ; seul `src/platform/` parle aux plugins natifs.

## Construire

```bash
npm ci
npm run native:sync        # build web + copie dans ios/ et android/
npx cap open android       # Android Studio : Run sur un téléphone branché
npx cap open ios           # Xcode (Mac) : choisir l'équipe de signature, puis Run
```

La CI (`.github/workflows/native.yml`) vérifie à chaque changement natif que les deux projets compilent, et garde un **APK Android de debug** installable (onglet *Actions* → dernier run → *Artifacts*).

## Icône et écran de démarrage

Dessinés par le code (`tools/art/draw-icon.js`), puis déclinés dans toutes les tailles :

```bash
npm run art:icons
```

## Ce que font les plugins

| Besoin | Plugin | Repli dans le navigateur |
|---|---|---|
| Sauvegarde | `@capacitor/preferences` | `localStorage` |
| Vibrations | `@capacitor/haptics` (Taptic Engine sur iPhone) | API Vibration (Android) |
| Pause en arrière-plan, bouton retour Android | `@capacitor/app` | `visibilitychange` |
| Portrait seulement | `@capacitor/screen-orientation` + `Info.plist` / `AndroidManifest.xml` | écran « tourne ton téléphone » |
| Écran allumé pendant une partie | `@capacitor-community/keep-awake` | — |
| Plein écran | `@capacitor/status-bar` | — |
| Écran de démarrage | `@capacitor/splash-screen` (masqué quand le premier niveau est prêt) | écran de démarrage HTML |

Le gyroscope passe par l'API web `deviceorientation`, comme `@capacitor/motion` qui l'enveloppe sans rien ajouter (voir `docs/decisions.md`). Sur iPhone, la permission est demandée au toucher de « Jouer en inclinant ».

## Statistiques et rapports de plantage (optionnels)

Rien n'est envoyé tant que le joueur n'a pas accepté, et rien n'est même proposé si le build n'a pas de clés. Pour les activer, créer un fichier `.env.local` (non versionné) ou des secrets CI :

```bash
VITE_POSTHOG_KEY=phc_xxx            # projet PostHog (région UE conseillée)
VITE_POSTHOG_HOST=https://eu.i.posthog.com
VITE_SENTRY_DSN=https://xxx@oXXX.ingest.de.sentry.io/YYY
VITE_RELEASE=1.0.0
```

Événements envoyés : `level_start`, `level_win` (temps, chutes, étoiles, gemme), `level_quit` (chutes). Un identifiant d'installation aléatoire, aucune donnée personnelle.

## Identifiant de l'app

`com.aurelienlenoir.billeceleste` (dans `capacitor.config.ts`, `ios/` et `android/`). **À confirmer avant le premier envoi sur un store** : il ne pourra plus changer ensuite.

## Signature et publication (à faire par le propriétaire)

- **iOS** : compte Apple Developer, équipe choisie dans Xcode (*Signing & Capabilities*), puis *Product → Archive* → TestFlight.
- **Android** : créer une clé d'upload (`keytool -genkey -v -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000`), la garder hors du repo, puis *Build → Generate Signed Bundle* dans Android Studio → Play Console, test interne.
