import { expect, test } from '@playwright/test';

/**
 * Replays a fixed input script with a fake 60 Hz clock and checks the HUD after each step.
 * The expected values were recorded from the original single-file prototype (index.html on
 * master before phase 0), so this pins the ported physics and rules to the prototype's.
 * Phase 1 (Rapier) will change the physics: re-record the values then, on purpose.
 */
const SCRIPT: [string | null, number, string][] = [
  ['ArrowUp', 70, '0/7 0:01.2 0'],
  [null, 20, '0/7 0:01.5 0'],
  ['ArrowRight', 45, '0/7 0:02.3 0'],
  ['ArrowUp', 15, '0/7 0:02.5 0'],
  ['ArrowRight', 60, '0/7 0:03.5 1'],
  [null, 30, '0/7 0:04.0 1'],
  ['ArrowUp', 80, '0/7 0:05.3 1'],
  ['ArrowLeft', 25, '0/7 0:05.7 1'],
  ['ArrowUp', 120, '0/7 0:07.7 2'],
  ['ArrowDown', 40, '0/7 0:08.4 2'],
  [null, 60, '1/7 0:09.4 2'],
  ['ArrowUp', 200, '1/7 0:12.7 2'],
];

test('replay matches the prototype frame for frame', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Deterministic replay only needs one viewport.');
  // Every frame is rendered with software WebGL in CI, so this is slow.
  test.setTimeout(180_000);
  await page.addInitScript(() => {
    let now = 0;
    let queue: FrameRequestCallback[] = [];
    performance.now = () => now;
    window.requestAnimationFrame = (cb) => queue.push(cb);
    Object.assign(window, {
      advance: (frames: number) => {
        for (let i = 0; i < frames; i++) {
          now += 1000 / 60;
          const due = queue;
          queue = [];
          due.forEach((cb) => cb(now));
        }
      },
    });
  });
  const advance = (frames: number) =>
    page.evaluate((n) => (window as unknown as { advance: (n: number) => void }).advance(n), frames);

  await page.goto('./');
  await page.waitForFunction(() => 'advance' in window && '__ok' in window);
  await advance(5);
  await page.getByRole('button', { name: 'Jouer au doigt' }).click();

  const hud = () =>
    page.evaluate(() => ['cr', 'tm', 'fl'].map((id) => document.getElementById(id)?.textContent).join(' '));

  for (const [key, frames, expected] of SCRIPT) {
    if (key) await page.keyboard.down(key);
    await advance(frames);
    if (key) await page.keyboard.up(key);
    expect(await hud()).toBe(expected);
  }
});
