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
  await page.goto('./?level=poc');
  await expect(page.getByRole('heading', { name: 'Bille Céleste' })).toBeVisible();
  await expect(page.locator('#cr')).toHaveText('0/7');
  await expect(page.locator('#err')).toBeHidden();
  expect(errors).toEqual([]);
});

test('rolling forward collects the first crystal and reaches checkpoint 1', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./?level=poc');
  await page.getByRole('button', { name: 'Jouer au doigt' }).click();
  await expect(page.locator('#start')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();

  await page.keyboard.down('ArrowUp');
  await expect(page.locator('#cr')).toHaveText('1/7', { timeout: 10_000 });
  await expect(page.locator('#toast')).toHaveText('Checkpoint !', { timeout: 10_000 });
  await page.keyboard.up('ArrowUp');

  await expect(page.locator('#tm')).not.toHaveText('0:00.0');
  expect(errors).toEqual([]);
});

test('restart resets the counters', async ({ page }) => {
  await page.goto('./?level=poc');
  await page.getByRole('button', { name: 'Jouer au doigt' }).click();
  await page.keyboard.down('ArrowUp');
  await expect(page.locator('#cr')).toHaveText('1/7', { timeout: 10_000 });
  await page.keyboard.up('ArrowUp');
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('button', { name: 'Recommencer' }).click();
  await expect(page.locator('#pauseMenu')).toBeHidden();
  await expect(page.locator('#cr')).toHaveText('0/7');
  await expect(page.locator('#fl')).toHaveText('0');
});

test('pause freezes the timer and resume continues it', async ({ page }) => {
  await page.goto('./?level=poc');
  await page.getByRole('button', { name: 'Jouer au doigt' }).click();
  // The chrono waits for the ball to move.
  await page.waitForTimeout(400);
  await expect(page.locator('#tm')).toHaveText('0:00.0');
  await page.keyboard.down('ArrowUp');
  await expect(page.locator('#tm')).not.toHaveText('0:00.0');
  await page.keyboard.up('ArrowUp');
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByRole('heading', { name: 'Pause' })).toBeVisible();
  const frozen = await page.locator('#tm').textContent();
  await page.waitForTimeout(600);
  await expect(page.locator('#tm')).toHaveText(frozen ?? '');
  await page.getByRole('button', { name: 'Reprendre' }).click();
  await expect(page.locator('#pauseMenu')).toBeHidden();
  await expect(page.locator('#tm')).not.toHaveText(frozen ?? '');
});

test('escape toggles pause, and hiding the page pauses automatically', async ({ page }) => {
  await page.goto('./?level=poc');
  await page.getByRole('button', { name: 'Jouer au doigt' }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#pauseMenu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#pauseMenu')).toBeHidden();
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('#pauseMenu')).toBeVisible();
});

test('settings are saved and survive a reload', async ({ page }) => {
  await page.goto('./?level=poc');
  await page.getByRole('button', { name: 'Réglages' }).click();
  await expect(page.getByRole('heading', { name: 'Réglages' })).toBeVisible();
  await page.getByLabel('Inverser gauche / droite').check();
  await page.getByLabel('Sons', { exact: true }).uncheck();
  await page.getByRole('button', { name: 'Retour' }).click();
  await expect(page.getByRole('heading', { name: 'Bille Céleste' })).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: 'Réglages' }).click();
  await expect(page.getByLabel('Inverser gauche / droite')).toBeChecked();
  await expect(page.getByLabel('Sons', { exact: true })).not.toBeChecked();
});

test('debug overlay reports the frame rate', async ({ page }) => {
  await page.goto('./?debug');
  await expect(page.locator('#perf')).toContainText('fps', { timeout: 5_000 });
});

test('music and sound volumes are in the settings', async ({ page }) => {
  await page.goto('./?level=poc');
  await page.getByRole('button', { name: 'Réglages' }).click();
  await expect(page.getByLabel('Musique', { exact: true })).toBeChecked();
  await expect(page.locator('input[name=musicVolume]')).toBeVisible();
  await page.getByLabel('Musique', { exact: true }).uncheck();
  await expect(page.locator('input[name=musicVolume]')).toHaveCount(0);
});
