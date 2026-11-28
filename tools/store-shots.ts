/**
 * Store screenshots (PLAN.md § 7 and § 8), taken from the real game: the autopilot plays a level of
 * each world and the camera catches it mid-run, plus the title and the shop.
 * Usage: npm run build && npm run store:shots  → store/screenshots/<device>/<lang>-<n>.png
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium, type Page } from '@playwright/test';

const PORT = 4179;
const BASE = `http://localhost:${PORT}/`;
/** Store sizes: iPhone 6.9" (1320 × 2868) and an Android phone (1080 × 1920). */
const DEVICES = [
  { name: 'iphone-6.9', width: 440, height: 956, scale: 3 },
  { name: 'android-phone', width: 360, height: 640, scale: 3 },
] as const;
const LANGS = ['fr', 'en'] as const;
const PLAY_BUTTON = { fr: 'Jouer au doigt', en: 'Play with your finger' };
const SHOP_BUTTON = { fr: 'Boutique', en: 'Shop' };
const LEVELS = ['w1-03', 'w2-02', 'w3-02', 'w4-03'];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const settle = async (page: Page, lang: (typeof LANGS)[number]) => {
  await page.evaluate(
    ([language]) => {
      localStorage.setItem(
        'bille-celeste.settings',
        JSON.stringify({
          version: 4,
          controlMode: 'touch',
          tiltRangeDeg: 20,
          touchSensitivity: 1,
          invertX: false,
          invertY: false,
          haptics: true,
          sound: false,
          music: false,
          language,
          sfxVolume: 0.8,
          musicVolume: 0.5,
          telemetry: 'no',
        }),
      );
      localStorage.setItem(
        'bille-celeste.wallet',
        JSON.stringify({
          version: 1,
          feathers: 480,
          owned: ['classic', 'galaxy', 'mint'],
          equipped: 'classic',
          gemsPaid: [],
          noAds: false,
          winsSinceAd: 0,
        }),
      );
    },
    [lang],
  );
};

const main = async () => {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
  for (let i = 0; i < 60; i++) {
    const up = await fetch(BASE).then(
      () => true,
      () => false,
    );
    if (up) break;
    await wait(500);
  }
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  try {
    for (const device of DEVICES) {
      for (const lang of LANGS) {
        const dir = `store/screenshots/${device.name}`;
        mkdirSync(dir, { recursive: true });
        const page = await browser.newPage({
          viewport: { width: device.width, height: device.height },
          deviceScaleFactor: device.scale,
          locale: lang === 'fr' ? 'fr-FR' : 'en-US',
          hasTouch: true,
        });
        await page.goto(BASE);
        await settle(page, lang);
        let n = 1;
        const shot = async () => page.screenshot({ path: `${dir}/${lang}-${n++}.png` });
        await page.goto(`${BASE}?level=w1-01`);
        await wait(2000);
        await shot();
        for (const level of LEVELS) {
          await page.goto(`${BASE}?level=${level}&bot&unlock`);
          await wait(1500);
          await page.getByRole('button', { name: PLAY_BUTTON[lang] }).click();
          await wait(7000);
          await shot();
        }
        await page.goto(BASE);
        await wait(1500);
        await page.getByRole('button', { name: SHOP_BUTTON[lang] }).click();
        await wait(1500);
        await shot();
        await page.close();
        console.log(`${dir}: ${n - 1} ${lang} screenshots`);
      }
    }
  } finally {
    await browser.close();
    server.kill();
  }
};

await main();
