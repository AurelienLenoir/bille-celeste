import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('the editor creates a level, tests it with the bot, plays it and exports it', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./editor/');
  await expect(page.getByText('✓ Niveau valide')).toBeVisible();

  // A new level, plus a second crystal in the middle of its straight.
  await page.getByRole('button', { name: 'Nouveau' }).click();
  await page.getByRole('button', { name: 'Cristal' }).click();
  const grid = page.getByTestId('grid');
  const box = await grid.boundingBox();
  if (!box) throw new Error('grid not visible');
  await grid.click({ position: { x: box.width / 2, y: box.height / 2 } });
  await page.keyboard.press('Escape');
  await expect(page.getByText('3 pièces · 2 cristaux')).toBeVisible();
  await expect(page.getByText('✓ Niveau valide')).toBeVisible();

  await page.getByRole('button', { name: 'Tester avec le bot' }).click();
  await expect(page.getByRole('status')).toContainText('Bot : terminé', { timeout: 30_000 });

  const [game] = await Promise.all([
    context.waitForEvent('page'),
    page.getByRole('button', { name: 'Jouer ▶' }).click(),
  ]);
  await expect(game.locator('#cr')).toHaveText('0/2');
  await expect(game.locator('#err')).toBeHidden();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exporter' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('nouveau.json');
  const exported = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(exported.entities.filter((e: { type: string }) => e.type === 'crystal')).toHaveLength(2);
  expect(errors).toEqual([]);
});
