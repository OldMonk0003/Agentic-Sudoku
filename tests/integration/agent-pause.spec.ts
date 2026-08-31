import { test, expect } from '@playwright/test';
import { openWithAgent, callTool } from '../support/agentPage';

/**
 * `pause_timer` and `resume_timer` end to end (FR-038 to FR-044).
 *
 * THE FIRST TEST IS THE IMPORTANT ONE, and it is first on purpose.
 *
 * An agent-initiated pause is the ONE place in this feature where an agent
 * action obscures the board, which is the closest thing here to a violation of
 * Principle V and 002/FR-056. It is accepted on exactly one ground: the
 * learner's OWN Resume control is always present, never agent-dependent, and one
 * click away. If that ever stops being true, the deviation recorded in
 * plan.md is no longer justified and the feature is wrong.
 */

const EXPLANATION = 'You have been at this for twenty minutes, so a short break would do you good.';

test.beforeEach(async ({ page }) => {
  await openWithAgent(page);
});

test('the learner can always undo an agent pause themselves (FR-043)', async ({ page }) => {
  await callTool(page, 'pause_timer', { explanation: EXPLANATION });
  await expect(page.getByTestId('pause-overlay')).toBeVisible();

  // Their own control, with no agent involvement whatsoever.
  await page.getByRole('button', { name: /resume/i }).click();

  await expect(page.getByTestId('pause-overlay')).toHaveCount(0);
  await expect(page.locator('[role="grid"]')).toBeVisible();
});

test('the agent pause stops the clock and obscures the board (FR-038)', async ({ page }) => {
  const result = await callTool(page, 'pause_timer', { explanation: EXPLANATION });

  expect(result.ok).toBe(true);
  expect(result.data).toMatchObject({ outcome: 'paused' });
  await expect(page.getByTestId('pause-overlay')).toBeVisible();
});

test('the agent can resume what it paused (FR-039)', async ({ page }) => {
  await callTool(page, 'pause_timer', { explanation: EXPLANATION });

  const result = await callTool(page, 'resume_timer', {
    explanation: 'Starting the clock again so we can pick up exactly where we left off before.',
  });

  expect(result.ok).toBe(true);
  expect(result.data).toMatchObject({ outcome: 'resumed' });
  await expect(page.getByTestId('pause-overlay')).toHaveCount(0);
});

test('resume works while paused -- the carve-out from 002/FR-045 (FR-040)', async ({ page }) => {
  await callTool(page, 'pause_timer', { explanation: EXPLANATION });

  // Every other write is refused...
  const fill = await callTool(page, 'fill_cell', {
    row: 1, col: 1, digit: 5,
    explanation: 'Only a five fits here, because the other eight digits already appear in this box.',
  });
  expect(fill.ok).toBe(false);

  // ...and reads still work...
  const read = await callTool(page, 'get_board_state');
  expect(read.ok).toBe(true);

  // ...but resume is the one that must not be barred by the state it undoes.
  const resume = await callTool(page, 'resume_timer', {
    explanation: 'Starting the clock again so we can pick up exactly where we left off before.',
  });
  expect(resume.ok).toBe(true);
});

test('the explanation is shown, attributed to the agent (002/FR-017)', async ({ page }) => {
  await callTool(page, 'pause_timer', { explanation: EXPLANATION });
  await expect(page.getByText(EXPLANATION)).toBeVisible();
});

test('pausing an already-paused board is refused, naming the state (FR-041)', async ({ page }) => {
  await callTool(page, 'pause_timer', { explanation: EXPLANATION });

  const again = await callTool(page, 'pause_timer', { explanation: EXPLANATION });
  expect(again.ok).toBe(false);
  expect(again.error!.code).toBe('wrong-status');
});

test('resuming a running board is refused (FR-041)', async ({ page }) => {
  const result = await callTool(page, 'resume_timer', {
    explanation: 'Starting the clock again so we can pick up exactly where we left off before.',
  });
  expect(result.ok).toBe(false);
  expect(result.error!.code).toBe('wrong-status');
});

test('an agent pause leaves the board itself untouched (FR-044)', async ({ page }) => {
  const before = await page.evaluate(() =>
    JSON.stringify([...document.querySelectorAll('[role="gridcell"]')].map((c) => c.textContent)),
  );

  await callTool(page, 'pause_timer', { explanation: EXPLANATION });
  await callTool(page, 'resume_timer', {
    explanation: 'Starting the clock again so we can pick up exactly where we left off before.',
  });

  const after = await page.evaluate(() =>
    JSON.stringify([...document.querySelectorAll('[role="gridcell"]')].map((c) => c.textContent)),
  );
  expect(after).toBe(before);
  await expect(page.getByRole('button', { name: /undo/i })).toBeDisabled();
});

test('the surface is complete at sixteen tools', async ({ page }) => {
  const names = await page.evaluate(async () =>
    (await document.modelContext!.getTools()).map((t) => t.name),
  );

  expect(names).toHaveLength(16);
  expect(names).toContain('pause_timer');
  expect(names).toContain('resume_timer');
  expect(new Set(names).size).toBe(16);
});
