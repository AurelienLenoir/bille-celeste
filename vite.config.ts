import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the build works both on localhost and on GitHub Pages (/bille-celeste/).
  base: './',
  server: { host: true },
  // three.js alone is ~550 kB minified; it gets its own chunk budget until phase 5 trims it.
  build: { target: 'es2022', sourcemap: true, chunkSizeWarningLimit: 800 },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
