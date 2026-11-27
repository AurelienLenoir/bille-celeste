import { expect, test } from '@playwright/test';

test('the sandbox plays every bonus and malus to the win card, with its stars', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'One viewport is enough for a full run.');
  // Software WebGL in CI: the autopilot needs a while to drive the whole level.
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./?level=sandbox&bot');
  await expect(page.locator('#cr')).toHaveText('0/7');
  await page.getByRole('button', { name: 'Jouer au doigt' }).click();
  await expect(page.locator('#fx')).toContainText('Aimant', { timeout: 30_000 });
  await page.screenshot({ path: testInfo.outputPath('sandbox-magnet.png') });
  await expect(page.locator('#fx')).toContainText('Bulle', { timeout: 60_000 });
  await expect(page.getByRole('heading', { name: 'Niveau terminé !' })).toBeVisible({ timeout: 200_000 });
  await expect(page.locator('#wStars li.on')).toHaveCount(3);
  await page.screenshot({ path: testInfo.outputPath('sandbox-win.png') });
  expect(errors).toEqual([]);
});
