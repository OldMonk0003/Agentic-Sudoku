import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** User Story 3 acceptance scenarios, end to end. */

async function openReadyBoard(page: Page) {
  await page.goto('/');
  await page.locator('[role="grid"][aria-busy="false"]').waitFor();
  await page.locator('[role="gridcell"][data-origin="clue"]').first().waitFor();
}

/**
 * Place a digit that duplicates a clue in the same row, and return both indices.
 * Derived from the live board rather than assumed -- assuming things about a
 * randomly generated puzzle has been the single biggest source of flaky tests
 * in this feature.
 */
async function createRowConflict(page: Page) {
  return page.evaluate(() => {
    const cells = Array.from(document.querySelectorAll('[role="gridcell"]'));
    for (let row = 0; row < 9; row++) {
      const inRow = cells.slice(row * 9, row * 9 + 9);
      const clue = inRow.find((c) => c.getAttribute('data-origin') === 'clue');
      const empty = inRow.find((c) => c.getAttribute('data-origin') === 'empty');
      if (clue && empty) {
        return {
          clueIndex: clue.getAttribute('data-index')!,
          emptyIndex: empty.getAttribute('data-index')!,
          digit: clue.textContent!.trim(),
        };
      }
    }
    throw new Error('no row with both a clue and an empty cell');
  });
}

test('flags BOTH cells when a duplicate is placed in a row (FR-025)', async ({ page }) => {
  await openReadyBoard(page);
  const { clueIndex, emptyIndex, digit } = await createRowConflict(page);

  await page.locator(`[data-index="${emptyIndex}"]`).click();
  await page.keyboard.press(digit);

  await expect(page.locator(`[data-index="${emptyIndex}"]`)).toHaveAttribute('data-conflict', 'true');
  await expect(page.locator(`[data-index="${clueIndex}"]`)).toHaveAttribute('data-conflict', 'true');
});

test('clears both markings when the conflict is resolved (FR-028)', async ({ page }) => {
  await openReadyBoard(page);
  const { clueIndex, emptyIndex, digit } = await createRowConflict(page);

  await page.locator(`[data-index="${emptyIndex}"]`).click();
  await page.keyboard.press(digit);
  await expect(page.locator(`[data-index="${emptyIndex}"]`)).toHaveAttribute('data-conflict', 'true');

  await page.keyboard.press('Backspace');

  await expect(page.locator(`[data-index="${emptyIndex}"]`)).toHaveAttribute('data-conflict', 'false');
  await expect(page.locator(`[data-index="${clueIndex}"]`)).toHaveAttribute('data-conflict', 'false');
});

test('does NOT block play while a conflict stands (FR-027)', async ({ page }) => {
  await openReadyBoard(page);
  const { emptyIndex, digit } = await createRowConflict(page);

  await page.locator(`[data-index="${emptyIndex}"]`).click();
  await page.keyboard.press(digit);

  // No dialog, and another cell still accepts input.
  await expect(page.locator('dialog')).toHaveCount(0);
  await expect(page.locator('[aria-modal="true"]')).toHaveCount(0);

  const other = page.locator('[role="gridcell"][data-origin="empty"]').first();
  const otherIndex = await other.getAttribute('data-index');
  await other.click();
  await page.keyboard.press('1');
  await expect(page.locator(`[data-index="${otherIndex}"]`)).toContainText('1');
});

test('marks a conflict with a NON-COLOUR cue as well as the wash (FR-026)', async ({ page }) => {
  await openReadyBoard(page);
  const { emptyIndex, digit } = await createRowConflict(page);

  await page.locator(`[data-index="${emptyIndex}"]`).click();
  await page.keyboard.press(digit);

  const hasMarker = await page.evaluate((i) => {
    const cell = document.querySelector(`[data-index="${i}"]`) as HTMLElement;
    const marker = cell.querySelector('[data-conflict-marker]');
    return marker !== null && getComputedStyle(marker).display !== 'none';
  }, emptyIndex);

  expect(hasMarker).toBe(true);
});

test('a clue in a conflict stays uneditable — only the player digit can resolve it', async ({ page }) => {
  await openReadyBoard(page);
  const { clueIndex, emptyIndex, digit } = await createRowConflict(page);

  await page.locator(`[data-index="${emptyIndex}"]`).click();
  await page.keyboard.press(digit);

  const before = await page.locator(`[data-index="${clueIndex}"]`).textContent();
  await page.locator(`[data-index="${clueIndex}"]`).click();
  await page.keyboard.press('Backspace');

  await expect(page.locator(`[data-index="${clueIndex}"]`)).toHaveText(before ?? '');
});
