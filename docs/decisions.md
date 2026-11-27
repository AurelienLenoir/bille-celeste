# Décisions

Journal des choix structurants (le plus récent en haut).

## 2026-11-27 — Phase 4 : retours du premier test sur téléphone

- **Checkpoints** : un drapeau se déclenche dès que la bille roule n'importe où sur sa plateforme 3 × 3 (avant : à moins de 2,6 unités du centre, si bien qu'on le ratait en coupant le virage et que le drapeau restait gris).
- **Cristaux remis en place** : les cristaux (et la gemme) ramassés depuis le dernier checkpoint reviennent quand la bille tombe, et le compteur redescend (événement `crystalsPutBack`). Le bouclier, qui évite la chute, ne les remet pas. Le replay e2e a été mis à jour pour ça (le premier cristal revient après la première chute), la physique ne change pas.
- **Chrono** : il démarre au premier mouvement du joueur (première entrée non nulle), pas à l'apparition de la bille.
- **Minimap** (`ui/hud/minimap.ts`) : ajoutée maintenant à la demande de l'utilisateur, elle n'était pas prévue dans le plan. Canvas 2D en haut à gauche, vue de dessus avec le fond du niveau en haut comme la caméra. Le parcours est dessiné une fois par niveau ; les cristaux restants, les checkpoints (verts une fois passés), l'arrivée (dorée une fois ouverte) et la bille sont redessinés environ 20 fois par seconde. La gemme cachée n'y est pas.
- **Orientation** : sur un téléphone en paysage, un écran sombre demande de le remettre en portrait et met la partie en pause. Le verrouillage natif de l'orientation viendra avec Capacitor en phase 6.
- **Gyroscope** : la position neutre est gardée pour chaque orientation de l'écran. Hypothèse sur la dérive vue sur iPhone : la page pivotait brièvement en paysage, ce qui remplaçait la position neutre par celle du téléphone au moment du retour en portrait.
- **Générateur** : jamais deux checkpoints rapprochés (au moins 22 % de la longueur du niveau, 12 cases minimum, entre deux ; un saut ou un bac qui vient d'en donner un saute le repos prévu). Plus de branche latérale avec un cristal : la seule branche est celle de la gemme cachée, et tous les cristaux sont sur le parcours (un sur l'élan des sauts, un sur le quai des bacs). Pistes un peu plus étroites, moins de rambardes et un malus de plus par niveau.
- **Campagne régénérée** (niveaux 3 à 20) avec une courbe plus dure : difficulté 0,28 à 0,5 dans le monde 1, 0,4 à 0,75 dans le 2, 0,55 à 0,86 dans le 3, 0,65 à 1 dans le 4. Le bot les termine tous sans chute et les temps de référence sont recalibrés. Les retouches manuelles de la première version (pads de `w2-03`, etc.) ne sont pas reprises : les nouveaux tirages tiennent dans le budget de draw calls sans retouche.

## 2026-11-27 — Phase 4 : contenu et progression

- **Campagne** (`levels/worlds.ts`) : 4 mondes de 5 niveaux, `w1-01` à `w4-05`. Le monde 2 s'ouvre à 10 étoiles, le 3 à 22, le 4 à 35 (sur 15, 30 et 45 possibles avant chacun). Dans un monde, un niveau s'ouvre quand le précédent est terminé. `?unlock` ouvre tout, pour tester.
- **Étoiles cumulées** : chaque étoile (terminé, sous le temps de référence, sans chute) est gagnée une fois pour toutes, même sur des parties différentes. Le record est le meilleur temps d'une partie gagnée. Plus simple à comprendre pour un joueur qu'une note « meilleure partie ».
- **Niveaux** : `w1-01` et `w1-02` sont écrits à la main (didacticiel). Les 18 autres sont générés avec une nouvelle option `focus` du générateur (`--focus ice,tiles`), qui fait revenir environ 4 fois plus souvent les mécaniques que le niveau introduit, puis la meilleure graine sur 40 est retenue (validateur, bot sans chute, mécaniques présentes, gemme). Retouches : noms, pads de vitesse ajoutés (`w2-03`), seconde zone inversée (`w4-04`), rebondisseur (`w4-05`), et éléments retirés là où l'estimation des draw calls dépassait 80 (bras rotatif de `w4-02`, aimant de `w4-05`). Le bras rotatif n'est donc dans aucun niveau de la campagne pour l'instant ; il reste dans le `sandbox`.
- **Courbe** : difficulté du générateur de 0,12 à 0,4 dans le monde 1, 0,2 à 0,65 dans le 2, 0,32 à 0,72 dans le 3, 0,45 à 0,85 dans le 4. Chaque monde présente sa mécanique dans le niveau 1, la combine ensuite, et le niveau 5 met tout à l'épreuve (§ 3.3).
- **Gemme cachée** : le générateur la pose au bout de la première branche latérale qui tient (avant, il n'en posait pas). Chaque niveau de la campagne en a une.
- **Temps de référence calibrés** : `npm run level:bot -- --par` réécrit le temps de chaque niveau de la campagne à 1,3 × le temps du bot, arrondi aux 5 s (règle de la phase 2). Les niveaux hors campagne (`poc`, `pieces`, `sandbox`) gardent le leur.
- **Format de niveau v3** : champ `signs` (au plus 8 panneaux : case, orientation, texte FR et EN), avec migration v2 → v3 testée. Les panneaux flottent au-dessus de la piste, sans collision, et s'effacent quand la bille passe dessous (la caméra regarderait à travers). Ils comptent dans l'estimation des draw calls. Pas encore d'outil pour les poser dans l'éditeur : ils s'écrivent dans le JSON et l'éditeur les conserve.
- **Réglages v2** : ajout de la langue (`auto`, `fr`, `en`), migration v1 → v2 testée (`auto` pour les joueurs existants). `auto` choisit le français sur un appareil en français, l'anglais sinon.
- **Sauvegarde de la progression** (`meta/progress.ts`, clé `bille-celeste.progress`, version 1) : meilleur temps, étoiles et gemme par niveau terminé. Un niveau illisible est ignoré sans perdre les autres. Les deux formats (réglages, progression) passent par le même lecteur versionné (`meta/save.ts`).
- **i18n** : `i18n/fr.ts` (référence) et `i18n/en.ts` (même forme, vérifiée par un test). Les tests e2e tournent en `fr-FR`.
- **Écrans en Preact** (`ui/screens/*.tsx`) : titre, carte des mondes, choix des niveaux (étoiles, record, gemme), pause (avec « Quitter le niveau »), victoire (temps, étoiles, record, niveau suivant, monde ouvert), réglages. Un petit store Zustand (`ui/state.ts`) dit quel écran est affiché. Le HUD reste en DOM simple.
- **Changement de niveau sans recharger la page** (`game/stage.ts`) : chaque niveau est construit dans son propre groupe Three.js et son propre monde Rapier, et tout est libéré en le quittant. Derrière les menus, le niveau en cours est affiché, immobile (les entrées sont ignorées hors partie). Le ciel et la brume prennent la couleur du monde ; le reste de l'habillage reste pour la phase 5.
- **`?level=<id>`** mène toujours directement à ce niveau depuis l'écran titre (éditeur, `sandbox`, tests).

## 2026-11-27 — Phase 3 : validation sur téléphone

- **Phase 3 validée** par l'utilisateur sur iPhone avec le niveau `sandbox`.
- **Tapis roulant renforcé**, jugé trop faible : il rattrape sa vitesse plus vite (5/s au lieu de 3/s) et tire plus fort (7 au lieu de 4,5 unités/s², toujours sous l'inclinaison maximale, donc on peut encore lutter contre). Vitesse par défaut 4 au lieu de 3, 4 dans le `sandbox` (au lieu de 2,5), 2,5 à 4,5 dans le générateur selon la difficulté. Le replay du `sandbox` est réenregistré ; le bot gagne les 30 niveaux générés testés qui ont un tapis.

## 2026-11-27 — Phase 3 : bonus et malus

- **Format de niveau v2** : champ `modifiers` (au plus 60), une union Zod discriminée par `type` avec les réglages propres à chaque modificateur et des valeurs par défaut. La migration v1 → v2 ajoute une liste vide ; elle est testée.
- **Déclenchement par capteurs Rapier** : chaque modificateur à zone ou à ramassage a un collider capteur (boîte ou sphère), interrogé avec `intersectionPair` après chaque pas. Entrée, sortie et « dedans » sont donc calculés au pas fixe, ce qui garde les parties déterministes et rejouables.
- **Effets appliqués à chaque pas** plutôt qu'en modifiant les corps : adhérence (frottement avec la règle `Min` et amortissement en plus, pour la glace et le sable), poussée (vent, tapis) ajoutée à la vitesse, échelle de gravité (plume, bille lourde), inversion des commandes appliquée avant le lissage, brouillard. Sans modificateur, rien ne change : le replay du POC est identique au bit près.
- **Durées fixes** : aimant 8 s, ralenti 5 s, plume et bille lourde 6 s, bulle jusqu'à son usage. Plume et bille lourde s'annulent. Les durées sont comptées en temps du chrono.
- **Ralenti** : le pas physique est multiplié par 0,6, mais le chrono avance normalement. Le ralenti aide à passer un obstacle, pas à gagner du temps (c'est le rôle du sablier, −5 s).
- **Bulle** : la bille garde une trace des points où elle touchait le sol. À la chute, elle repart du point d'il y a 0,5 s au lieu du dernier checkpoint, et la chute ne compte pas.
- **Bot** : chaque obstacle mobile (pousseur, bras rotatif) expose sa zone et un test « touche à l'instant t ». Le pilote s'arrête avant la zone jusqu'à ce que la traversée soit sûre, puis s'engage sans revenir en arrière. Il compense la poussée des zones et l'inversion des commandes. La navigation évite les cases pleines (poteau du rebondisseur, axe du bras) et pénalise les cases dangereuses.
- **Générateur** : les modificateurs arrivent par monde (1 : sablier, bulle · 2 : pad, ressort, sable · 3 : ralenti, plume, glace, vent · 4 : aimant, tapis, pousseur, inversion, bille lourde, brouillard). Le bras rotatif et le rebondisseur ne sont pas générés : ils demandent un placement à la main. 96 niveaux générés sur 96 sont gagnés par le bot.
- **Validateur** : modificateur hors du parcours (erreur), boîtier de pousseur sur une case occupée (erreur), ressort qui atterrit dans le vide (erreur), bonus inaccessible, deux modificateurs sur une case, ressort sur un cristal (avertissements). L'estimation des draw calls compte les modificateurs et la gemme.
- **Draw calls** : les zones sont des décalques à couleurs par sommet qui suivent le sol (un maillage par zone), les objets à ramasser ne projettent pas d'ombre. Le niveau `sandbox`, avec ses 17 modificateurs, reste sous le budget de 80 selon l'estimation du validateur.
- **`?bot`** dans l'URL fait jouer le niveau par le pilote automatique, pour vérifier un niveau dans le navigateur et pour le test e2e.
- **Niveau `sandbox`** : une ligne droite avec tous les modificateurs dans l'ordre, une gemme sur une branche, enregistré en replay de non-régression.
- **Textes** toujours en français seulement ; l'anglais arrive avec l'i18n de la phase 4.

## 2026-11-27 — Phase 2 : système de niveaux

- **Grille** : une case fait 2 × 2 unités, une marche 0,5. `cell` vaut `[x, hauteur, z]` en cases et en marches. Rotation 0 vers -z (loin de la caméra), 90 vers +x. Les pièces linéaires partent du milieu du bord arrière de leur case, si bien que deux pièces se raccordent quand la sortie de l'une est l'entrée de l'autre.
- **Format v1 sans modificateurs** : le champ `modifiers` arrive avec les bonus et malus de la phase 3, en version 2 avec sa migration. La chaîne de migrations (`levels/migrations.ts`) est déjà en place et testée.
- **Une pièce = un module** (`game/pieces/`) qui décrit sa forme (sols, triangles, rambardes), son graphe de navigation (nœuds, liens, ports, blocages) et ses cases occupées. Les pièces mobiles ajoutent un corps et un `Mover`. Tout le parcours statique reste **un seul trimesh**, et le **rendu utilise le même maillage**, groupé par couleur (dessus et côtés) : ~20 à 40 draw calls mesurés avec `?debug`.
- **Épaisseur des sols 0,55** (et non 0,5) pour que le dessous d'une pièce ne coïncide jamais avec le dessus d'une pièce une marche plus bas. Les jonctions en T entre pièces de découpes différentes sont réparées dans le maillage.
- **Pas de rambarde sur une piste `rail`** (moins de 1,2 de large) : la bille ne passerait pas entre les deux.
- **Plateforme mobile** : accélération et freinage progressifs (0,5 s) aux arrêts, ce qui règle la glissade notée en phase 1. Arrêts possibles sur des demi-cases pour s'accoler au bord d'une case.
- **Validateur** (§ 4.3) : chevauchements (2 unités de hauteur libre), objets posés sur le parcours, ni dans un mur ni sous une autre surface, accessibilité depuis le départ, arrivée accessible après chaque cristal, checkpoint obligatoire au-delà de 70 unités de parcours, pente des rampes (32° en descente, avertissement au-delà de 16° en montée), estimation haute des draw calls (budget 80).
- **Bot** : il suit l'itinéraire calculé sur le graphe (départ, cristaux les plus proches, arrivée) avec un pilote en vitesse et anticipation, limité dans les virages serrés et sur les pièces étroites. Il attend les plateformes mobiles à quai. Temps limite : max(90 s, 4 × temps de référence). Le générateur fixe le temps de référence à 1,3 × le temps du bot.
- **Replays** : les entrées sont quantifiées à 1/256 dans la session, pour qu'une partie se rejoue à l'identique à partir de l'entrée enregistrée. Format compressé (`[x, y, pas]`), versionné par Zod. `level:bot` rejoue `tests/replays/` et compare temps et chutes ; la CI lance `level:validate` et `level:bot`.
- **Niveau du POC** posé sur la grille : la seconde moitié est décalée d'une unité, le reste est identique. Le replay e2e au clavier passe toujours sans réenregistrement.
- **Éditeur** : page `/editor/` du même build Vite (déployée sur Pages avec le jeu), en Preact et Zustand. Vue de dessus sur canvas 2D, inspecteur généré à partir du schéma Zod (il ne peut pas dériver du format), validation en direct, aperçu 3D, bot, « Jouer » (transmis au jeu par localStorage, `?level=editor`), export JSON. Le brouillon est sauvegardé dans le navigateur. C'est un outil de développement : **textes en français seulement**.
- **Preact 11** entre dans les dépendances avec l'éditeur, et **tsx** (dev) fait tourner les scripts `level:*` dans Node, sans navigateur (physique Rapier réelle, rendu ignoré).

## 2026-11-27 — Phase 1 : validation sur téléphone

- **60 fps stables sur iPhone** (build GitHub Pages, mesuré par l'utilisateur).
- **Ressenti validé** par l'utilisateur au doigt et au gyroscope, avec les réglages par défaut. Phase 1 terminée.
- **Test Android reporté à la phase 7** (décision de l'utilisateur) : pas d'Android moyen de gamme sous la main. Les tests internes Google Play fourniront de vrais appareils ; d'ici là, le compteur `?debug` et la qualité basse automatique limitent le risque. Le critère est ajouté à la validation de la phase 7.

## 2026-11-27 — Phase 1 : entrées, caméra, pause, réglages

- **Gyroscope** : filtre passe-bas sur les mesures brutes (constante de temps 50 ms, en plus du lissage existant à chaque pas), zone morte **radiale et progressive** (6 %, la sortie repart de zéro au lieu de sauter à 6 %), puis courbe expo (35 % cubique) : plus précis au centre, aussi rapide à fond. Le plafond est radial, comme le joystick : une diagonale ne penche plus plus fort qu'un axe seul. Tourner le téléphone (portrait ↔ paysage) recalibre à la mesure suivante.
- **Le contrôle au doigt et le clavier ne changent pas** avec les réglages par défaut (sensibilité ×1). C'est ce contrôle qui a été validé sur téléphone, et le replay e2e (au clavier) passe sans réenregistrement : la physique est identique.
- **Réglages** : mode de contrôle, angle pour pencher à fond (10–35°, 20° par défaut), sensibilité du doigt (×0,5–×2), inversion de chaque axe, vibrations, sons. La musique est déjà dans le format sauvegardé mais sans interrupteur tant qu'il n'y a pas de musique (phase 5).
- **Zod et Zustand arrivent dès maintenant** pour les réglages (`meta/settings.ts`, `meta/store.ts`). Format **version 1**, avec une fonction de migration testée : champ invalide → valeur par défaut, sauvegarde illisible ou plus récente → réglages par défaut. Stockage via `platform/storage.ts` (localStorage, interface asynchrone pour passer à `@capacitor/preferences` en phase 6).
- **Pause** : bouton en haut à droite, Échap ou P sur ordinateur, et pause automatique quand la page est cachée (`platform/lifecycle.ts`, appStateChange de Capacitor en phase 6). La session arrête complètement les pas physiques, le chrono et les plateformes. Le menu propose Reprendre, Recalibrer (en mode inclinaison), Recommencer et Réglages. L'ancien dock « Recalibrer / Recommencer » disparaît de l'écran de jeu, ce qui évite les touches accidentelles sous le pouce.
- **Caméra** : le suivi vertical est plus doux (3,5/s contre 6/s à l'horizontale) et le point visé est lissé (14/s), pour que les petits sauts et jointures ne secouent pas la vue.
- **Vibrations** : API Web Vibration (Android ; iOS Safari n'en a pas), une par événement (§ 5.4). Les vibrations natives arrivent en phase 6.
- **Performance** : compteur fps / pire image / draw calls avec `?debug`. Qualité basse automatique (ratio de pixels 1) après 3 s sous 50 fps. Draw calls de la vue de départ ramenés de 150 à 47 : les îles du décor partagent un seul maillage (couleurs par sommet), chaque nuage en est un, et les boîtes du parcours ont 2 groupes de faces (côtés, dessus) au lieu de 6. Aucun changement visuel.
- **Textes** toujours en français seulement, comme décidé en phase 0 ; l'anglais arrive avec l'i18n de la phase 4.

## 2026-11-27 — Phase 1 : passage à Rapier

- **Rapier `@dimforge/rapier3d-compat` 0.21.0** remplace cannon-es. Version figée : c'est celle sur laquelle la sensation a été validée sur téléphone.
- **Un seul collider trimesh pour tout le parcours statique** (`engine/trackCollider.ts`), avec `TriMeshFlags.FIX_INTERNAL_EDGES`. Les sols sont découpés sur une grille x/z commune : deux pièces qui se touchent à la même hauteur partagent exactement leurs sommets (pas de jonction en T), puis le maillage est fermé (flancs sur le seul contour réel, dessous). Murs et rambardes sont des boîtes fermées dans le même maillage, enfoncées de 5 cm dans le sol pour ne partager aucun sommet avec lui. Mesure (test unitaire) : sur 30 dalles jointes, des boîtes séparées font sauter la bille de plusieurs centimètres aux jointures ; avec le maillage fusionné elle reste à moins d'un centimètre.
- **Les visuels ne changent pas** : chaque pièce garde ses boîtes Three.js. Seule la collision est séparée (`xxxCollision()` par pièce). La rampe collisionne sur la pente exacte entre ses deux dalles, alors que sa boîte visuelle déborde de 15 cm et faisait une petite marche en haut avec cannon-es.
- **Pas fixe 120 Hz, rendu interpolé** (`createFixedStepper` dans `engine/loop.ts`, au plus 8 pas par image). L'entrée est lue et lissée une fois par pas ; plateformes mobiles, règles et chrono avancent aussi par pas. La bille et les plateformes sont dessinées entre les deux derniers états.
- **Réglages repris du POC** : frottement 0,5, rebond 0,05, gravité 22, inclinaison max 26°. Les amortissements cannon-es (0,12 et 0,25) sont convertis vers la formule de Rapier (`rapierDamping`) pour perdre la même vitesse par seconde.
- **Plateforme mobile** : corps cinématique piloté en position (`kinematicPositionBased`), logique de navette pure et testée (`createShuttle`). Remarque : elle démarre directement à pleine vitesse, donc une bille posée dessus glisse vers l'arrière (déjà le cas avec cannon-es). À traiter avec une accélération progressive en phase 2.
- **Replay e2e réenregistré** sur Rapier (déterministe, identique sur deux exécutions).
- **Poids** : le WASM inliné en base64 de Rapier pèse 4,3 Mo (1,7 Mo gzip). Il a son propre chunk pour rester en cache entre deux mises à jour du jeu. Pistes si le chargement web est trop lent : le paquet non-compat avec un `.wasm` séparé (~1,2 Mo gzip), ou une version plus ancienne et plus légère. Sans effet sur les applications natives, où le bundle est local.

## 2026-11-27 — Phase 0 : migration du POC vers Vite + TypeScript

- **cannon-es est conservé en phase 0.** La consigne est que le niveau du POC tourne « à l'identique ». Rapier, la boucle à pas fixe 120 Hz avec interpolation et le collider trimesh fusionné arrivent en phase 1. La boucle actuelle reprend celle du POC : `world.step(1/120, dt, 8)` avec `dt` plafonné à 50 ms.
- **Preuve de l'identité :** un test Playwright (`tests/e2e/replay.spec.ts`) rejoue une suite d'entrées avec une horloge simulée à 60 Hz et compare le HUD à des valeurs enregistrées sur le POC d'origine. Les captures d'écran des deux versions sont identiques au pixel près (hors fondu CSS du toast). Ce test cassera volontairement en phase 1 : il faudra réenregistrer les valeurs.
- **Le niveau du POC est une donnée** (`src/levels/data/poc.ts`), avec ses coordonnées d'origine. Le format sur grille validé par Zod (§ 3) le remplacera en phase 2.
- **Pas encore de Preact, Zustand ni Zod.** L'UI du POC est reprise en DOM simple dans `src/ui/`, à l'écoute du bus d'événements typé (`game/events.ts`). Preact arrive avec les écrans de la phase 4, Zod avec le format de niveau en phase 2.
- **Dossiers créés seulement quand ils ont du code.** `meta/`, `levels/schema.ts`, `tools/` et le reste de l'arborescence du § 2 viendront avec leurs phases.
- **Règles d'architecture vérifiées par ESLint** : `engine/` ne peut pas importer `game/`, `ui/` ou `meta/` ; `game/` ne peut pas utiliser `document` ; seul `platform/` peut importer `@capacitor/*`.
- **TypeScript 6.0** plutôt que 7 : typescript-eslint ne prend pas encore en charge TypeScript 7.
- **`base: './'`** dans Vite : le même build fonctionne en local et sur GitHub Pages (`/bille-celeste/`).
