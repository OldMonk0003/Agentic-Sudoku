import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { installFakeHost } from '../support/browserFakeHost';

/**
 * SC-004, in the browser, with a real keyboard.
 *
 * THIS IS THE TEST THE WHOLE STORY EXISTS FOR. The original report was that
 * nothing moves when the agent fills a cell, and the obvious fix -- move the
 * learner's selection there -- was rejected on purpose: if the learner is
 * mid-thought somewhere else, their NEXT KEYPRESS would land in the agent's cell
 * instead of their own.
 *
 * So the agent gets its own spotlight and the learner keeps their selection. The
 * keypress assertion below is what proves that is really what was built, rather
 * than what was intended.
 */

const EXPLANATION = 'Only a nine fits here, because the other eight digits already appear in this box.';

async function call(page: Page, name: string, args: Record<string, unknown> = {}) {
  return page.evaluate(
    ([n, a]) =>
      (window as unknown as { call: (n: string, a: object) => Promise<unknown> }).call(
        n as string,
        a as object,
      ),
    [name, args] as const,
  );
}

/** An empty, non-clue cell that is not the one the learner has selected. */
async function anEmptyCellOtherThan(page: Page, index: number) {
  return page.evaluate((skip) => {
    const cells = document.querySelectorAll('[role="gridcell"]');
    for (let i = 0; i < cells.length; i++) {
      if (i !== skip && !cells[i]!.textContent?.trim()) {
        return { index: i, row: Math.floor(i / 9) + 1, col: (i % 9) + 1 };
      }
    }
    return null;
  }, index);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installFakeHost);
  await page.goto('/');
  await page.waitForSelector('[role="gridcell"]');
});

test('the agent fill is spotlit', async ({ page }) => {
  const target = await anEmptyCellOtherThan(page, -1);
  await call(page, 'fill_cell', { ...target, digit: 9, explanation: EXPLANATION });

  await expect(page.locator('[data-spotlight-focus="true"]')).toHaveCount(1);
  // The band: the cell plus its row, column, and box.
  await expect(page.locator('[data-spotlit="true"]')).toHaveCount(21);
});

test("the learner's crosshair does not move (FR-019)", async ({ page }) => {
  // The learner parks in the bottom-left, far from where the agent will act.
  const learnerCell = page.locator('[data-index="65"]');
  await learnerCell.click();

  const target = await anEmptyCellOtherThan(page, 65);
  await call(page, 'fill_cell', { row: target!.row, col: target!.col, digit: 9, explanation: EXPLANATION });

  await expect(learnerCell).toHaveAttribute('aria-selected', 'true');
});

/*
  The one that matters. If this ever fails, the agent has taken the learner's
  hand and 002/FR-056 is broken.
*/
test("the learner's next keypress lands in THEIR cell (SC-004)", async ({ page }) => {
  const learnerIndex = await page.evaluate(() => {
    const cells = document.querySelectorAll('[role="gridcell"]');
    for (let i = cells.length - 1; i >= 0; i--) {
      if (!cells[i]!.textContent?.trim()) return i;
    }
    return -1;
  });

  await page.locator(`[data-index="${learnerIndex}"]`).click();

  const target = await anEmptyCellOtherThan(page, learnerIndex);
  await call(page, 'fill_cell', { row: target!.row, col: target!.col, digit: 9, explanation: EXPLANATION });

  await page.keyboard.press('5');

  await expect(page.locator(`[data-index="${learnerIndex}"]`)).toContainText('5');
  // And the agent's cell still holds the agent's digit, not the learner's.
  await expect(page.locator(`[data-index="${target!.index}"]`)).toContainText('9');
});

test('keyboard focus is not stolen either (FR-019)', async ({ page }) => {
  await page.locator('[data-index="65"]').click();
  const before = await page.evaluate(() => document.activeElement?.getAttribute('data-index'));

  const target = await anEmptyCellOtherThan(page, 65);
  await call(page, 'fill_cell', { row: target!.row, col: target!.col, digit: 9, explanation: EXPLANATION });

  expect(await page.evaluate(() => document.activeElement?.getAttribute('data-index'))).toBe(before);
});

test('a later fill replaces the spotlight rather than adding one (FR-022)', async ({ page }) => {
  const first = await anEmptyCellOtherThan(page, -1);
  await call(page, 'fill_cell', { row: first!.row, col: first!.col, digit: 9, explanation: EXPLANATION });

  const second = await anEmptyCellOtherThan(page, first!.index);
  await call(page, 'fill_cell', { row: second!.row, col: second!.col, digit: 8, explanation: EXPLANATION });

  await expect(page.locator('[data-spotlight-focus="true"]')).toHaveCount(1);
  await expect(page.locator(`[data-index="${second!.index}"][data-spotlight-focus="true"]`)).toHaveCount(1);
});

test('clear_visual_annotations removes the spotlight (FR-023)', async ({ page }) => {
  const target = await anEmptyCellOtherThan(page, -1);
  await call(page, 'fill_cell', { row: target!.row, col: target!.col, digit: 9, explanation: EXPLANATION });
  await expect(page.locator('[data-spotlit="true"]').first()).toBeVisible();

  await call(page, 'clear_visual_annotations', {
    explanation: 'Clearing my marks so we can look at the next pattern with completely fresh eyes.',
  });

  await expect(page.locator('[data-spotlit="true"]')).toHaveCount(0);
});

test('a whole-board pencil fill raises no spotlight at all', async ({ page }) => {
  await call(page, 'auto_fill_all_pencil_marks', {
    acknowledges_replacing_marks: true,
    explanation: 'Pencilling every legal candidate so that the naked pairs become visible to you.',
  });

  // Sixty spotlit cells would convey nothing. The explanation carries it instead.
  await expect(page.locator('[data-spotlit="true"]')).toHaveCount(0);
});

test('the spotlight is announced without stealing focus (FR-025)', async ({ page }) => {
  const target = await anEmptyCellOtherThan(page, -1);
  await call(page, 'fill_cell', { row: target!.row, col: target!.col, digit: 9, explanation: EXPLANATION });

  const announcement = page.getByTestId('annotation-announcement');
  await expect(announcement).toContainText(new RegExp(`row ${target!.row}`, 'i'));
});
