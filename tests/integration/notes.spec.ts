import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** User Story 4 acceptance scenarios, end to end. */

async function openReadyBoard(page: Page) {
  await page.goto('/');
  await page.locator('[role="grid"][aria-busy="false"]').waitFor();
  await page.locator('[role="gridcell"][data-origin="clue"]').first().waitFor();
}

/**
 * An empty cell with at least three empty peers in its row, derived from the
 * live board. Assuming anything about a randomly generated puzzle has been the
 * single biggest source of flaky tests in this feature.
 */
async function findEmptyRowGroup(page: Page) {
  return page.evaluate(() => {
    const cells = Array.from(document.querySelectorAll('[role="gridcell"]'));
    for (let row = 0; row < 9; row++) {
      const empties = cells
        .slice(row * 9, row * 9 + 9)
        .filter((c) => c.getAttribute('data-origin') === 'empty')
        .map((c) => c.getAttribute('data-index')!);
      if (empties.length >= 4) return { target: empties[0]!, peers: empties.slice(1, 4) };
    }
    throw new Error('no row with four empty cells');
  });
}

test('pencils a candidate in notes mode rather than a value (FR-015)', async ({ page }) => {
  await openReadyBoard(page);
  const { target } = await findEmptyRowGroup(page);

  await page.getByRole('switch', { name: /pencil|notes/i }).click();
  await page.locator(`[data-index="${target}"]`).click();
  await page.keyboard.press('4');

  const cell = page.locator(`[data-index="${target}"]`);
  await expect(cell.locator('[data-candidate="4"]')).toBeVisible();
  await expect(cell).toHaveAttribute('data-origin', 'empty');
});

test('a second press of the same digit removes the candidate (FR-016)', async ({ page }) => {
  await openReadyBoard(page);
  const { target } = await findEmptyRowGroup(page);

  await page.getByRole('switch', { name: /pencil|notes/i }).click();
  await page.locator(`[data-index="${target}"]`).click();
  await page.keyboard.press('4');
  await expect(page.locator(`[data-index="${target}"] [data-candidate="4"]`)).toBeVisible();

  await page.keyboard.press('4');
  await expect(page.locator(`[data-index="${target}"] [data-candidate="4"]`)).toHaveCount(0);
});

test('Space and N toggle pencil mode, and the active mode is always visible (FR-013, FR-014)', async ({ page }) => {
  await openReadyBoard(page);
  const toggle = page.getByRole('switch', { name: /pencil|notes/i });
  await expect(toggle).toHaveAttribute('aria-checked', 'false');

  await page.locator('[role="gridcell"]').first().click();
  await page.keyboard.press(' ');
  await expect(toggle).toHaveAttribute('aria-checked', 'true');

  await page.keyboard.press('n');
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
});

test('Space does NOT flip mode while a control holds focus (spec edge case)', async ({ page }) => {
  await openReadyBoard(page);
  const toggle = page.getByRole('switch', { name: /pencil|notes/i });

  await page.getByLabel(/difficulty/i).focus();
  await page.keyboard.press(' ');

  await expect(toggle).toHaveAttribute('aria-checked', 'false');
});

test('committing a digit strips it from peer candidates in one undoable step (FR-023, FR-024)', async ({ page }) => {
  await openReadyBoard(page);
  const { target, peers } = await findEmptyRowGroup(page);

  // Pencil 8 into three peers.
  await page.getByRole('switch', { name: /pencil|notes/i }).click();
  for (const peer of peers) {
    await page.locator(`[data-index="${peer}"]`).click();
    await page.keyboard.press('8');
    await expect(page.locator(`[data-index="${peer}"] [data-candidate="8"]`)).toBeVisible();
  }

  // Commit 8 into the target, back in normal mode.
  await page.getByRole('switch', { name: /pencil|notes/i }).click();
  await page.locator(`[data-index="${target}"]`).click();
  await page.keyboard.press('8');

  await expect(page.locator(`[data-index="${target}"]`)).toContainText('8');
  for (const peer of peers) {
    await expect(page.locator(`[data-index="${peer}"] [data-candidate="8"]`)).toHaveCount(0);
  }
});

test('committing a value clears that cell’s own candidates (FR-017)', async ({ page }) => {
  await openReadyBoard(page);
  const { target } = await findEmptyRowGroup(page);

  await page.getByRole('switch', { name: /pencil|notes/i }).click();
  await page.locator(`[data-index="${target}"]`).click();
  await page.keyboard.press('1');
  await page.keyboard.press('2');

  await page.getByRole('switch', { name: /pencil|notes/i }).click();
  await page.keyboard.press('9');

  const cell = page.locator(`[data-index="${target}"]`);
  await expect(cell).toContainText('9');
  await expect(cell.locator('[data-candidate]')).toHaveCount(0);
});

test('candidates sit in fixed positions, so a missing one reads as a gap (FR-022)', async ({ page }) => {
  await openReadyBoard(page);
  const { target } = await findEmptyRowGroup(page);

  await page.getByRole('switch', { name: /pencil|notes/i }).click();
  await page.locator(`[data-index="${target}"]`).click();
  await page.keyboard.press('1');
  await page.keyboard.press('9');

  const positions = await page.evaluate((i) => {
    const cell = document.querySelector(`[data-index="${i}"]`)!;
    const one = cell.querySelector('[data-candidate="1"]')!.getBoundingClientRect();
    const nine = cell.querySelector('[data-candidate="9"]')!.getBoundingClientRect();
    return { oneLeft: one.left, oneTop: one.top, nineLeft: nine.left, nineTop: nine.top };
  }, target);

  // 1 occupies the top-left of the 3x3 sub-grid, 9 the bottom-right.
  expect(positions.nineLeft).toBeGreaterThan(positions.oneLeft);
  expect(positions.nineTop).toBeGreaterThan(positions.oneTop);
});
