import { test, expect } from '@playwright/test';
import { openWithAgent, callTool, toolNames, boardFingerprint } from '../support/agentPage';

/**
 * User Story 1 end to end: the agent perceives the board, points at a pattern,
 * and changes nothing.
 *
 * This is the slice's independent test from the spec: "With only the read and
 * annotation tools registered, ask an agent to explain the next move on a
 * mid-game board. Confirm it can describe the position accurately, direct
 * attention to the right cells, and leave every digit and candidate untouched."
 */

const EXPLANATION =
  'Only this cell in the box can still take a seven; its row and column rule out every other candidate.';

test.beforeEach(async ({ page }) => {
  await openWithAgent(page);
});

test('the read and annotation tools are registered in the browser', async ({ page }) => {
  // Containment, not equality. The surface GROWS every slice by design, so the
  // exact list lives in exactly one place -- tests/unit/tools.surface.test.ts --
  // and each slice's spec asserts only what that slice added.
  expect(await toolNames(page)).toEqual(
    expect.arrayContaining([
      'get_board_state',
      'check_for_conflicts',
      'highlight_pattern_cells',
      'show_pattern_hint_toast',
      'clear_visual_annotations',
    ]),
  );
});

test('the agent can read the board it is looking at', async ({ page }) => {
  const result = await callTool(page, 'get_board_state');

  expect(result.ok).toBe(true);
  const cells = result.data!.cells as { value: number | null; origin: string | null }[];
  expect(cells).toHaveLength(81);

  // What the agent is told matches what is on screen.
  const renderedClues = await page.locator('[role="gridcell"][data-origin="clue"]').count();
  expect(cells.filter((c) => c.origin === 'clue')).toHaveLength(renderedClues);
});

test('a highlight marks target and because cells differently, and changes nothing', async ({ page }) => {
  const before = await boardFingerprint(page);

  const result = await callTool(page, 'highlight_pattern_cells', {
    target_cells: [{ row: 5, col: 6 }],
    because_cells: [{ row: 5, col: 1 }, { row: 5, col: 3 }],
    explanation: EXPLANATION,
  });
  expect(result.ok).toBe(true);

  await expect(page.locator('[data-agent-annotation="target"]')).toHaveCount(1);
  await expect(page.locator('[data-agent-annotation="because"]')).toHaveCount(2);

  // FR-034: not a digit, not a candidate, not the timer, not undo depth.
  expect(await boardFingerprint(page)).toBe(before);
});

test('the explanation appears on screen, attributed to the agent (FR-017)', async ({ page }) => {
  await callTool(page, 'highlight_pattern_cells', {
    target_cells: [{ row: 5, col: 6 }],
    explanation: EXPLANATION,
  });

  const explanation = page.getByTestId('explanation');
  await expect(explanation).toHaveCount(1);
  await expect(explanation).toContainText(EXPLANATION);
  await expect(explanation).toHaveAttribute('data-tool', 'highlight_pattern_cells');
});

test('a highlight without an explanation changes nothing at all (SC-003)', async ({ page }) => {
  const result = await callTool(page, 'highlight_pattern_cells', {
    target_cells: [{ row: 5, col: 6 }],
  });

  expect(result.ok).toBe(false);
  expect(result.error!.code).toBe('explanation-required');
  await expect(page.locator('[data-agent-annotation]')).toHaveCount(0);
  await expect(page.getByTestId('explanation')).toHaveCount(0);
});

test("the learner's own crosshair still works, and stays theirs (FR-032)", async ({ page }) => {
  await callTool(page, 'highlight_pattern_cells', {
    target_cells: [{ row: 5, col: 6 }],
    because_cells: [{ row: 5, col: 1 }],
    explanation: EXPLANATION,
  });

  await page.locator('[data-index="40"]').click();

  // Their selection is a ring; the agent's marks are outlines and hatching.
  await expect(page.locator('[data-selected="true"]')).toHaveCount(1);
  await expect(page.locator('[data-tier="crosshair"]').first()).toBeVisible();
  await expect(page.locator('[data-agent-annotation]')).toHaveCount(2);
});

test('the coaching toast appears and can be dismissed by the learner', async ({ page }) => {
  await callTool(page, 'show_pattern_hint_toast', {
    explanation: 'Look for a digit with only one home left in a box. That is a hidden single.',
  });

  const toast = page.getByTestId('agent-toast');
  await expect(toast).toBeVisible();
  await expect(toast).toContainText('hidden single');

  await page.getByRole('button', { name: 'Dismiss hint' }).click();
  await expect(toast).toHaveCount(0);
});

test('clearing returns the board to its unannotated appearance, game state intact', async ({ page }) => {
  const before = await boardFingerprint(page);

  await callTool(page, 'highlight_pattern_cells', {
    target_cells: [{ row: 5, col: 6 }],
    because_cells: [{ row: 5, col: 1 }],
    explanation: EXPLANATION,
  });
  await callTool(page, 'show_pattern_hint_toast', {
    explanation: 'Look for a digit with only one home left in a box. That is a hidden single.',
  });
  await expect(page.locator('[data-agent-annotation]')).toHaveCount(2);

  const cleared = await callTool(page, 'clear_visual_annotations', {
    explanation: 'Clearing my marks so we can look at the next pattern with fresh eyes.',
  });

  expect(cleared.ok).toBe(true);
  await expect(page.locator('[data-agent-annotation]')).toHaveCount(0);
  await expect(page.getByTestId('agent-toast')).toHaveCount(0);
  expect(await boardFingerprint(page)).toBe(before);

  // But its OWN narration survives -- otherwise the board would change with no
  // stated reason, which is exactly what the narration contract forbids. The
  // earlier highlight's explanation survives too: clearing removes MARKS, not
  // the record of what the agent said.
  await expect(page.locator('[data-tool="clear_visual_annotations"]')).toContainText('fresh eyes');
});

test('agent text is never interpreted as markup (FR-021)', async ({ page }) => {
  await callTool(page, 'show_pattern_hint_toast', {
    explanation: '<img src=x onerror=alert(1)> and a [link](http://evil.example) for good measure',
  });

  const toast = page.getByTestId('agent-toast');
  await expect(toast).toContainText('<img src=x onerror=alert(1)>');
  expect(await toast.locator('img').count()).toBe(0);
  expect(await page.locator('a').count()).toBe(0);
});

test('the learner can keep playing while the agent talks (SC-007, FR-018)', async ({ page }) => {
  const index = await page
    .locator('[role="gridcell"][data-origin="empty"]')
    .first()
    .getAttribute('data-index');
  const cell = page.locator(`[data-index="${index}"]`);
  await cell.click();

  for (let i = 0; i < 3; i++) {
    await callTool(page, 'highlight_pattern_cells', {
      target_cells: [{ row: 1, col: (i % 9) + 1 }],
      explanation: `${EXPLANATION} Number ${i}.`,
    });
  }

  // Focus never moved, and the keystroke lands.
  await page.keyboard.press('5');
  await expect(cell).toHaveText('5');
  await expect(page.locator('[role="gridcell"]:focus')).toHaveCount(1);
});

test('annotations are not restored after a reload (FR-034)', async ({ page }) => {
  await callTool(page, 'highlight_pattern_cells', {
    target_cells: [{ row: 5, col: 6 }],
    explanation: EXPLANATION,
  });
  await expect(page.locator('[data-agent-annotation]')).toHaveCount(1);

  await page.reload();
  await page.locator('[role="grid"][aria-busy="false"]').waitFor();

  await expect(page.locator('[data-agent-annotation]')).toHaveCount(0);
  await expect(page.getByTestId('explanation')).toHaveCount(0);
});
