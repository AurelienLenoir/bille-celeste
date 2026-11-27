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
      output: {
        codeSplitting: {
          groups: [
            // Rapier ships its WebAssembly inlined as base64 (~4 MB, ~1.2 MB gzipped). It gets its own
            // chunk so it caches across game updates; its size is tracked in docs/decisions.md.
            { name: 'rapier', test: /rapier3d-compat/ },
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
