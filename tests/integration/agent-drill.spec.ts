import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { openWithAgent, callTool } from '../support/agentPage';

/**
 * User Story 6 end to end: "Ask for a drill on a named technique from a
 * half-finished board. Confirm the learner is asked first, that declining
 * changes nothing, and that accepting loads a valid puzzle genuinely requiring
 * that technique."
 */

const EXPLANATION = 'Here is a board built around the pattern you just learned -- want to try it?';
const TECHNIQUE = 'naked-pair';

async function makeProgress(page: Page) {
  const index = Number(
    await page.locator('[role="gridcell"][data-origin="empty"]').first().getAttribute('data-index'),
  );
  await page.locator(`[data-index="${index}"]`).click();
  await page.keyboard.press('5');
  await expect(page.locator(`[data-index="${index}"]`)).toHaveText('5');
  return index;
}

test.beforeEach(async ({ page }) => {
  await openWithAgent(page);
});

/*
  Feature 002 asserted a surface of exactly eleven here. Feature 003 adds five
  more, so the count moved -- but the ASSERTION THAT MATTERS is unchanged and
  sharpened: 002's eleven must all still be registered, because 002/FR-010 makes
  removing or renaming one a MAJOR break. The number is checked in the browser as
  well as headlessly, so a tool that registers in Node but not in the page is
  caught here rather than by an agent.
*/
test("002's eleven tools are all still registered in the browser", async ({ page }) => {
  const names = await page.evaluate(async () =>
    (await document.modelContext!.getTools()).map((t) => t.name),
  );

  for (const name of [
    'get_board_state', 'check_for_conflicts',
    'highlight_pattern_cells', 'show_pattern_hint_toast', 'clear_visual_annotations',
    'fill_cell', 'draw_constraint_beams',
    'update_pencil_marks', 'auto_fill_all_pencil_marks',
    'playback_deduction_sequence', 'load_technique_practice',
  ]) {
    expect(names, `${name} must still be registered`).toContain(name);
  }

  // Grows with each slice of 003; complete at sixteen.
  expect(names).toHaveLength(13);
  expect(new Set(names).size).toBe(names.length);
});

test('the learner is asked first, in the agent"s own words', async ({ page }) => {
  await makeProgress(page);

  const running = callTool(page, 'load_technique_practice', {
    technique: TECHNIQUE,
    explanation: EXPLANATION,
  });

  const banner = page.getByTestId('confirmation-banner');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText(EXPLANATION);
  await expect(banner.getByRole('button', { name: 'Load drill' })).toBeVisible();
  await expect(banner.getByRole('button', { name: 'Keep my board' })).toBeVisible();

  await banner.getByRole('button', { name: 'Keep my board' }).click();
  await running;
});

test('it is NOT a modal: the board stays playable behind it (FR-056)', async ({ page }) => {
  await makeProgress(page);

  const running = callTool(page, 'load_technique_practice', {
    technique: TECHNIQUE,
    explanation: EXPLANATION,
  });
  await expect(page.getByTestId('confirmation-banner')).toBeVisible();

  // Nothing modal, nothing trapped, nothing disabled.
  expect(await page.locator('[role="dialog"], [role="alertdialog"], [aria-modal="true"]').count()).toBe(0);

  // And the learner can simply carry on solving while it sits there.
  const other = await page
    .locator('[role="gridcell"][data-origin="empty"]')
    .first()
    .getAttribute('data-index');
  await page.locator(`[data-index="${other}"]`).click();
  await page.keyboard.press('7');
  await expect(page.locator(`[data-index="${other}"]`)).toHaveText('7');

  await page.getByRole('button', { name: 'Keep my board' }).click();
  await running;
});

test('declining changes nothing and reports an ordinary outcome (FR-053)', async ({ page }) => {
  const index = await makeProgress(page);
  const before = await page.evaluate(() =>
    [...document.querySelectorAll('[role="gridcell"]')].map((c) => c.textContent).join('|'),
  );

  const running = callTool(page, 'load_technique_practice', {
    technique: TECHNIQUE,
    explanation: EXPLANATION,
  });
  await page.getByRole('button', { name: 'Keep my board' }).click();

  const result = await running;
  expect(result.ok).toBe(true);
  expect(result.data!.outcome).toBe('declined');

  await expect(page.locator(`[data-index="${index}"]`)).toHaveText('5');
  expect(
    await page.evaluate(() =>
      [...document.querySelectorAll('[role="gridcell"]')].map((c) => c.textContent).join('|'),
    ),
  ).toBe(before);
  await expect(page.getByTestId('confirmation-banner')).toHaveCount(0);
});

test('accepting loads the drill and resets the session', async ({ page }) => {
  await makeProgress(page);
  const before = await page.evaluate(() =>
    [...document.querySelectorAll('[role="gridcell"]')].map((c) => c.textContent).join('|'),
  );

  const running = callTool(page, 'load_technique_practice', {
    technique: TECHNIQUE,
    explanation: EXPLANATION,
  });
  await page.getByRole('button', { name: 'Load drill' }).click();

  const result = await running;
  expect(result.ok).toBe(true);
  expect(result.data!.outcome).toBe('loaded');

  // A different board, a cleared history, a reset clock.
  const after = await page.evaluate(() =>
    [...document.querySelectorAll('[role="gridcell"]')].map((c) => c.textContent).join('|'),
  );
  expect(after).not.toBe(before);
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
  await expect(page.getByTestId('timer')).toHaveText('00:00');
  await expect(page.getByTestId('confirmation-banner')).toHaveCount(0);
});

test('a technique with no drill is rejected, listing the ones that exist (FR-054)', async ({ page }) => {
  const result = await callTool(page, 'load_technique_practice', {
    technique: 'swordfish',
    explanation: EXPLANATION,
  });

  expect(result.ok).toBe(false);
  expect(result.error!.message).toMatch(/naked-pair|hidden-single|locked-candidates/);
  await expect(page.getByTestId('confirmation-banner')).toHaveCount(0);
});

test('no network request is made to load a drill (FR-055)', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));

  await makeProgress(page);
  const running = callTool(page, 'load_technique_practice', {
    technique: TECHNIQUE,
    explanation: EXPLANATION,
  });
  await page.getByRole('button', { name: 'Load drill' }).click();
  await running;

  expect(requests).toEqual([]);
});

test('the loaded drill is a real puzzle the learner can play', async ({ page }) => {
  await makeProgress(page);
  const running = callTool(page, 'load_technique_practice', {
    technique: TECHNIQUE,
    explanation: EXPLANATION,
  });
  await page.getByRole('button', { name: 'Load drill' }).click();
  await running;

  await expect(page.locator('[role="gridcell"][data-origin="clue"]').first()).toBeVisible();

  const index = await page
    .locator('[role="gridcell"][data-origin="empty"]')
    .first()
    .getAttribute('data-index');
  await page.locator(`[data-index="${index}"]`).click();
  await page.keyboard.press('4');
  await expect(page.locator(`[data-index="${index}"]`)).toHaveText('4');
});
