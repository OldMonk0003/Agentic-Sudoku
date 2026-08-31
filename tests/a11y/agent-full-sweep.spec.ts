import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openWithAgent, callTool } from '../support/agentPage';

/**
 * The axe sweep across EVERY agent state, at two viewports.
 *
 * 001's own sweep covered six board states and found nothing, because
 * accessibility was a gate on every slice rather than a phase at the end. This
 * is the same bet made again for the agent surface.
 */

const EXPLANATION = 'A perfectly ordinary explanation, long enough to satisfy the contract here.';

async function everythingOnScreen(page: Page) {
  await callTool(page, 'highlight_pattern_cells', {
    target_cells: [{ row: 5, col: 6 }],
    because_cells: [{ row: 5, col: 1 }, { row: 5, col: 3 }],
    explanation: EXPLANATION,
  });
  await callTool(page, 'draw_constraint_beams', {
    beams: [{ unit_type: 'row', unit_number: 3 }, { unit_type: 'col', unit_number: 7 }],
    explanation: EXPLANATION,
  });
  await callTool(page, 'show_pattern_hint_toast', { explanation: EXPLANATION });

  const index = Number(
    await page.locator('[role="gridcell"][data-origin="empty"]').first().getAttribute('data-index'),
  );
  await callTool(page, 'fill_cell', {
    row: Math.floor(index / 9) + 1,
    col: (index % 9) + 1,
    digit: 7,
    explanation: EXPLANATION,
  });
  await callTool(page, 'auto_fill_all_pencil_marks', {
    acknowledges_replacing_marks: true,
    explanation: EXPLANATION,
  });
}

for (const [label, width, height] of [['desktop', 1280, 900], ['360px', 360, 780]] as const) {
  test(`axe is clean with the whole agent surface active at ${label}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openWithAgent(page);
    await everythingOnScreen(page);

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
}

test('axe is clean with a confirmation waiting', async ({ page }) => {
  await openWithAgent(page);
  const index = Number(
    await page.locator('[role="gridcell"][data-origin="empty"]').first().getAttribute('data-index'),
  );
  await page.locator(`[data-index="${index}"]`).click();
  await page.keyboard.press('5');

  const running = callTool(page, 'load_technique_practice', {
    technique: 'naked-pair',
    explanation: EXPLANATION,
  });
  await expect(page.getByTestId('confirmation-banner')).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);

  await page.getByRole('button', { name: 'Keep my board' }).click();
  await running;
});

test('axe is clean with the agent disconnected', async ({ page }) => {
  await openWithAgent(page);
  await everythingOnScreen(page);
  await page.getByRole('button', { name: 'Disconnect' }).click();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('the page never scrolls horizontally with the agent surface active', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await openWithAgent(page);
  await everythingOnScreen(page);

  // 001/FR-050, re-checked with the agent's own surfaces on screen: an
  // explanation queue that pushed the board sideways would be a regression
  // nothing else would catch.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('every agent surface is a polite status region, and none is a dialog', async ({ page }) => {
  await openWithAgent(page);
  await everythingOnScreen(page);

  for (const id of ['explanation-queue', 'agent-toast']) {
    const region = page.getByTestId(id);
    expect(await region.getAttribute('role'), id).toBe('status');
    expect(await region.getAttribute('aria-live'), id).toBe('polite');
  }
  expect(await page.locator('[role="dialog"], [role="alertdialog"], [aria-modal="true"]').count()).toBe(0);
});

/**
 * Feature 003's new states, added to the sweep (FR-016, FR-020, FR-025).
 *
 * Each is a state the board can be in that did not exist before, and each is
 * checked with axe on the whole page rather than on the new element alone --
 * the interesting failures are interactions, not the components in isolation.
 */
test('axe is clean across every state feature 003 adds', async ({ page }) => {
  await openWithAgent(page);

  const explanation = 'A perfectly ordinary explanation, long enough to satisfy the contract here.';

  // 1. The coordinate ruler.
  await callTool(page, 'show_coordinate_ruler', { explanation });
  await expect(page.getByTestId('ruler-columns')).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  // 2. The ruler AND the learner's own crosshair.
  await page.locator('[role="gridcell"]').first().click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  // 3. The ruler, the crosshair, AND the agent spotlight, all at once. This is
  //    the busiest the board can get, and the state most likely to fail.
  const target = await page.evaluate(() => {
    const cells = document.querySelectorAll('[role="gridcell"]');
    for (let i = 0; i < cells.length; i++) {
      if (!cells[i]!.textContent?.trim()) return { row: Math.floor(i / 9) + 1, col: (i % 9) + 1 };
    }
    return null;
  });
  await callTool(page, 'fill_cell', { row: target!.row, col: target!.col, digit: 9, explanation });
  await expect(page.locator('[data-spotlit="true"]').first()).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  // 4. An agent-initiated pause, on top of all of it.
  await callTool(page, 'pause_timer', { explanation });
  await expect(page.getByTestId('pause-overlay')).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  // 5. Back to playing, ruler removed -- the board must return clean.
  await callTool(page, 'resume_timer', { explanation });
  await callTool(page, 'hide_coordinate_ruler', { explanation });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
