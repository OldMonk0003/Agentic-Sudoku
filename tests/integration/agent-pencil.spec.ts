import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { openWithAgent, callTool } from '../support/agentPage';

/**
 * User Story 4 end to end: "On a mid-game board, have the agent fill all
 * candidates and then prune a specific one. Confirm correctness against the
 * board's constraints and that each is one undo step."
 *
 * The correctness check is done the way a reviewer would do it by hand -- pick a
 * cell, read its row, column, and box off the DOM, and confirm the candidates
 * offered are exactly the digits none of those contain.
 */

const EXPLANATION = 'Pencilling in every legal candidate so the naked pairs become visible to you.';

async function firstEmptyIndex(page: Page): Promise<number> {
  return Number(
    await page.locator('[role="gridcell"][data-origin="empty"]').first().getAttribute('data-index'),
  );
}

test.beforeEach(async ({ page }) => {
  await openWithAgent(page);
});

test('both bookkeeping tools are registered', async ({ page }) => {
  const names = await page.evaluate(async () =>
    (await document.modelContext!.getTools()).map((t) => t.name),
  );
  expect(names).toEqual(
    expect.arrayContaining(['update_pencil_marks', 'auto_fill_all_pencil_marks']),
  );
});

test('every empty cell gets exactly its legal digits, checked by hand', async ({ page }) => {
  // Read the board BEFORE, so the check is against what was visible.
  const values = await page.evaluate(() =>
    [...document.querySelectorAll('[role="gridcell"]')].map((c) => c.textContent?.trim() || null),
  );

  const result = await callTool(page, 'auto_fill_all_pencil_marks', { explanation: EXPLANATION });
  expect(result.ok).toBe(true);

  const index = await firstEmptyIndex(page);
  const row = Math.floor(index / 9);
  const col = index % 9;

  // Everything the learner can see in this cell's row, column, and box.
  const taken = new Set<string>();
  for (let i = 0; i < 9; i++) {
    if (values[row * 9 + i]) taken.add(values[row * 9 + i]!);
    if (values[i * 9 + col]) taken.add(values[i * 9 + col]!);
  }
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      if (values[r * 9 + c]) taken.add(values[r * 9 + c]!);
    }
  }
  const expected = ['1', '2', '3', '4', '5', '6', '7', '8', '9'].filter((d) => !taken.has(d));

  const rendered = await page.evaluate((i: number) =>
    [...document.querySelectorAll(`[data-index="${i}"] [data-candidate]`)].map(
      (el) => el.getAttribute('data-candidate')!,
    ),
    index,
  );

  expect(rendered.sort()).toEqual(expected.sort());
});

test('the whole board fill is ONE undo step (FR-043)', async ({ page }) => {
  await callTool(page, 'auto_fill_all_pencil_marks', { explanation: EXPLANATION });
  await expect(page.locator('[data-candidate]').first()).toBeVisible();

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('[data-candidate]')).toHaveCount(0);
});

test('no filled cell is touched', async ({ page }) => {
  const clueIndex = await page
    .locator('[role="gridcell"][data-origin="clue"]')
    .first()
    .getAttribute('data-index');
  const clue = page.locator(`[data-index="${clueIndex}"]`);
  const before = await clue.textContent();

  await callTool(page, 'auto_fill_all_pencil_marks', { explanation: EXPLANATION });

  await expect(clue).toHaveText(before!);
  expect(await clue.locator('[data-candidate]').count()).toBe(0);
});

test('the learner"s own marks are protected until the agent admits it (FR-041)', async ({ page }) => {
  // The learner pencils a 3 by hand.
  const index = await firstEmptyIndex(page);
  await page.locator(`[data-index="${index}"]`).click();
  await page.getByRole('switch', { name: 'Pencil notes' }).click();
  await page.keyboard.press('3');
  await expect(page.locator(`[data-index="${index}"] [data-candidate="3"]`)).toHaveCount(1);

  // The agent tries to overwrite them without saying so.
  const refused = await callTool(page, 'auto_fill_all_pencil_marks', { explanation: EXPLANATION });
  expect(refused.ok).toBe(false);
  expect(refused.error!.code).toBe('acknowledgement-required');

  // Their mark is exactly as they left it.
  await expect(page.locator(`[data-index="${index}"] [data-candidate]`)).toHaveCount(1);

  // Acknowledged, it proceeds -- and one undo gives their mark back.
  const accepted = await callTool(page, 'auto_fill_all_pencil_marks', {
    acknowledges_replacing_marks: true,
    explanation: 'Replacing the marks you wrote by hand with the full set of legal candidates.',
  });
  expect(accepted.ok).toBe(true);
  expect(accepted.data!.hand_written_marks_replaced).toBe(1);

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator(`[data-index="${index}"] [data-candidate]`)).toHaveCount(1);
  await expect(page.locator(`[data-index="${index}"] [data-candidate="3"]`)).toHaveCount(1);
});

test('update_pencil_marks changes only the cells it names', async ({ page }) => {
  const index = await firstEmptyIndex(page);
  const other = await page.evaluate((i: number) => {
    const cells = [...document.querySelectorAll('[role="gridcell"][data-origin="empty"]')];
    return Number(cells.find((c) => Number(c.getAttribute('data-index')) !== i)!.getAttribute('data-index'));
  }, index);

  const result = await callTool(page, 'update_pencil_marks', {
    cells: [{ row: Math.floor(index / 9) + 1, col: (index % 9) + 1, digits: [1, 2] }],
    explanation: 'Narrowing this cell to the only two digits its row and column still permit.',
  });
  expect(result.ok).toBe(true);

  await expect(page.locator(`[data-index="${index}"] [data-candidate]`)).toHaveCount(2);
  await expect(page.locator(`[data-index="${other}"] [data-candidate]`)).toHaveCount(0);
});

test('agent-written candidates are visibly the agent"s (FR-044)', async ({ page }) => {
  const index = await firstEmptyIndex(page);
  await callTool(page, 'update_pencil_marks', {
    cells: [{ row: Math.floor(index / 9) + 1, col: (index % 9) + 1, digits: [1, 2] }],
    explanation: 'Narrowing this cell to the only two digits its row and column still permit.',
  });

  await expect(page.locator(`[data-index="${index}"] [data-agent-candidates]`)).toHaveCount(1);
});

test('a batch with one bad cell changes nothing on screen', async ({ page }) => {
  const index = await firstEmptyIndex(page);
  const clueIndex = Number(
    await page.locator('[role="gridcell"][data-origin="clue"]').first().getAttribute('data-index'),
  );

  const result = await callTool(page, 'update_pencil_marks', {
    cells: [
      { row: Math.floor(index / 9) + 1, col: (index % 9) + 1, digits: [1, 2] },
      { row: Math.floor(clueIndex / 9) + 1, col: (clueIndex % 9) + 1, digits: [3] },
    ],
    explanation: 'Narrowing these cells to the digits their rows and columns still permit.',
  });

  expect(result.ok).toBe(false);
  await expect(page.locator('[data-candidate]')).toHaveCount(0);
});
