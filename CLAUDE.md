# CLAUDE.md — Bille Céleste

Jeu mobile 3D : on incline le monde pour guider une bille, on ramasse des cristaux et on rejoint l'anneau d'arrivée.
**Lis `PLAN.md` avant toute tâche.** Il décrit les phases, l'architecture et les critères de validation.

## Stack
TypeScript strict · Vite · Three.js · Rapier (`@dimforge/rapier3d-compat`) · Preact · Zustand · Zod · Capacitor · Vitest · Playwright

## Commandes
- `npm run dev` : jeu sur localhost (éditeur sur `/editor`)
- `npm run typecheck` · `npm run lint` · `npm test` · `npm run test:e2e`
- `npm run level:validate` · `npm run level:bot` · `npm run level:gen -- --world N --difficulty 0..1 --seed S`
- `npm run build` puis `npx cap sync` pour les apps natives

## Règles d'architecture
- `src/engine/` n'importe jamais `src/game/`, `src/ui/` ou `src/meta/`.
- `src/game/` ne touche pas au DOM. Il émet des événements (`game/events.ts`), que l'UI écoute.
- Seul `src/platform/` importe des paquets Capacitor. Le jeu doit toujours fonctionner dans un simple navigateur.
- Physique à pas fixe (120 Hz), rendu interpolé. L'entrée est lue une fois par pas, pour que les parties soient déterministes et rejouables.
- On ne fait jamais tourner les colliders du parcours pour simuler l'inclinaison : on fait tourner la gravité et la caméra.
- Niveaux, modificateurs et skins sont des **données** validées par Zod. Pas de niveau codé en dur.
- Tout changement du schéma de niveau ou de sauvegarde demande d'incrémenter `version` et d'écrire une migration testée.
- Tous les assets sont générés par du code (géométrie, textures canvas ou shader, sons synthétisés, scripts Blender exécutés en mode `--background`). Aucun asset repris de Kororinpa ou d'un autre jeu.

## Budget de performance
60 fps sur un Android moyen de gamme · moins de 80 draw calls · une seule ombre dynamique (1024 px max) · ratio de pixels ≤ 2 · chargement d'un niveau < 500 ms.

## Définition de « terminé »
1. `typecheck`, `lint`, `test` et `level:validate` passent.
2. `level:bot` termine tous les niveaux. Si la physique a été modifiée, les replays de non-régression passent aussi.
3. La fonctionnalité a été vérifiée dans le navigateur (capture ou test e2e), y compris en vue mobile (375×812).
4. `PLAN.md` § 13 est mis à jour, et toute décision structurante est notée dans `docs/decisions.md`.

## Conventions
- Code et noms en anglais ; textes affichés en français et en anglais via `src/i18n/`.
- Exports nommés, fonctions courtes, pas de `any`.
- Une pièce par fichier dans `game/pieces/`, un modificateur par fichier dans `game/modifiers/`, chacun avec son test.
- Monétisation (pubs, achats) **uniquement en phase 9**. Ne pas l'anticiper dans le code avant.
