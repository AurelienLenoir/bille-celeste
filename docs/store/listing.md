# Fiches des stores (phase 8)

Textes prêts à coller dans App Store Connect et la Play Console. Les captures se génèrent depuis le jeu :
`npm run build && npm run store:shots` → `store/screenshots/` (iPhone 6,9" 1320 × 2868 et Android 1080 × 1920, en français et en anglais).

Politique de confidentialité (hébergée par GitHub Pages) : `https://aurelienlenoir.github.io/bille-celeste/privacy.html`

> **Nom** : « Bille Céleste » est le nom de travail. Avant l'envoi, vérifier qu'il est libre sur les deux stores et qu'aucune marque proche n'est déposée (INPI, EUIPO).

## Français

**Nom** (30 car. max) : Bille Céleste

**Sous-titre App Store** (30) : Penche le ciel, guide la bille

**Description courte Google Play** (80) : Incline le monde pour guider ta bille sur des parcours suspendus dans le ciel.

**Description** :

Penche le monde, guide la bille, attrape les cristaux !

Dans Bille Céleste, tu ne contrôles pas la bille : tu inclines tout le parcours. Au gyroscope ou du bout du doigt, fais rouler ta bille sur des pistes suspendues entre les nuages, ramasse tous les cristaux pour ouvrir l'anneau d'arrivée, et file vers la sortie sans tomber.

• 20 niveaux dans 4 mondes : Jardins flottants, Coucher de soleil, Glacier céleste et Usine à nuages
• Des mécaniques à découvrir : plateformes mobiles, tremplins, glace, vent, tapis roulants, aimants, brouillard…
• Des bonus qui changent tout : ralenti, bille plume, bulle-bouclier, aimant à cristaux
• 3 étoiles par niveau et une gemme cachée à dénicher
• Un défi par jour et 12 billes à collectionner
• Contrôle au gyroscope précis et réglable, ou joystick au doigt
• Musique et sons générés pour chaque monde
• Sans compte, sans connexion obligatoire

**Mots-clés App Store** (100) : bille,labyrinthe,inclinaison,gyroscope,puzzle,adresse,arcade,cristaux,ciel,casse-tête

## English

**Name**: Bille Céleste

**App Store subtitle**: Tilt the sky, guide the ball

**Google Play short description**: Tilt the world to roll your marble across courses floating in the sky.

**Description**:

Tilt the world, guide the ball, grab the crystals!

In Bille Céleste you don't move the ball: you tilt the whole course. With your phone's gyroscope or a fingertip, roll your marble along tracks floating among the clouds, collect every crystal to open the finish ring, and race to it without falling off.

• 20 levels across 4 worlds: Floating Gardens, Sunset, Sky Glacier and Cloud Factory
• Mechanics to discover: moving platforms, springs, ice, wind, conveyors, magnets, fog…
• Game-changing pickups: slow motion, feather ball, bubble shield, crystal magnet
• 3 stars per level and a hidden gem to find
• A daily challenge and 12 balls to collect
• Precise, adjustable gyroscope control, or a touch joystick
• Music and sounds generated for each world
• No account, no connection required

**App Store keywords**: marble,maze,tilt,gyroscope,puzzle,skill,arcade,crystals,sky,ball roll

## Catégorie et classification

- Catégorie : Jeux → Arcade (secondaire : Réflexion / Puzzle).
- Public visé : 13 ans et plus (PLAN.md § 10.5, à confirmer). Pas de violence, pas de contenu généré par les joueurs, pas de chat.
- Questionnaire d'âge : réponses « Aucun » partout ; publicités : **oui** ; achats intégrés : **oui**. Résultat attendu : 4+ (Apple), PEGI 3 / Tout public (Google).

## Apple : confidentialité de l'app (étiquettes)

| Donnée | Collectée | Liée à l'identité | Pistage | Usage |
|---|---|---|---|---|
| Données de plantage | Oui (si accepté) | Non | Non | Fonctionnement de l'app |
| Interactions avec le produit | Oui (si accepté) | Non | Non | Analyse |
| Identifiant de l'appareil (IDFA) | Seulement si l'ATT est acceptée, par AdMob | Non | Oui | Publicité tierce |
| Historique d'achats | Par l'App Store / RevenueCat | Non | Non | Fonctionnement de l'app |

`PrivacyInfo.xcprivacy` est déjà dans le projet iOS ; les SDK Google et RevenueCat apportent les leurs.

## Google : formulaire « Sécurité des données »

- Données collectées : **Informations sur l'app et performances** (plantages, diagnostics), **Activité dans l'app** (interactions), **Identifiants de l'appareil** (ID publicitaire, par AdMob).
- Partagées : ID publicitaire avec Google AdMob.
- Chiffrées en transit : oui. Suppression : pas de compte, rien à supprimer côté jeu ; l'utilisateur peut réinitialiser son ID publicitaire.
- Collecte facultative : statistiques et plantages (consentement dans le jeu).
