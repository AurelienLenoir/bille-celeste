import { expect, test } from '@playwright/test';

const wallet = (feathers: number) =>
  JSON.stringify({
    version: 1,
    feathers,
    owned: ['classic'],
    equipped: 'classic',
    gemsPaid: [],
    noAds: false,
    winsSinceAd: 0,
  });

test('the shop sells a skin for feathers and keeps it after a reload', async ({ page }) => {
  await page.goto('./');
  await page.evaluate((w) => localStorage.setItem('bille-celeste.wallet', w), wallet(100));
  await page.reload();
  await page.getByRole('button', { name: 'Boutique' }).click();
  await expect(page.getByRole('heading', { name: 'Boutique' })).toBeVisible();
  await expect(page.getByText('Défi du jour', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Galaxie' }).click();
  await page.getByRole('button', { name: /Acheter · 450/ }).click();
  await expect(page.getByText('Pas assez de plumes')).toBeVisible();

  await page.getByRole('button', { name: 'Menthe' }).click();
  await page.getByRole('button', { name: /Acheter · 60/ }).click();
  await expect(page.getByRole('button', { name: 'Équipée' })).toBeVisible();
  await expect(page.locator('.feathers').first()).toContainText('40');

  await page.reload();
  await page.getByRole('button', { name: 'Boutique' }).click();
  await expect(page.getByRole('button', { name: 'Équipée' })).toBeVisible();
  // No store purchases in a browser.
  await expect(page.getByText('Restaurer mes achats')).toHaveCount(0);
});

test('a first win pays feathers', async ({ page }) => {
  // The autopilot plays the whole level: longer than the default 30 s on a slow CI machine.
  test.setTimeout(120_000);
  await page.goto('./?level=w1-01&bot');
  await page.getByRole('button', { name: 'Jouer au doigt' }).click();
  await expect(page.locator('#win')).toBeVisible({ timeout: 90_000 });
  await expect(page.locator('#wFeathers')).toContainText('plumes');
});
