# Bêta fermée (phase 7)

Objectif : 5 à 15 testeurs pendant 1 à 2 semaines. Critères de sortie de bêta : **plus de 80 % des testeurs terminent le monde 1**, **aucun plantage sur 7 jours**, **60 fps stables sur au moins un Android moyen de gamme**.

## 1. Avant d'inviter qui que ce soit

1. Confirmer l'identifiant de l'app (`com.aurelienlenoir.billeceleste`, voir `docs/native.md`) : il est définitif après le premier envoi.
2. Créer un projet **PostHog** (région UE) et un projet **Sentry**, puis mettre les clés dans `.env.local` (voir `docs/native.md`). Sans elles, la bêta ne remonte ni l'entonnoir ni les plantages.
3. `npm run native:sync`.

## 2. iOS : TestFlight

1. Compte Apple Developer actif. Dans App Store Connect : *Mes apps → +* avec l'identifiant ci-dessus.
2. `npx cap open ios` → *Signing & Capabilities* : choisir l'équipe → *Product → Archive* → *Distribute App → TestFlight & App Store*.
3. Dans App Store Connect → TestFlight : remplir « Informations de test » (texte ci-dessous), créer un groupe de **testeurs externes** et ajouter les e-mails (la première version passe une courte vérification d'Apple), ou un lien public.

## 3. Android : test interne Google Play

1. Play Console → *Créer une application* → remplir la fiche minimale (voir `docs/store/listing.md`).
2. Android Studio (`npx cap open android`) → *Build → Generate Signed Bundle (AAB)* avec la clé d'upload (à garder hors du repo, avec une sauvegarde).
3. *Tests → Test interne* → créer une version, envoyer l'AAB, ajouter la liste des testeurs (adresses Google) et leur partager le lien d'inscription.
4. En attendant, l'**APK de debug** de la CI (*Actions → Native builds → Artifacts*) s'installe directement sur un Android pour un premier essai.

## 4. Texte pour les testeurs

> Merci de tester Bille Céleste ! Joue comme tu veux, au doigt ou en inclinant le téléphone. Ce qui nous aide le plus : accepter les statistiques anonymes au premier lancement, et nous dire où tu as bloqué ou trouvé ça frustrant, si un niveau t'a paru injuste, et si le jeu a ralenti ou planté (avec le modèle de ton téléphone). Le menu Pause → Réglages permet de changer le contrôle et la sensibilité.

## 5. Analyser l'entonnoir

Dans PostHog, exporter les événements `level_start`, `level_win`, `level_quit` (JSON), puis :

```bash
npm run beta:funnel -- export.json
```

Le tableau donne, niveau par niveau : joueurs, joueurs qui l'ont terminé, abandons, chutes par victoire, temps médian, et la part des joueurs qui terminent le monde 1. Un niveau où beaucoup de joueurs s'arrêtent, ou qui a beaucoup d'abandons, est à rééquilibrer.

## 6. Équilibrer

| Réglage | Où | Effet |
|---|---|---|
| Temps de référence d'un niveau | `parTimeSec` dans `src/levels/data/<id>.json`, ou `npm run level:bot -- --par` pour recalculer (1,3 × le bot) | étoile « sous le temps » plus ou moins facile |
| Checkpoints | éditeur `/editor/`, puis `npm run level:validate` et `npm run level:bot` | moins de frustration après une chute |
| Sensibilité par défaut | `DEFAULT_SETTINGS` dans `src/meta/settings.ts` (`tiltRangeDeg`, `touchSensitivity`) | contrôle plus doux ou plus vif |
| Étoiles pour ouvrir un monde | `unlockStars` dans `src/levels/worlds.ts` | progression plus ou moins rapide |

Chaque changement passe par `npm test`, `level:validate` et `level:bot` (CI), puis une nouvelle version TestFlight / test interne.

## 7. Performances Android

Sur l'Android moyen de gamme de référence, ouvrir le jeu avec `?debug` (version web sur GitHub Pages) ou observer la fluidité dans l'app : le compteur affiche fps, pire image et draw calls. Si on reste sous 50 fps, la qualité baisse toute seule (ratio de pixels). Noter le modèle et les fps dans `docs/decisions.md`.
