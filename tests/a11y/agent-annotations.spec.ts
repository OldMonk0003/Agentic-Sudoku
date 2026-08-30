import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openWithAgent, callTool } from '../support/agentPage';

/**
 * FR-060 and SC-011: "Agent activity MUST be perceivable to a learner using
 * assistive technology on equal terms with a sighted learner, including which
 * cells were annotated and what changed" -- and SC-011 adds "without focus ever
 * being taken from where they were working".
 *
 * Two mechanisms, deliberately redundant, because they serve different
 * navigation styles: an ANNOUNCEMENT for a learner listening, and the cell's own
 * LABEL for a learner arrowing across the board.
 */

const EXPLANATION =
  'Only this cell in the box can still take a seven; its row and column rule out every other candidate.';

test.beforeEach(async ({ page }) => {
  await openWithAgent(page);
});

test('axe finds no violation with annotations, an explanation, and a toast on screen', async ({ page }) => {
  await callTool(page, 'highlight_pattern_cells', {
    target_cells: [{ row: 5, col: 6 }],
    because_cells: [{ row: 5, col: 1 }, { row: 5, col: 3 }],
    explanation: EXPLANATION,
  });
  await callTool(page, 'show_pattern_hint_toast', {
    explanation: 'Look for a digit with only one home left in a box. That is a hidden single.',
  });

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('axe finds no violation at a 360px viewport', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await callTool(page, 'highlight_pattern_cells', {
    target_cells: [{ row: 5, col: 6 }],
    explanation: EXPLANATION,
  });

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('the annotated cells are announced, naming their coordinates and roles', async ({ page }) => {
  await callTool(page, 'highlight_pattern_cells', {
    target_cells: [{ row: 5, col: 6 }],
    because_cells: [{ row: 5, col: 1 }],
    explanation: EXPLANATION,
  });

  const announcement = page.locator('[role="status"][aria-live="polite"]', {
    hasText: 'Agent highlighted',
  });
  await expect(announcement).toContainText('row 5 column 6');
  await expect(announcement).toContainText('row 5 column 1');
});

test("each annotated cell carries its role in its OWN label, for a learner arrowing the board", async ({ page }) => {
  await callTool(page, 'highlight_pattern_cells', {
    target_cells: [{ row: 5, col: 6 }],
    because_cells: [{ row: 5, col: 1 }],
    explanation: EXPLANATION,
  });

  // Index = (row - 1) * 9 + (col - 1). Row 5 col 6 -> 41; row 5 col 1 -> 36.
  await expect(page.locator('[data-index="41"]')).toHaveAttribute('aria-label', /agent target/);
  await expect(page.locator('[data-index="36"]')).toHaveAttribute('aria-label', /agent reason/);
});

test('no annotation is focusable or in the tab order', async ({ page }) => {
  await callTool(page, 'highlight_pattern_cells', {
    target_cells: [{ row: 5, col: 6 }],
    because_cells: [{ row: 5, col: 1 }],
    explanation: EXPLANATION,
  });

  const layer = page.getByTestId('annotation-layer');
  await expect(layer).toHaveAttribute('aria-hidden', 'true');
  expect(await layer.locator('[tabindex]').count()).toBe(0);
  expect(await layer.locator('button, a, input').count()).toBe(0);
});

test('the overlay never intercepts a click meant for a cell', async ({ page }) => {
  await callTool(page, 'highlight_pattern_cells', {
    target_cells: [{ row: 5, col: 6 }],
    explanation: EXPLANATION,
  });

  // Index 41 is the annotated cell (row 5, col 6): clicking must still select it.
  await page.locator('[data-index="41"]').click();
  await expect(page.locator('[data-index="41"]')).toHaveAttribute('data-selected', 'true');
});

test('an explanation never takes focus (SC-011)', async ({ page }) => {
  const index = await page
    .locator('[role="gridcell"][data-origin="empty"]')
    .first()
    .getAttribute('data-index');
  await page.locator(`[data-index="${index}"]`).click();

  const before = await page.evaluate(() => document.activeElement?.getAttribute('data-index'));
  await callTool(page, 'highlight_pattern_cells', {
    target_cells: [{ row: 1, col: 1 }],
    explanation: EXPLANATION,
  });
  const after = await page.evaluate(() => document.activeElement?.getAttribute('data-index'));

  expect(after).toBe(before);
});

test('the board still announces the selected cell normally while annotated', async ({ page }) => {
  await callTool(page, 'highlight_pattern_cells', {
    target_cells: [{ row: 5, col: 6 }],
    explanation: EXPLANATION,
  });

  await page.locator('[data-index="41"]').click();
  const label = await page.locator('[data-index="41"]').getAttribute('aria-label');

  // Position, contents, and the agent's mark -- all in one label, in that order.
  expect(label).toMatch(/^Row 5, column 6,/);
  expect(label).toContain('agent target');
});
