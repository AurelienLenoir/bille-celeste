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

Chaque push sur `master` passe la CI puis déploie le build sur GitHub Pages.
