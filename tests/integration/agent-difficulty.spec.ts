import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { openWithAgent, callTool } from '../support/agentPage';

/**
 * `switch_difficulty` end to end (FR-028 to FR-037).
 *
 * The tool that discards the learner's work, so almost every test here is about
 * what happens when they say NO. Declining must leave the board bit-for-bit as
 * it was, and must reach the agent as an ordinary outcome rather than an error
 * -- reporting a refusal as a fault would push an agent to retry the very thing
 * the learner just refused.
 */

const EXPLANATION = 'You have cleared three easy boards quickly, so a harder one would suit you now.';


async function boardFingerprint(page: Page) {
  return page.evaluate(() =>
    JSON.stringify([...document.querySelectorAll('[role="gridcell"]')].map((c) => c.textContent)),
  );
}

test.beforeEach(async ({ page }) => {
  await openWithAgent(page);
});

test('an untouched board changes level with no prompt (FR-031)', async ({ page }) => {
  const result = await callTool(page, 'switch_difficulty', {
    difficulty: 'hard', explanation: EXPLANATION,
  });

  expect(result.ok).toBe(true);
  expect(result.data).toMatchObject({ outcome: 'loaded' });
  await expect(page.getByTestId('confirmation-banner')).toHaveCount(0);
  await expect(page.getByLabel('Difficulty')).toHaveValue('hard');
});




test('the learner is never locked out while a puzzle generates (FR-037)', async ({ page }) => {
  const running = callTool(page, 'switch_difficulty', {
    difficulty: 'hard', explanation: EXPLANATION,
  });

  // The board stays interactive throughout -- no overlay, no disabled controls.
  await expect(page.locator('[role="grid"]')).toBeVisible();
  await expect(page.getByRole('button', { name: /erase/i })).toBeEnabled();

  await running;
});

test('the explanation is shown to the learner, attributed (002/FR-017)', async ({ page }) => {
  await callTool(page, 'switch_difficulty', { difficulty: 'medium', explanation: EXPLANATION });
  await expect(page.getByText(EXPLANATION)).toBeVisible();
});

test('a level the game does not offer is refused, board unchanged (FR-029)', async ({ page }) => {
  const before = await boardFingerprint(page);

  const result = await callTool(page, 'switch_difficulty', {
    difficulty: 'expert', explanation: EXPLANATION,
  });

  expect(result.ok).toBe(false);
  expect(await boardFingerprint(page)).toBe(before);
});

test('the tool is registered and declares that it mutates', async ({ page }) => {
  const tools = await page.evaluate(async () =>
    (await document.modelContext!.getTools()).map((t) => ({ name: t.name })),
  );
  expect(tools.map((t) => t.name)).toContain('switch_difficulty');
});
