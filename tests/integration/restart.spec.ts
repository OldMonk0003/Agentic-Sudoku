import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * The learner's Restart control, end to end (005/US1).
 *
 * The thing worth testing here is the one most easily got wrong: "restart" means
 * A DIFFERENT PUZZLE AT THE SAME LEVEL. Most games restart the level you are on;
 * this one hands you a new grid. A test that only checked "the board changed"
 * would pass for both readings.
 *
 * No agent is involved anywhere in this file. That is the point of US1 -- it is
 * an ordinary game control and works with no WebMCP host present (FR-007).
 */

const restart = (page: Page) => page.getByRole('button', { name: /restart/i });

/** The clue layout currently on screen, as a signature. */
async function grid(page: Page): Promise<string> {
  return page.evaluate(() =>
    [...document.querySelectorAll('[role="gridcell"]')]
      .map((cell) => (cell.getAttribute('data-origin') === 'clue' ? cell.textContent?.trim() || '.' : '.'))
      .join(''),
  );
}

async function settled(page: Page): Promise<void> {
  await expect(page.locator('[role="grid"]')).not.toHaveAttribute('aria-busy', 'true');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await settled(page);
});

test('the control is present with no agent connected', async ({ page }) => {
  // FR-007. It is a game control, not an agent affordance.
  await expect(restart(page)).toBeVisible();
  await expect(page.getByTestId('agent-badge')).toHaveCount(0);
});

test('it presents a different puzzle', async ({ page }) => {
  const before = await grid(page);

  await restart(page).click();
  await settled(page);

  // FR-002, SC-003. Not the same grid with entries wiped -- a different grid.
  expect(await grid(page)).not.toBe(before);
});

test('it keeps the difficulty it was already on', async ({ page }) => {
  await page.getByLabel('Difficulty').selectOption('medium');
  await settled(page);

  await restart(page).click();
  await settled(page);

  // FR-003. This is what separates a restart from a difficulty change.
  await expect(page.getByLabel('Difficulty')).toHaveValue('medium');
});

test('it resets the clock and clears the undo history', async ({ page }) => {
  const board = page.locator('[role="grid"]');
  await board.locator('[data-origin="empty"]').first().click();
  await page.keyboard.press('1');
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();

  await restart(page).click();
  await settled(page);

  // FR-005, inherited from 001/FR-004 and FR-033.
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
  await expect(page.getByTestId('timer')).toHaveText(/00:0[0-2]/);
});

test('it asks for no confirmation, even with progress on the board', async ({ page }) => {
  const board = page.locator('[role="grid"]');
  await board.locator('[data-origin="empty"]').first().click();
  await page.keyboard.press('5');

  await restart(page).click();

  // FR-006: pressing it IS the decision. Nothing to dismiss, nothing to confirm.
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await settled(page);
});

test('pressing it repeatedly settles on one board and never shows a half-drawn grid', async ({ page }) => {
  // 001's rapid-difficulty-switching edge case, which restart inherits.
  await restart(page).click();
  await restart(page).click();
  await restart(page).click();
  await settled(page);

  // Exactly 81 cells, and a legal number of clues -- not a partially generated board.
  await expect(page.locator('[role="gridcell"]')).toHaveCount(81);
  const clues = await page.locator('[data-origin="clue"]').count();
  expect(clues).toBeGreaterThan(16);
  expect(clues).toBeLessThan(50);
});

test('the learner is never locked out while it generates', async ({ page }) => {
  // FR-011. The board may be busy, but the page must never stop responding.
  await restart(page).click();
  await expect(restart(page)).toBeEnabled();
  await settled(page);
});
