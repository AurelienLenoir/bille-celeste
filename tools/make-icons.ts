/**
 * Draws the app icon and splash screen in a headless browser (tools/art/draw-icon.js) and writes
 * them to assets/, where `npx capacitor-assets generate` turns them into every native size.
 * Usage: npm run art:icons
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const OUT = 'assets';
const FILES = [
  { kind: 'icon', size: 1024, file: 'icon-only.png' },
  { kind: 'foreground', size: 1024, file: 'icon-foreground.png' },
  { kind: 'background', size: 1024, file: 'icon-background.png' },
  { kind: 'splash', size: 2732, file: 'splash.png' },
  { kind: 'splash', size: 2732, file: 'splash-dark.png' },
] as const;

type ArtWindow = { drawArt: (kind: string, size: number) => string };

const main = async () => {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent('<html><body></body></html>');
  await page.addScriptTag({ content: readFileSync('tools/art/draw-icon.js', 'utf8') });
  for (const { kind, size, file } of FILES) {
    const url = await page.evaluate(([k, n]) => (window as unknown as ArtWindow).drawArt(k, n), [kind, size] as const);
    writeFileSync(`${OUT}/${file}`, Buffer.from(url.split(',')[1] ?? '', 'base64'));
    console.log(`${OUT}/${file}`);
  }
  await browser.close();
};

await main();
