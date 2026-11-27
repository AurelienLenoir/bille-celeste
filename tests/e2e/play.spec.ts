import { expect, test, type Page } from '@playwright/test';

const collectErrors = (page: Page) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
};

test('loads the start card without errors', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Bille Céleste' })).toBeVisible();
  await expect(page.locator('#cr')).toHaveText('0/7');
  await expect(page.locator('#err')).toBeHidden();
  expect(errors).toEqual([]);
});

test('rolling forward collects the first crystal and reaches checkpoint 1', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./');
  await page.getByRole('button', { name: 'Jouer au doigt' }).click();
  await expect(page.locator('#start')).toBeHidden();
  await expect(page.locator('#dock')).toBeVisible();

  await page.keyboard.down('ArrowUp');
  await expect(page.locator('#cr')).toHaveText('1/7', { timeout: 10_000 });
  await expect(page.locator('#toast')).toHaveText('Checkpoint !', { timeout: 10_000 });
  await page.keyboard.up('ArrowUp');

  await expect(page.locator('#tm')).not.toHaveText('0:00.0');
  expect(errors).toEqual([]);
});

test('restart resets the counters', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Jouer au doigt' }).click();
  await page.keyboard.down('ArrowUp');
  await expect(page.locator('#cr')).toHaveText('1/7', { timeout: 10_000 });
  await page.keyboard.up('ArrowUp');
  await page.getByRole('button', { name: 'Recommencer' }).click();
  await expect(page.locator('#cr')).toHaveText('0/7');
  await expect(page.locator('#fl')).toHaveText('0');
});
