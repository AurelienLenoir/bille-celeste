import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the build works both on localhost and on GitHub Pages (/bille-celeste/).
  base: './',
  server: { host: true },
  build: {
    target: 'es2022',
    sourcemap: true,
    // three.js alone is ~550 kB minified; it gets its own chunk budget until phase 5 trims it.
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      // The game and the level editor (/editor/) are two pages of the same build.
      input: {
        game: resolve(import.meta.dirname, 'index.html'),
        editor: resolve(import.meta.dirname, 'editor/index.html'),
      },
      output: {
        codeSplitting: {
          groups: [
            // Rapier ships its WebAssembly inlined as base64 (~4 MB, ~1.2 MB gzipped). It gets its own
            // chunk so it caches across game updates; its size is tracked in docs/decisions.md.
            { name: 'rapier', test: /rapier3d-compat/ },
            // Capacitor's core is used at start-up: it must not end up in an on-demand chunk below.
            { name: 'vendor', test: /@capacitor[\\/]core|@webview-native-ui/ },
            // SDKs loaded on demand (crash reports, ads, purchases) stay out of the start-up bundle.
            { name: 'sentry', test: /@sentry/ },
            { name: 'monetization', test: /@capacitor-community[\\/]admob|@revenuecat/ },
            // Libraries shared by the game and the editor (three.js, Zod, Zustand).
            { name: 'vendor', test: /node_modules/ },
          ],
        },
      },
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
