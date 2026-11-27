# Décisions

Journal des choix structurants (le plus récent en haut).

## 2026-11-27 — Phase 0 : migration du POC vers Vite + TypeScript

- **cannon-es est conservé en phase 0.** La consigne est que le niveau du POC tourne « à l'identique ». Rapier, la boucle à pas fixe 120 Hz avec interpolation et le collider trimesh fusionné arrivent en phase 1. La boucle actuelle reprend celle du POC : `world.step(1/120, dt, 8)` avec `dt` plafonné à 50 ms.
- **Preuve de l'identité :** un test Playwright (`tests/e2e/replay.spec.ts`) rejoue une suite d'entrées avec une horloge simulée à 60 Hz et compare le HUD à des valeurs enregistrées sur le POC d'origine. Les captures d'écran des deux versions sont identiques au pixel près (hors fondu CSS du toast). Ce test cassera volontairement en phase 1 : il faudra réenregistrer les valeurs.
- **Le niveau du POC est une donnée** (`src/levels/data/poc.ts`), avec ses coordonnées d'origine. Le format sur grille validé par Zod (§ 3) le remplacera en phase 2.
- **Pas encore de Preact, Zustand ni Zod.** L'UI du POC est reprise en DOM simple dans `src/ui/`, à l'écoute du bus d'événements typé (`game/events.ts`). Preact arrive avec les écrans de la phase 4, Zod avec le format de niveau en phase 2.
- **Dossiers créés seulement quand ils ont du code.** `meta/`, `levels/schema.ts`, `tools/` et le reste de l'arborescence du § 2 viendront avec leurs phases.
- **Règles d'architecture vérifiées par ESLint** : `engine/` ne peut pas importer `game/`, `ui/` ou `meta/` ; `game/` ne peut pas utiliser `document` ; seul `platform/` peut importer `@capacitor/*`.
- **TypeScript 6.0** plutôt que 7 : typescript-eslint ne prend pas encore en charge TypeScript 7.
- **`base: './'`** dans Vite : le même build fonctionne en local et sur GitHub Pages (`/bille-celeste/`).
