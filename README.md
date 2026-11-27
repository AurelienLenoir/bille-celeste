# Bille Céleste

Jeu mobile 3D : on incline le monde pour guider une bille, on ramasse des cristaux et on rejoint l'anneau d'arrivée.

Voir [PLAN.md](PLAN.md) pour la feuille de route et [CLAUDE.md](CLAUDE.md) pour les règles du projet.

## Démarrer

```sh
npm install
npm run dev        # http://localhost:5173 (et sur le téléphone via l'IP locale)
```

## Vérifier

```sh
npm run typecheck
npm run lint
npm test           # Vitest
npm run test:e2e   # Playwright (build + preview)
npm run build
```

## Niveaux

Les niveaux sont des fichiers JSON dans `src/levels/data/`, validés par le schéma Zod de `src/levels/schema.ts`.

```sh
npm run level:validate                                   # vérifications statiques de tous les niveaux
npm run level:bot                                        # le bot termine chaque niveau, puis rejoue tests/replays
npm run level:bot -- --level poc --record                # enregistre un replay de non-régression
npm run level:gen -- --world 2 --difficulty 0.5 --seed 42  # génère un niveau (validé et testé par le bot)
npm run level:gen -- --world 3 --difficulty 0.5 --seed 7 --focus ice,tiles  # met en avant des mécaniques
npm run level:bot -- --par                               # recalibre le temps de référence des niveaux de la campagne
```

La campagne (4 mondes de 5 niveaux, `w1-01` à `w4-05`) est décrite dans `src/levels/worlds.ts`. Les panneaux du didacticiel (`signs`) s'écrivent dans le JSON du niveau.

L'éditeur est sur `/editor/` (`npm run dev`, puis http://localhost:5173/editor/). Il ouvre, génère ou importe un niveau, le valide en direct, le fait tester par le bot, le lance dans le jeu et l'exporte en JSON. Dans le jeu, `?level=<id>` mène directement à un niveau, `?unlock` ouvre tous les mondes, `?bot` laisse le pilote automatique jouer et `?record` télécharge le replay d'une partie gagnée.

Chaque push sur `master` passe la CI puis déploie le build sur GitHub Pages.
