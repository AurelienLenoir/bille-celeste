# Décisions

Journal des choix structurants (le plus récent en haut).

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
