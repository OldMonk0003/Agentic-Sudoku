import { test, expect } from '@playwright/test';
import { openWithAgent, callTool } from '../support/agentPage';

/**
 * FR-059 and Principle II: "No tool may cause a network request, and no board or
 * learner data may leave the device through the agent surface."
 *
 * Exercised across the WHOLE surface rather than a sample, and including the
 * drill loader -- the one tool that might plausibly have wanted to fetch
 * something.
 */

test('not one request leaves the page across the entire agent surface', async ({ page }) => {
  await openWithAgent(page);

  const afterLoad: string[] = [];
  page.on('request', (request) => afterLoad.push(`${request.method()} ${request.url()}`));

  const index = Number(
    await page.locator('[role="gridcell"][data-origin="empty"]').first().getAttribute('data-index'),
  );
  const row = Math.floor(index / 9) + 1;
  const col = (index % 9) + 1;
  const explanation = 'A perfectly ordinary explanation, long enough to satisfy the contract.';

  await callTool(page, 'get_board_state');
  await callTool(page, 'check_for_conflicts');
  await callTool(page, 'highlight_pattern_cells', { target_cells: [{ row, col }], explanation });
  await callTool(page, 'show_pattern_hint_toast', { explanation });
  await callTool(page, 'draw_constraint_beams', { beams: [{ unit_type: 'row', unit_number: row }], explanation });
  await callTool(page, 'fill_cell', { row, col, digit: 7, explanation });
  // Feature 003's ruler and clock tools. Order-insensitive, so they sit here.
  await callTool(page, 'show_coordinate_ruler', { explanation });
  await callTool(page, 'hide_coordinate_ruler', { explanation });
  await callTool(page, 'pause_timer', { explanation });
  await callTool(page, 'resume_timer', { explanation });

  await callTool(page, 'update_pencil_marks', {
    cells: [{ row: row === 9 ? 1 : row + 1, col, digits: [1, 2] }],
    explanation,
  });
  await callTool(page, 'auto_fill_all_pencil_marks', {
    acknowledges_replacing_marks: true,
    explanation,
  });
  await callTool(page, 'clear_visual_annotations', { explanation });

  const drill = callTool(page, 'load_technique_practice', { technique: 'naked-pair', explanation });
  await page.getByRole('button', { name: 'Load drill' }).click();
  await drill;

  /*
    `switch_difficulty` last, and ANSWERED rather than awaited blind.

    It generates a whole new puzzle, which is the most plausible place a network
    request could ever creep in -- so it belongs in this sweep more than most.
    But by now the board has progress on it, so it raises a confirmation and
    waits up to a minute for a human. Awaiting it without answering would hang
    the test for the tool behaving exactly as FR-030 requires.
  */
  const switching = callTool(page, 'switch_difficulty', { difficulty: 'medium', explanation });

  // Whether it asks depends on whether the drill left progress behind, so
  // answer only if a banner actually appears rather than assuming either way.
  const banner = page.getByRole('button', { name: /switch puzzle/i });
  await banner.click({ timeout: 2000 }).catch(() => {});

  expect((await switching).ok).toBe(true);

  expect(afterLoad, `unexpected requests: ${afterLoad.join(', ')}`).toEqual([]);
});

test('no tool result carries the puzzle solution (FR-026, FR-058)', async ({ page }) => {
  await openWithAgent(page);

  const board = await callTool(page, 'get_board_state');
  const serialised = JSON.stringify(board);

  expect(serialised).not.toMatch(/\d{40,}/);
  expect(serialised.toLowerCase()).not.toContain('solution');
  expect(serialised.toLowerCase()).not.toContain('"answer"');
});

test('nothing about the agent reaches localStorage (FR-034)', async ({ page }) => {
  await openWithAgent(page);
  const index = Number(
    await page.locator('[role="gridcell"][data-origin="empty"]').first().getAttribute('data-index'),
  );

  await callTool(page, 'fill_cell', {
    row: Math.floor(index / 9) + 1,
    col: (index % 9) + 1,
    digit: 7,
    explanation: 'An explanation that must never survive to the next page load at all.',
  });
  await callTool(page, 'highlight_pattern_cells', {
    target_cells: [{ row: 1, col: 1 }],
    explanation: 'A highlight that must never survive to the next page load at all.',
  });

  // Wait for the debounced write, then inspect what was actually stored.
  await page.waitForFunction(() => localStorage.getItem('agentic-sudoku/session') !== null);
  const stored = (await page.evaluate(() => localStorage.getItem('agentic-sudoku/session')))!;

  for (const forbidden of ['explanation', 'annotation', 'highlight', 'never survive', 'toast']) {
    expect(stored.toLowerCase(), `stored payload mentions "${forbidden}"`).not.toContain(forbidden);
  }
  // Authorship DOES survive -- that is 001's schema, and FR-044 needs it.
  expect(JSON.parse(stored).origins).toContain('a');
});
