import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { openWithAgent, callTool, toolNames } from '../support/agentPage';

/**
 * Principle V requires "at least one integration test exercising a full
 * human-and-agent collaborative session: agent tool call -> State mutation ->
 * rendered view, including undo."
 *
 * This is that test, and it is also User Story 2's independent test: a fill
 * cannot be requested without an explanation, the explanation surfaces on
 * screen, the digit is marked as the agent's, and one undo removes it.
 */

const EXPLANATION = 'Only 7 can go here, because the other eight digits already appear in this box.';

/** An empty, non-clue cell, returned as both coordinate and stable index. */
async function anEmptyCell(page: Page) {
  const index = Number(
    await page.locator('[role="gridcell"][data-origin="empty"]').first().getAttribute('data-index'),
  );
  return { index, row: Math.floor(index / 9) + 1, col: (index % 9) + 1 };
}

test.beforeEach(async ({ page }) => {
  await openWithAgent(page);
});

test('fill_cell is registered in the browser', async ({ page }) => {
  expect(await toolNames(page)).toContain('fill_cell');
});

test('agent call -> state -> rendered view -> one undo', async ({ page }) => {
  const { index, row, col } = await anEmptyCell(page);
  const cell = page.locator(`[data-index="${index}"]`);

  const result = await callTool(page, 'fill_cell', { row, col, digit: 7, explanation: EXPLANATION });
  expect(result.ok).toBe(true);

  // Rendered.
  await expect(cell).toHaveText('7');
  await expect(cell).toHaveAttribute('data-origin', 'agent');

  // Narrated, in the same breath.
  await expect(page.getByTestId('explanation')).toContainText(EXPLANATION);

  // And undone by the learner's ordinary Undo control, once.
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(cell).toHaveText('');
  await expect(cell).toHaveAttribute('data-origin', 'empty');
});

test('the agent"s digit is distinguishable without interaction (FR-044)', async ({ page }) => {
  const { index, row, col } = await anEmptyCell(page);
  await callTool(page, 'fill_cell', { row, col, digit: 7, explanation: EXPLANATION });

  const cell = page.locator(`[data-index="${index}"]`);
  // Two cues, neither of them colour: a corner glyph and italic type.
  await expect(cell.locator('[data-agent-placed]')).toHaveCount(1);
  expect(await cell.evaluate((el) => getComputedStyle(el).fontStyle)).toBe('italic');
});

test('an agent digit stays visibly the agent"s even when it is WRONG', async ({ page }) => {
  /*
    This found a real defect. `inkClass` returned early on conflict, which
    dropped the italic from a conflicted agent digit -- exactly the case where
    authorship matters most, because FR-038 lets the tutor be wrong on purpose so
    the learner can check it. Colour now says whether the digit conflicts; slant
    says who wrote it; neither erases the other.
  */
  const first = await anEmptyCell(page);
  await callTool(page, 'fill_cell', {
    row: first.row, col: first.col, digit: 5,
    explanation: 'Placing a five here to begin with, so we can look at a duplicate next.',
  });

  const secondIndex = await page.evaluate((firstIdx: number) => {
    const row = Math.floor(firstIdx / 9);
    for (let col = 0; col < 9; col++) {
      const i = row * 9 + col;
      if (i === firstIdx) continue;
      if (document.querySelector(`[data-index="${i}"]`)?.getAttribute('data-origin') === 'empty') return i;
    }
    return -1;
  }, first.index);
  if (secondIndex < 0) test.skip();

  await callTool(page, 'fill_cell', {
    row: Math.floor(secondIndex / 9) + 1, col: (secondIndex % 9) + 1, digit: 5,
    explanation: 'Placing a second five in this row on purpose, so you can see me be wrong.',
  });

  const wrong = page.locator(`[data-index="${secondIndex}"]`);
  await expect(wrong).toHaveAttribute('data-conflict', 'true');

  // Both cues survive: the conflict ink AND the authorship slant and glyph.
  expect(await wrong.evaluate((el) => getComputedStyle(el).fontStyle)).toBe('italic');
  await expect(wrong.locator('[data-agent-placed]')).toHaveCount(1);
  await expect(wrong.locator('[data-conflict-marker]')).toHaveCount(1);
});

test('a fill with no explanation changes nothing at all (SC-002, SC-003)', async ({ page }) => {
  const { index, row, col } = await anEmptyCell(page);

  const result = await callTool(page, 'fill_cell', { row, col, digit: 7 });

  expect(result.ok).toBe(false);
  expect(result.error!.code).toBe('explanation-required');
  await expect(page.locator(`[data-index="${index}"]`)).toHaveText('');
  await expect(page.getByTestId('explanation')).toHaveCount(0);
});

test('the agent may be wrong, and the conflict shows (FR-038)', async ({ page }) => {
  // Place a digit, then place the same digit again in the same row.
  const first = await anEmptyCell(page);
  await callTool(page, 'fill_cell', { row: first.row, col: first.col, digit: 5, explanation: EXPLANATION });

  const secondIndex = await page.evaluate((firstIdx: number) => {
    const row = Math.floor(firstIdx / 9);
    for (let col = 0; col < 9; col++) {
      const i = row * 9 + col;
      if (i === firstIdx) continue;
      const el = document.querySelector(`[data-index="${i}"]`);
      if (el?.getAttribute('data-origin') === 'empty') return i;
    }
    return -1;
  }, first.index);

  if (secondIndex < 0) test.skip();

  const result = await callTool(page, 'fill_cell', {
    row: Math.floor(secondIndex / 9) + 1,
    col: (secondIndex % 9) + 1,
    digit: 5,
    explanation: 'Placing a second five in this row on purpose, so you can see me be wrong.',
  });

  // Permitted, and reported. A tutor whose errors are invisible cannot be checked.
  expect(result.ok).toBe(true);
  expect(result.data!.created_conflict).toBe(true);
  await expect(page.locator(`[data-index="${secondIndex}"][data-conflict="true"]`)).toHaveCount(1);
});

test('the learner"s selection never moves (FR-056)', async ({ page }) => {
  const parked = await anEmptyCell(page);
  await page.locator(`[data-index="${parked.index}"]`).click();

  const other = await page.evaluate((parkedIdx: number) => {
    const cells = [...document.querySelectorAll('[role="gridcell"][data-origin="empty"]')];
    const found = cells.find((c) => Number(c.getAttribute('data-index')) !== parkedIdx);
    return Number(found!.getAttribute('data-index'));
  }, parked.index);

  await callTool(page, 'fill_cell', {
    row: Math.floor(other / 9) + 1,
    col: (other % 9) + 1,
    digit: 3,
    explanation: EXPLANATION,
  });

  await expect(page.locator(`[data-index="${parked.index}"]`)).toHaveAttribute('data-selected', 'true');
  await expect(page.locator('[data-selected="true"]')).toHaveCount(1);
});

test('a rejected fill leaves the board and the queue untouched', async ({ page }) => {
  const clueIndex = await page
    .locator('[role="gridcell"][data-origin="clue"]')
    .first()
    .getAttribute('data-index');
  const clue = page.locator(`[data-index="${clueIndex}"]`);
  const before = await clue.textContent();

  const result = await callTool(page, 'fill_cell', {
    row: Math.floor(Number(clueIndex) / 9) + 1,
    col: (Number(clueIndex) % 9) + 1,
    digit: 1,
    explanation: EXPLANATION,
  });

  expect(result.ok).toBe(false);
  expect(result.error!.code).toBe('cell-is-clue');
  await expect(clue).toHaveText(before!);
  await expect(page.getByTestId('explanation')).toHaveCount(0);
});

test('agent authorship survives a reload (FR-044, 001/FR-041)', async ({ page }) => {
  const { index, row, col } = await anEmptyCell(page);
  await callTool(page, 'fill_cell', { row, col, digit: 7, explanation: EXPLANATION });
  await expect(page.locator(`[data-index="${index}"]`)).toHaveAttribute('data-origin', 'agent');

  // Persistence is debounced ~250 ms. Reloading before it flushes finds nothing
  // stored, generates a fresh puzzle, and tests something else entirely -- so
  // wait for the write rather than for a duration.
  await page.waitForFunction(() =>
    (localStorage.getItem('agentic-sudoku/session') ?? '').includes('"origins"'),
  );
  await page.waitForFunction(
    (i: number) => {
      const raw = localStorage.getItem('agentic-sudoku/session');
      if (!raw) return false;
      return JSON.parse(raw).origins[i] === 'a';
    },
    index,
  );

  await page.reload();
  await page.locator('[role="grid"][aria-busy="false"]').waitFor();

  // The digit and WHO PLACED IT are restored; the explanation is not (FR-034).
  await expect(page.locator(`[data-index="${index}"]`)).toHaveAttribute('data-origin', 'agent');
  await expect(page.getByTestId('explanation')).toHaveCount(0);
});
