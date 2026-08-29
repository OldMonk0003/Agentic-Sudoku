import { test, expect } from '@playwright/test';

/** User Story 1 acceptance scenarios, end to end against the static export. */

/**
 * Wait for generation to finish before touching the board.
 *
 * This matters: while status is 'generating' EVERY cell reads
 * data-origin="empty", so a `.first()` empty-cell locator can latch onto a cell
 * that becomes a clue once the puzzle lands. That race is invisible on a fast
 * machine and fails under parallel load.
 */
async function openReadyBoard(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.locator('[role="grid"][aria-busy="false"]').waitFor();
  await page.locator('[role="gridcell"][data-origin="clue"]').first().waitFor();
}

test('presents a playable puzzle on first load with no intermediate step (FR-001)', async ({ page }) => {
  await openReadyBoard(page);
  await expect(page.getByRole('grid', { name: /sudoku/i })).toBeVisible();
  // Starting clues are present, so a real puzzle generated.
  const filled = page.locator('[role="gridcell"][data-origin="clue"]');
  await expect(filled.first()).toBeVisible();
  expect(await filled.count()).toBeGreaterThan(16);
});

test('places a digit that is styled apart from the starting clues (FR-005)', async ({ page }) => {
  await openReadyBoard(page);
  // Pin to the index: a [data-origin="empty"] locator would re-resolve to a
  // different cell the moment the digit lands.
  const index = await page.locator('[role="gridcell"][data-origin="empty"]').first().getAttribute('data-index');
  const cell = page.locator(`[data-index="${index}"]`);

  await cell.click();
  await page.keyboard.press('7');

  await expect(cell).toHaveAttribute('data-origin', 'player');
  await expect(cell).toContainText('7');
});

test('refuses to modify a starting clue, without a dialog (FR-021)', async ({ page }) => {
  await openReadyBoard(page);
  const clue = page.locator('[role="gridcell"][data-origin="clue"]').first();
  const before = await clue.textContent();

  await clue.click();
  await page.keyboard.press('9');
  await page.keyboard.press('Backspace');

  await expect(clue).toHaveText(before ?? '');
  await expect(page.locator('dialog')).toHaveCount(0);
});

test('moves selection with arrows and WASD, stopping at the edge (FR-019)', async ({ page }) => {
  await openReadyBoard(page);
  await page.locator('[data-index="0"]').click();
  await expect(page.locator('[data-index="0"]')).toHaveAttribute('data-selected', 'true');

  await page.keyboard.press('ArrowUp');
  await expect(page.locator('[data-index="0"]')).toHaveAttribute('data-selected', 'true');

  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-index="1"]')).toHaveAttribute('data-selected', 'true');

  await page.keyboard.press('s');
  await expect(page.locator('[data-index="10"]')).toHaveAttribute('data-selected', 'true');
});

test('erases a player digit but never a clue (FR-018)', async ({ page }) => {
  await openReadyBoard(page);
  const index = await page.locator('[role="gridcell"][data-origin="empty"]').first().getAttribute('data-index');
  const cell = page.locator(`[data-index="${index}"]`);

  await cell.click();
  await page.keyboard.press('4');
  await expect(cell).toContainText('4');

  await page.keyboard.press('Backspace');
  await expect(cell).toHaveText('');
});

test('changing difficulty produces a fresh board quickly (FR-004, SC-002)', async ({ page }) => {
  await openReadyBoard(page);
  const empty = page.locator('[role="gridcell"][data-origin="empty"]').first();
  await empty.click();
  await page.keyboard.press('3');

  const start = Date.now();
  await page.getByLabel(/difficulty/i).selectOption('hard');
  await expect(page.locator('[role="gridcell"][data-origin="clue"]').first()).toBeVisible();
  expect(Date.now() - start).toBeLessThan(1500);

  // The previous entry is gone: this is a different board.
  await expect(page.locator('[role="gridcell"][data-origin="player"]')).toHaveCount(0);
});

test('ignores digit keys when nothing is selected', async ({ page }) => {
  await openReadyBoard(page);
  await page.keyboard.press('5');
  await expect(page.locator('[role="gridcell"][data-origin="player"]')).toHaveCount(0);
});
