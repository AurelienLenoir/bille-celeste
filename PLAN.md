# Bille Céleste — Plan de développement (POC → stores)

> Document de référence pour Claude Code. À placer à la racine du repo `bille-celeste`.
> Chaque phase se termine par des **critères de validation** : ne pas passer à la phase suivante tant qu'ils ne sont pas remplis.

---

## 0. Vision du jeu

- **Concept** : on incline le monde (gyroscope ou doigt) pour guider une bille sur des parcours suspendus dans le ciel. Il faut ramasser tous les cristaux pour activer l'anneau d'arrivée. Les checkpoints servent de points de réapparition en cas de chute.
- **Cible v1** : jeu mobile gratuit, iOS + Android, **20 niveaux** répartis en **4 mondes de 5 niveaux**, sans monétisation (ou presque).
- **Après la v1** : skins de bille, monnaie en jeu, boutique, pubs récompensées, achat « sans pub ».
- **Principes** :
  1. La sensation de jeu passe avant tout : une bille agréable à contrôler vaut plus que 50 niveaux.
  2. Tout est piloté par les données : niveaux, bonus/malus et skins sont décrits dans des fichiers, pas codés en dur.
  3. Tout est généré en code : géométries, matériaux, effets et sons. Aucun outil 3D manuel n'est nécessaire.

---

## 1. Choix techniques

### 1.1 Stack retenue

| Besoin | Choix | Pourquoi |
|---|---|---|
| Langage | **TypeScript (strict)** | Expertise du dev (full stack web), typage des données de niveaux |
| Build / dev | **Vite** | Démarrage instantané, test immédiat dans le navigateur du téléphone |
| Rendu 3D | **Three.js** | Déjà utilisé dans le POC, énorme écosystème, très bien connu de Claude Code |
| Physique | **Rapier** (`@dimforge/rapier3d-compat`) | Remplace cannon-es : plus rapide (WASM), détection de collision continue (CCD), meilleure gestion des colliders trimesh et des plateformes cinématiques |
| UI / menus | **Preact** + CSS (superposé au canvas) | Syntaxe React familière, très léger |
| État méta (progression, monnaie, skins) | **Zustand** | Simple, testable, indépendant du rendu |
| Validation des données | **Zod** | Les fichiers de niveaux et les sauvegardes sont validés au chargement |
| App mobile | **Capacitor** (iOS + Android) | Emballe le build web dans une vraie app native publiable sur les stores |
| Capteurs / natif | `@capacitor/motion`, `@capacitor/haptics`, `@capacitor/preferences`, `@capacitor/app`, `@capacitor/screen-orientation`, `@capacitor/splash-screen` | Gyroscope, vibrations, sauvegarde, pause en arrière-plan |
| Tests | **Vitest** (unitaires) + **Playwright** (e2e sur le build web) | Claude Code peut tout lancer et vérifier seul |
| Pubs (phase finale) | **AdMob** via `@capacitor-community/admob` + consentement **UMP** (RGPD) | Standard du marché, pubs récompensées |
| Achats (phase finale) | **RevenueCat** (`@revenuecat/purchases-capacitor`) | Un seul SDK pour l'App Store et Google Play, vérification des reçus incluse |
| Crashs / analytics | **Sentry** (crashs) + **PostHog** ou Firebase Analytics (entonnoir des niveaux) | Savoir où les joueurs abandonnent |

### 1.2 Pourquoi pas Godot ou Unity ?

- **Godot / Unity** sont plus performants pour la 3D lourde, mais une partie du travail se fait dans un éditeur graphique, que Claude Code ne pilote pas bien. Il faudrait aussi abandonner le POC.
- **Avec Three.js + Capacitor**, 100 % du projet est du code et des fichiers texte. Claude Code peut écrire, lancer, tester et vérifier chaque changement dans un navigateur, et chaque version est jouable via GitHub Pages pour les tests sur téléphone.
- **Risque connu** : les performances d'une WebView sur les Android d'entrée de gamme. On le maîtrise avec un budget de performance strict (§ 9) et un style low-poly. Si à la fin de la phase 1 on ne tient pas 60 fps sur un Android moyen de gamme, on réévalue le choix (option de repli : Godot 4).

### 1.3 Ce que Claude Code doit savoir faire seul

- `npm run dev` → jeu jouable sur `http://localhost:5173` (et sur le téléphone via l'IP locale + HTTPS de dev pour le gyroscope).
- `npm test`, `npm run test:e2e`, `npm run lint`, `npm run typecheck`.
- `npm run level:validate`, `npm run level:gen`, `npm run level:bot` (voir § 4).
- `npx cap sync` puis builds natifs (les builds iOS demandent un Mac avec Xcode).

---

## 2. Architecture du code

```
bille-celeste/
├─ CLAUDE.md                  # règles du projet pour Claude Code
├─ PLAN.md                    # ce document
├─ index.html
├─ src/
│  ├─ main.ts                 # bootstrap : renderer, physique, UI, boucle
│  ├─ engine/                 # technique, sans logique de jeu
│  │  ├─ loop.ts              # boucle à pas fixe (physique 120 Hz) + interpolation du rendu
│  │  ├─ physics.ts           # wrapper Rapier (création des corps, des capteurs, des événements)
│  │  ├─ renderer.ts          # Three.js, lumières, ombres, réglages qualité
│  │  ├─ camera.ts            # caméra qui suit la bille + inclinaison visuelle
│  │  ├─ input/
│  │  │  ├─ tilt.ts           # gyroscope : calibration, filtre passe-bas, zone morte, courbe de réponse
│  │  │  ├─ touch.ts          # joystick virtuel
│  │  │  └─ keyboard.ts       # debug sur ordinateur
│  │  ├─ audio.ts             # Web Audio, effets sonores générés + musique
│  │  └─ haptics.ts           # vibrations (natif via Capacitor, sinon rien)
│  ├─ game/                   # logique de jeu
│  │  ├─ world.ts             # assemble un niveau à partir de ses données
│  │  ├─ ball.ts              # bille : corps physique, état (bouclier, aimant…), skin
│  │  ├─ pieces/              # pièces du parcours (voir § 3.2), une par fichier
│  │  ├─ entities/            # cristal, checkpoint, arrivée, étoile cachée
│  │  ├─ modifiers/           # bonus et malus (voir § 5), un par fichier
│  │  ├─ rules.ts             # victoire, défaite, chutes, chrono, calcul des étoiles
│  │  └─ events.ts            # bus d'événements typé (crystalCollected, fell, levelWon…)
│  ├─ levels/
│  │  ├─ schema.ts            # schéma Zod d'un niveau (source de vérité)
│  │  ├─ loader.ts
│  │  ├─ data/                # w1-01.json … w4-05.json
│  │  └─ worlds.ts            # définition des mondes (thème, ordre, déblocage)
│  ├─ meta/                   # tout ce qui dépasse une partie
│  │  ├─ store.ts             # Zustand : progression, étoiles, monnaie, skins, réglages
│  │  ├─ save.ts              # sauvegarde versionnée + migrations
│  │  └─ skins.ts             # catalogue de skins (phase 9)
│  ├─ ui/                     # Preact : écrans et HUD
│  │  ├─ screens/             # Titre, Carte des mondes, Sélection niveau, Pause, Victoire, Réglages, Boutique
│  │  └─ hud/
│  ├─ art/                    # génération procédurale des visuels
│  │  ├─ palette.ts           # couleurs par monde
│  │  ├─ textures.ts          # textures canvas (damiers, rayures, bruit)
│  │  ├─ materials.ts
│  │  └─ decor.ts             # îles, nuages, arrière-plans par monde
│  └─ platform/               # adaptateurs natif / web
│     ├─ index.ts             # détecte Capacitor ou le navigateur
│     ├─ motion.ts
│     ├─ storage.ts
│     ├─ ads.ts               # phase 9
│     └─ purchases.ts         # phase 9
├─ tools/
│  ├─ level-editor/           # éditeur web de niveaux (route /editor, dev uniquement)
│  ├─ level-gen.ts            # générateur procédural (CLI)
│  ├─ level-validate.ts       # validation statique de tous les niveaux
│  └─ level-bot.ts            # bot qui rejoue les niveaux (voir § 4.4)
├─ tests/                     # Vitest + Playwright
├─ ios/  android/             # générés par Capacitor
└─ .github/workflows/         # CI : lint, tests, build, déploiement GitHub Pages
```

### 2.1 Règles d'architecture

- **`engine/` ne connaît pas `game/`** : le moteur ne sait rien des cristaux ni des niveaux.
- **`game/` ne touche pas au DOM** : l'UI écoute les événements de `events.ts` et lit le store.
- **`platform/` est le seul endroit qui importe Capacitor**. Le jeu fonctionne à l'identique dans un navigateur, ce qui est indispensable pour les tests et pour GitHub Pages.
- **Boucle à pas fixe** : la physique tourne à 120 Hz, le rendu interpole entre deux états. Résultat : comportement identique quel que soit le téléphone, et des replays possibles pour le bot.
- **Déterminisme** : l'entrée est lue une fois par pas physique. Un replay (graine + suite d'entrées) doit redonner exactement la même partie.
- **Pas d'ECS complet** : des entités simples avec `create(world)`, `update(dt)` et `dispose()`, ça suffit pour ce jeu.

### 2.2 L'astuce de l'inclinaison (à conserver)

On ne fait jamais tourner le parcours physiquement. On fait tourner le **vecteur gravité** selon l'inclinaison, et la **caméra** (son vecteur « haut ») dans le même sens. Le joueur voit le monde pencher, tandis que les colliders restent statiques et stables.

---

## 3. Format des niveaux

### 3.1 Principe : une grille de pièces modulaires

Un niveau est un fichier JSON qui liste des **pièces** posées sur une grille 3D (cases de 2 × 2 unités, hauteur par pas de 0,5), avec une rotation (0/90/180/270°) et des paramètres optionnels.

```json
{
  "id": "w2-03",
  "version": 1,
  "name": "Le grand toboggan",
  "world": 2,
  "parTimeSec": 55,
  "spawn": { "cell": [0, 0, 0] },
  "pieces": [
    { "type": "platform", "cell": [0, 0, 0], "size": [3, 3] },
    { "type": "straight", "cell": [0, 0, -2], "length": 4, "width": "normal" },
    { "type": "curve", "cell": [0, 0, -6], "rot": 90, "radius": 2 },
    { "type": "ramp", "cell": [2, 0, -6], "rot": 90, "length": 3, "drop": 2 },
    { "type": "movingPlatform", "cell": [6, -2, -6], "path": [[6,-2,-6],[10,-2,-6]], "speed": 2, "pause": 1 }
  ],
  "entities": [
    { "type": "crystal", "cell": [0, 0, -4] },
    { "type": "checkpoint", "cell": [2, 0, -6] },
    { "type": "hiddenGem", "cell": [9, -2, -8] },
    { "type": "goal", "cell": [12, -2, -6] }
  ],
  "modifiers": [
    { "type": "speedPad", "cell": [0, 0, -3], "rot": 0 },
    { "type": "iceZone", "cell": [4, -1, -6], "size": [2, 1] }
  ],
  "decor": { "theme": "sunset", "seed": 1234 }
}
```

- **`schema.ts` (Zod) est la source de vérité.** Le type TypeScript en est dérivé, et l'éditeur et le générateur l'utilisent.
- Le champ **`version`** permet de faire évoluer le format avec des migrations, sans casser les anciens niveaux.

### 3.2 Bibliothèque de pièces (v1)

| Pièce | Paramètres | Rôle |
|---|---|---|
| `platform` | taille | Zones de repos, checkpoints |
| `straight` | longueur, largeur (`wide` / `normal` / `narrow` / `rail`) | Couloirs ; la largeur règle la difficulté |
| `curve` | rayon, angle | Virages |
| `ramp` | longueur, dénivelé | Montées / descentes |
| `halfPipe` | longueur | Demi-tube, pardonne les erreurs |
| `funnel` | diamètre | Entonnoir vers un passage |
| `bridge` | longueur | Pont étroit sans rebords |
| `gap` | longueur | Trou à franchir avec un tremplin |
| `wall` / `rail` | longueur, hauteur | Rebords |
| `stairs` | nombre de marches | Marches à descendre |
| `movingPlatform` | trajet, vitesse, pause | Timing |
| `rotatingPlatform` | vitesse angulaire | Plateau tournant |
| `fallingTile` | délai | Dalle qui tombe après le passage |
| `seesaw` | — | Bascule (corps dynamique articulé) |

Chaque pièce est un module qui fournit `build(params) → { meshes, colliders }`. Pour éviter que la bille « accroche » aux jointures, **toutes les surfaces statiques d'un niveau sont fusionnées en un seul collider trimesh** au chargement, en activant l'option de Rapier qui corrige les arêtes internes (`FIX_INTERNAL_EDGES`, à vérifier dans la version utilisée). Le rendu est fusionné lui aussi, pour limiter les draw calls.

### 3.3 Mondes (v1)

| Monde | Thème | Mécanique introduite | Niveaux |
|---|---|---|---|
| 1. Jardins flottants | Pastel, verdure | Bases : inclinaison, cristaux, checkpoints, rampes | w1-01 → w1-05 (didacticiel intégré aux 2 premiers) |
| 2. Coucher de soleil | Orange / rose | Plateformes mobiles, pads de vitesse, tremplins | w2-01 → w2-05 |
| 3. Glacier céleste | Bleu glacé | Glace, vent, dalles qui tombent | w3-01 → w3-05 |
| 4. Usine à nuages | Métal pastel, nuit | Tapis roulants, pousseurs, aimants, inversion | w4-01 → w4-05 |

Chaque monde suit la même logique : **introduire** la mécanique en sécurité, la **combiner** avec une autre, puis la **mettre à l'épreuve** dans le 5e niveau.

---

## 4. Créer les niveaux facilement

Quatre outils se complètent :

### 4.1 Éditeur de niveaux web (`/editor`, uniquement en dev)
- Vue de dessus en grille plus aperçu 3D. On choisit une pièce dans une palette, on clique pour la poser, et on la tourne avec R.
- Bouton **Jouer** pour tester instantanément, et **Exporter** pour obtenir le JSON validé par le schéma.
- Annuler / rétablir, et duplication de sélection.
- C'est l'outil pour retoucher à la main un niveau généré.

### 4.2 Générateur procédural (`npm run level:gen -- --world 3 --difficulty 0.6 --seed 42`)
- Il construit un chemin principal par marche aléatoire contrainte sur la grille : pas d'auto-intersection, dénivelé borné.
- Il habille ce chemin avec des pièces tirées selon la difficulté (largeur moyenne, proportion de ponts et de trous, nombre de malus).
- Il place les cristaux le long du chemin, dont certains sur de petites branches optionnelles, avec un checkpoint environ tous les 25 % du parcours.
- Il produit un **brouillon** : on garde les bons, on retouche dans l'éditeur. Il ne remplace pas le level design.

### 4.3 Validateur statique (`npm run level:validate`)
Il échoue si l'un de ces points n'est pas respecté :
- schéma Zod valide, identifiants uniques ;
- graphe de connectivité : départ → tous les cristaux → arrivée atteignables (en tenant compte des pièces mobiles et des tremplins) ;
- aucun cristal dans un mur ou sous une surface ;
- au moins un checkpoint si le parcours dépasse une certaine longueur ;
- budget de pièces et de draw calls respecté.

### 4.4 Bot de test (`npm run level:bot`)
- Un pilote automatique suit le chemin calculé (asservissement de l'inclinaison vers le point suivant). Il tourne **sans rendu**, en accéléré.
- Il fournit pour chaque niveau : terminé ou non, temps, nombre de chutes. Ça sert à repérer les niveaux impossibles ou cassés après un changement de physique.
- Les **replays** enregistrés par le designer (graine + entrées) servent de tests de non-régression : chaque replay doit toujours terminer le niveau.

> **Claude Code peut aussi écrire les niveaux directement en JSON** à partir d'une description (« un niveau du monde 3 avec une longue descente glacée et du vent latéral »), puis les faire passer au validateur et au bot.

---

## 5. Bonus, malus et éléments vivants

Chaque modificateur est un module `modifiers/<nom>.ts` qui implémente :
`create(world, data)`, `onBallEnter(ball)`, `onBallExit(ball)`, `update(dt)` et `dispose()`.
Il est déclenché par un **capteur** Rapier (zone sans collision physique). Il ajoute au besoin un effet visuel (particules, couleur) et un son.

### 5.1 Bonus (positifs)
| Bonus | Effet | Durée |
|---|---|---|
| Pad de vitesse | Impulsion dans une direction | Instantané |
| Tremplin / ressort | Saut vertical ou en arc | Instantané |
| Aimant | Attire les cristaux dans un rayon de 4 unités | 8 s |
| Bulle-bouclier | Annule la prochaine chute (réapparition sur place) | Jusqu'à usage |
| Ralenti | Temps du jeu × 0,6 (pas le chrono) | 5 s |
| Sablier | −5 s sur le chrono | Instantané |
| Bille plume | Gravité réduite, sauts plus longs | 6 s |

### 5.2 Malus (obstacles)
| Malus | Effet |
|---|---|
| Glace | Friction quasi nulle |
| Sable / boue | Forte friction, bille lente |
| Zone de vent | Force latérale constante ou en rafales (indiquée visuellement) |
| Tapis roulant | Entraîne la bille |
| Pousseur / marteau | Obstacle cinématique qui frappe en rythme |
| Barre tournante | Balaie une plateforme |
| Bumper | Repousse fortement (rebond) |
| Bille lourde | Gravité × 1,5, inclinaison moins efficace |
| Zone inversée | Contrôles inversés tant qu'on est dedans |
| Brouillard | Visibilité réduite (monde 4) |

### 5.3 Collectibles et notation
- **Cristaux** : obligatoires pour ouvrir l'arrivée.
- **Gemme cachée** (une par niveau, hors du chemin principal) : donne de la monnaie et pousse à l'exploration.
- **3 étoiles** par niveau : ★ terminer, ★★ sous le temps de référence, ★★★ sans tomber. Les étoiles débloquent les mondes suivants (par exemple 10 étoiles pour le monde 2).

### 5.4 Ressenti (« juice »)
- Une vibration à chaque événement : cristal (légère), checkpoint (moyenne), chute (forte), victoire (motif).
- Particules à la collecte, traînée de la bille à grande vitesse, légère secousse de caméra sur un bumper.
- Son de roulement qui varie selon la vitesse et la surface (bois, glace, métal).
- Ralenti de 0,3 s au passage de l'anneau d'arrivée.

---

## 6. Contrôles (priorité n°1)

- **Gyroscope** :
  - calibration de la position neutre au démarrage du niveau, avec un bouton « Recalibrer » dans le menu pause ;
  - filtre passe-bas et zone morte ;
  - **courbe de réponse** non linéaire (précis au centre, rapide aux extrêmes) ;
  - angle maximum réglable ;
  - fonctionne en portrait et en paysage.
- **Tactile** : joystick virtuel qui apparaît sous le pouce (comme dans le POC), avec un réglage de sensibilité.
- **Réglages** : sensibilité, inversion des axes, mode de contrôle, retour haptique, son, musique.
- **Pause automatique** quand l'app passe en arrière-plan ou que le téléphone se met en veille.

---

## 7. Graphismes et sons (entièrement générés)

L'utilisateur ne fait pas de 3D. **Tous les assets sont produits par du code** :

1. **Géométrie procédurale** dans `pieces/` et `art/decor.ts` : formes low-poly, biseaux sur les bords des pistes, ombres douces. C'est la voie principale.
2. **Scripts Blender en Python** (optionnel, pour quelques objets plus complexes : arche d'arrivée, mascotte du menu, décor de fond). Claude Code écrit `tools/blender/*.py`, les exécute en mode `blender --background --python script.py` et exporte des `.glb` compressés (meshopt) dans `public/models/`. Il suffit que Blender soit installé ; personne n'a à l'ouvrir.
3. **Textures** générées sur canvas (damiers, rayures, bruit) ou en shader. Pas d'images externes.
4. **Skins de bille** : un skin = matériau + motif procédural + couleur de traînée + effet de particules (§ 10).
5. **Effets sonores** générés (synthèse Web Audio, ou presets façon sfxr exportés en `.ogg`).
6. **Musique** : à choisir dans une banque libre de droits avec licence commerciale (à valider par l'utilisateur), une piste par monde, en boucle.
7. **Icône et captures des stores** : générées depuis le jeu (mode « photo » avec caméra scriptée).

Direction artistique : low-poly pastel, couleurs franches par monde, ciel en dégradé, îles flottantes. C'est un univers original, sans aucun élément repris de Kororinpa.

---

## 8. Phases de développement

### Phase 0 — Mise en place (½ à 1 jour)
- Migrer le POC vers Vite + TypeScript strict + l'arborescence du § 2.
- ESLint + Prettier, Vitest, Playwright, scripts npm.
- CI GitHub Actions : lint + typecheck + tests + build, puis déploiement sur GitHub Pages à chaque push sur `master`, pour tester sur téléphone.
- **Validation** : le niveau du POC tourne à l'identique, la CI est verte et la page GitHub Pages est jouable.

### Phase 1 — Cœur du jeu et sensation (3 à 5 jours)
- Remplacer cannon-es par Rapier, avec la boucle à pas fixe et l'interpolation.
- Module d'entrée complet (§ 6), caméra lissée, réapparition, chrono, chutes.
- Collider trimesh fusionné (fin des accrocs aux jointures).
- Menu pause, réglages de base.
- **Validation** : 60 fps stables sur un Android moyen de gamme et un iPhone. Aucun accroc sur un parcours de 30 pièces. Le joueur trouve le contrôle « agréable » (validation manuelle de l'utilisateur).

### Phase 2 — Système de niveaux (3 à 4 jours)
- Schéma Zod, loader, bibliothèque de pièces v1 (§ 3.2).
- Validateur, puis éditeur web, puis générateur, puis bot.
- **Validation** : le niveau du POC est réécrit en JSON. Un niveau généré passe le validateur et le bot. L'éditeur permet de créer, tester et exporter un niveau en moins de 10 minutes.

### Phase 3 — Bonus et malus (3 à 4 jours)
- Système de modificateurs + les 7 bonus et 10 malus du § 5, chacun avec visuel, son, vibration et test unitaire.
- Gemme cachée et calcul des étoiles.
- **Validation** : un niveau « bac à sable » contient chaque modificateur, et le bot le termine.

### Phase 4 — Contenu et progression (5 à 8 jours)
- Les 4 mondes et 20 niveaux (générés puis retouchés), avec la courbe de difficulté du § 3.3.
- Écrans : titre, carte des mondes, sélection de niveau (étoiles), victoire (temps, étoiles, record), réglages.
- Sauvegarde versionnée (progression, records, réglages) avec migrations testées.
- Didacticiel intégré aux niveaux w1-01 et w1-02 (panneaux dans le décor, pas de pop-ups).
- **Validation** : partie complète du niveau 1 au niveau 20 sans bug. Tous les niveaux passent le validateur et le bot. Le temps de référence de chaque niveau est calibré.

### Phase 5 — Habillage (3 à 5 jours)
- Thème visuel par monde, décor procédural, particules, traînée, effets du § 5.4.
- Sons et musique, mixage, réglages de volume.
- Écran de chargement, transitions entre écrans.
- **Validation** : le budget de performance (§ 9) est toujours respecté après l'habillage.

### Phase 6 — Applications natives (2 à 3 jours)
- Capacitor : projets iOS et Android, icônes, splash screen, orientation verrouillée en portrait, écran maintenu allumé pendant le jeu, zones sûres (encoche).
- Gyroscope via `@capacitor/motion` (avec demande d'autorisation sur iOS), vibrations natives, sauvegarde native.
- Sentry pour les crashs, analytics minimales : début, victoire et abandon de niveau, nombre de chutes. Avec consentement.
- **Validation** : l'app installée sur un vrai iPhone et un vrai Android se comporte comme la version web, et la pause en arrière-plan fonctionne.

### Phase 7 — Bêta fermée (1 à 2 semaines, en parallèle)
- TestFlight (iOS) et test interne Google Play.
- 5 à 15 testeurs, analyse de l'entonnoir : quel niveau fait abandonner ?
- Équilibrage : temps de référence, placement des checkpoints, sensibilité par défaut.
- **Validation** : plus de 80 % des testeurs terminent le monde 1, et aucun crash sur 7 jours. 60 fps stables sur au moins un Android moyen de gamme (test reporté de la phase 1).

### Phase 8 — Sortie v1 (2 à 3 jours)
- Fiches des stores : nom, description FR + EN, captures générées, vidéo courte (optionnelle).
- Politique de confidentialité hébergée (GitHub Pages), classification d'âge, formulaire de sécurité des données (Google), « privacy manifest » et étiquettes de confidentialité (Apple).
- Localisation de l'interface en FR + EN (fichiers i18n dès la phase 4).
- **Validation** : app acceptée sur les deux stores.

### Phase 9 — Monétisation et skins (après la v1, quand le jeu fonctionne bien)
Voir § 10.

> Les durées sont indicatives, pour un développement en side project avec Claude Code.

---

## 9. Budget de performance (non négociable)

- **60 fps** sur un Android moyen de gamme de 3 ou 4 ans (appareil de référence à définir) et sur un iPhone récent.
- **Moins de 80 draw calls** par image : géométries fusionnées, `InstancedMesh` pour les cristaux et le décor.
- **Une seule ombre dynamique** (soleil qui suit la bille), carte d'ombre de 1024 px maximum.
- Ratio de pixels plafonné à 2. Mode « qualité basse » automatique si on reste sous 50 fps pendant 3 s.
- Chargement d'un niveau en moins de 500 ms, taille de l'app (build web) sous 15 Mo hors musique.
- Mesure dans la CI : un test Playwright enregistre le temps par image d'un niveau de référence et échoue en cas de régression.

---

## 10. Phase 9 — Skins, boutique, pubs

### 10.1 Économie
- **Monnaie unique** (« plumes », par exemple) gagnée avec les gemmes cachées, les étoiles et les défis quotidiens.
- Pas de monnaie premium séparée au début : un seul type de monnaie, et un achat intégré « pack de plumes ».

### 10.2 Skins
- Catalogue en données (`skins.ts`) : id, nom, rareté, prix, matériau, motif, traînée, particules, son de roulement (optionnel).
- Les skins sont **purement esthétiques** : aucun avantage de gameplay.
- Écran Boutique avec aperçu 3D de la bille qui tourne, et écran Collection.

### 10.3 Pubs (AdMob)
- **Récompensées uniquement, au choix du joueur** :
  - « Continuer ici » après une chute, pour éviter le retour au checkpoint (une fois par niveau) ;
  - « Doubler les plumes » sur l'écran de victoire.
- **Interstitielles** : au maximum une toutes les 3 à 4 victoires, jamais pendant une partie, jamais dans les 5 premiers niveaux.
- **Achat « Sans pub »** : supprime les interstitielles, et les pubs récompensées deviennent des récompenses gratuites.
- **Consentement obligatoire** : formulaire UMP (RGPD, Europe) avant toute pub. Sur iOS, demande ATT avant les pubs personnalisées. Le jeu doit fonctionner normalement en cas de refus.

### 10.4 Achats intégrés (RevenueCat)
- Produits : « Sans pub » (non consommable), packs de plumes (consommables), éventuellement des packs de skins.
- Bouton « Restaurer les achats » (exigé par Apple).
- Tests en environnement sandbox sur les deux stores avant publication.

### 10.5 Point d'attention : public enfant
Un jeu de bille coloré attire les enfants. Si le jeu est déclaré comme destiné aux moins de 13 ans, les règles sur les pubs et les données deviennent beaucoup plus strictes (programme « Familles » de Google, catégorie Enfants d'Apple). **Décision à prendre avant la phase 8** : viser un public général (13 ans et plus), ou adapter les pubs (contenu certifié pour les familles, pas de personnalisation).

---

## 11. Ce dont le projet a besoin (côté humain)

| Élément | Quand | Remarque |
|---|---|---|
| Mac avec Xcode | Phase 6 | Obligatoire pour compiler et publier sur iOS |
| Android Studio | Phase 6 | Builds Android |
| Compte Apple Developer | Phase 7 | Abonnement annuel |
| Compte Google Play Console | Phase 7 | Déjà disponible |
| Un iPhone et un Android de test (moyen de gamme si possible) | Dès la phase 1 | Pour le ressenti et les performances |
| Nom définitif du jeu | Avant la phase 8 | Vérifier qu'il est libre sur les stores et que la marque n'est pas déposée |
| Validation du ressenti des contrôles | Fin de la phase 1 | Seul un humain peut juger |
| Choix des musiques (licence commerciale) | Phase 5 | Banque libre de droits |
| Politique de confidentialité | Phase 8 | Claude Code peut la rédiger, à faire relire |
| Comptes AdMob et RevenueCat | Phase 9 | Gratuits à l'ouverture |
| Accès en écriture de Claude au repo GitHub | Dès la phase 0 | Via Claude Code en local, ou l'app Claude GitHub installée sur le repo |

---

## 12. Façon de travailler avec Claude Code

1. **Une phase à la fois.** Demander : « Lis PLAN.md et CLAUDE.md, puis réalise la phase N. Propose d'abord un découpage en tâches. »
2. **Une branche par phase** (`phase-1-core`, …), une PR, la CI doit être verte, puis on fusionne dans `master`. GitHub Pages se met à jour et on teste sur téléphone.
3. **Après chaque phase**, Claude Code met à jour la section « État d'avancement » ci-dessous et note les décisions prises dans `docs/decisions.md`.
4. **Pour un nouveau niveau** : « Crée le niveau w3-04 : [description]. Fais-le passer au validateur et au bot. »
5. **Pour un nouveau modificateur** : « Ajoute le malus X dans modifiers/, avec visuel, son, haptique, test, et un niveau bac à sable. »

---

## 13. État d'avancement

- [x] POC jouable (Three.js + cannon-es, 1 niveau, gyroscope + tactile) — `index.html`
- [x] Phase 0 — Mise en place (Vite + TS strict, ESLint/Prettier, Vitest, Playwright, CI + GitHub Pages ; reste à valider : CI verte et page Pages jouable)
- [x] Phase 1 — Cœur du jeu et sensation (Rapier, pas fixe 120 Hz + interpolation, collider trimesh fusionné, entrées complètes, caméra lissée, pause, réglages sauvegardés, mesure des fps. Validé par l'utilisateur sur iPhone : 60 fps stables, contrôle au doigt et au gyroscope agréables. Test Android reporté à la phase 7)
- [ ] Phase 2 — Système de niveaux (code terminé : format v1 validé par Zod avec migrations, 14 pièces sur grille (une par fichier, testées), collider et rendu fusionnés, validateur statique, graphe de navigation, bot et replays, générateur procédural, éditeur web sur `/editor/`. Le niveau du POC est en JSON, un niveau généré passe le validateur et le bot, et le test e2e de l'éditeur crée, teste, joue et exporte un niveau. Reste la validation par l'utilisateur : créer un niveau dans l'éditeur en moins de 10 minutes)
- [ ] Phase 3 — Bonus et malus (code terminé : format de niveau v2 avec migration, système de modificateurs sur capteurs Rapier, 7 bonus et 10 malus (un par fichier, chacun avec visuel, son, vibration et test), gemme cachée, étoiles (fin, temps de référence, sans chute), éditeur, générateur et validateur. Le niveau `sandbox` contient tous les modificateurs et le bot le termine, son replay est enregistré. Reste la validation par l'utilisateur sur téléphone : `?level=sandbox`)
- [ ] Phase 4 — Contenu et progression (20 niveaux)
- [ ] Phase 5 — Habillage
- [ ] Phase 6 — Applications natives
- [ ] Phase 7 — Bêta fermée
- [ ] Phase 8 — Sortie v1
- [ ] Phase 9 — Skins, boutique, pubs
