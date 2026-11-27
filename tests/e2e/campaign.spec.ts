import { expect, test, type Page } from '@playwright/test';

const collectErrors = (page: Page) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
};

test('title, world map and level select: only the first level is open at first', async ({ page }, testInfo) => {
  const errors = collectErrors(page);
  await page.goto('./');
  await page.getByRole('button', { name: 'Jouer au doigt' }).click();
  await expect(page.getByRole('heading', { name: 'Les mondes' })).toBeVisible();
  await expect(page.getByText('0 / 60 étoiles')).toBeVisible();
  await expect(page.getByRole('button', { name: /Coucher de soleil/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: /10 ★ pour ouvrir/ })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('map.png') });

  await page.getByRole('button', { name: /Jardins flottants/ }).click();
  await expect(page.getByRole('heading', { name: 'Jardins flottants' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Premiers pas/ })).toBeEnabled();
  await expect(page.getByRole('button', { name: /La boucle verte/ })).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath('levels.png') });

  await page.getByRole('button', { name: /Premiers pas/ }).click();
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await expect(page.locator('#cr')).toHaveText('0/3');
  await page.screenshot({ path: testInfo.outputPath('tutorial.png') });
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('button', { name: 'Quitter le niveau' }).click();
  await expect(page.getByRole('heading', { name: 'Jardins flottants' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('winning a level saves its stars and record, and opens the next one', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'One viewport is enough for a full run.');
  test.setTimeout(120_000);
  const errors = collectErrors(page);
  await page.goto('./?bot');
  await page.getByRole('button', { name: 'Jouer au doigt' }).click();
  await page.getByRole('button', { name: /Jardins flottants/ }).click();
  await page.getByRole('button', { name: /Premiers pas/ }).click();
  await expect(page.getByRole('heading', { name: 'Niveau terminé !' })).toBeVisible({ timeout: 90_000 });
  await expect(page.locator('#wRecord')).toHaveText('Nouveau record !');
  await page.screenshot({ path: testInfo.outputPath('win.png') });

  await page.getByRole('button', { name: 'Niveau suivant' }).click();
  await expect(page.locator('#cr')).toHaveText('0/4');
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('button', { name: 'Quitter le niveau' }).click();
  await expect(page.getByRole('button', { name: /Premiers pas.*Record 0:/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /La boucle verte/ })).toBeEnabled();

  // Progress survives a reload.
  await page.goto('./');
  await page.getByRole('button', { name: 'Jouer au doigt' }).click();
  await expect(page.getByText(/[1-3] \/ 60 étoiles/)).toBeVisible();
  expect(errors).toEqual([]);
});

test('?unlock opens every world', async ({ page }) => {
  await page.goto('./?unlock');
  await page.getByRole('button', { name: 'Jouer au doigt' }).click();
  await page.getByRole('button', { name: /Usine à nuages/ }).click();
  await page.getByRole('button', { name: /La grande machine/ }).click();
  await expect(page.locator('#cr')).toHaveText(/^0\/\d+$/);
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
});

test('the interface switches to English', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Réglages' }).click();
  await page.getByLabel('English').check();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('button', { name: 'Play with your finger' })).toBeVisible();
  await page.getByRole('button', { name: 'Play with your finger' }).click();
  await expect(page.getByRole('button', { name: /Floating Gardens/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Play by tilting' })).toBeVisible();
});
