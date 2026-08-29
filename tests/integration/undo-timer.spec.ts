import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** User Story 5 acceptance scenarios, end to end. */

async function openReadyBoard(page: Page) {
  await page.goto('/');
  await page.locator('[role="grid"][aria-busy="false"]').waitFor();
  await page.locator('[role="gridcell"][data-origin="clue"]').first().waitFor();
}

async function emptyIndices(page: Page, count: number) {
  return page.evaluate((n) => {
    return Array.from(document.querySelectorAll('[role="gridcell"][data-origin="empty"]'))
      .slice(0, n)
      .map((c) => c.getAttribute('data-index')!);
  }, count);
}

test('five changes then five undos returns the board to its starting state (FR-031)', async ({ page }) => {
  await openReadyBoard(page);
  const indices = await emptyIndices(page, 5);

  for (const index of indices) {
    await page.locator(`[data-index="${index}"]`).click();
    await page.keyboard.press('7');
  }
  for (const index of indices) {
    await expect(page.locator(`[data-index="${index}"]`)).toContainText('7');
  }

  const undoButton = page.getByRole('button', { name: /undo/i });
  for (let i = 0; i < 5; i++) await undoButton.click();

  for (const index of indices) {
    await expect(page.locator(`[data-index="${index}"]`)).toHaveText('');
  }
  await expect(undoButton).toBeDisabled();
});

test('Undo is visibly disabled on a fresh puzzle (FR-032)', async ({ page }) => {
  await openReadyBoard(page);
  await expect(page.getByRole('button', { name: /undo/i })).toBeDisabled();
});

test('the timer counts up in MM:SS (FR-034)', async ({ page }) => {
  await openReadyBoard(page);
  const timer = page.getByTestId('timer');

  await expect(timer).toHaveText(/^\d{2}:\d{2}$/);
  await expect(timer).not.toHaveText('00:00', { timeout: 3000 });
});

test('pause stops the clock and obscures the board; resume continues it (FR-035)', async ({ page }) => {
  await openReadyBoard(page);
  const timer = page.getByTestId('timer');

  await expect(timer).not.toHaveText('00:00', { timeout: 3000 });
  await page.getByRole('button', { name: /pause/i }).click();

  const stopped = await timer.textContent();
  await expect(page.getByTestId('pause-overlay')).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(timer).toHaveText(stopped ?? '');

  await page.getByRole('button', { name: /resume/i }).click();
  await expect(page.getByTestId('pause-overlay')).toHaveCount(0);
  await expect(timer).not.toHaveText(stopped ?? '', { timeout: 3000 });
});

test('a new puzzle discards undo history, which cannot be stepped back into (FR-033)', async ({ page }) => {
  await openReadyBoard(page);
  const [index] = await emptyIndices(page, 1);

  await page.locator(`[data-index="${index}"]`).click();
  await page.keyboard.press('4');
  await expect(page.getByRole('button', { name: /undo/i })).toBeEnabled();

  await page.getByLabel(/difficulty/i).selectOption('medium');
  await page.locator('[role="grid"][aria-busy="false"]').waitFor();

  await expect(page.getByRole('button', { name: /undo/i })).toBeDisabled();
});

test('the Erase control clears the active cell but never a clue (FR-030)', async ({ page }) => {
  await openReadyBoard(page);
  const [index] = await emptyIndices(page, 1);

  await page.locator(`[data-index="${index}"]`).click();
  await page.keyboard.press('6');
  await expect(page.locator(`[data-index="${index}"]`)).toContainText('6');

  await page.getByRole('button', { name: /erase/i }).click();
  await expect(page.locator(`[data-index="${index}"]`)).toHaveText('');

  const clue = page.locator('[role="gridcell"][data-origin="clue"]').first();
  const clueText = await clue.textContent();
  await clue.click();
  await page.getByRole('button', { name: /erase/i }).click();
  await expect(clue).toHaveText(clueText ?? '');
});

test('the board cannot be played while paused', async ({ page }) => {
  await openReadyBoard(page);
  const [index] = await emptyIndices(page, 1);

  await page.locator(`[data-index="${index}"]`).click();
  await page.getByRole('button', { name: /pause/i }).click();
  await page.keyboard.press('5');

  await page.getByRole('button', { name: /resume/i }).click();
  await expect(page.locator(`[data-index="${index}"]`)).toHaveText('');
});
