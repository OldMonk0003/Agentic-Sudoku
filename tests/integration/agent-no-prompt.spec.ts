import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { openWithAgent, callTool } from '../support/agentPage';

/**
 * The repealed confirmation (005/FR-020 -- FR-027).
 *
 * THIS FILE IS THE RED HALF OF A RED-GREEN CYCLE FOR A DELETION. You cannot
 * write a failing test by removing one; you can write the test that asserts the
 * NEW behaviour -- the board switches immediately, no prompt is ever in the DOM --
 * watch it fail against the confirmation-bearing code, and then remove the
 * confirmation to make it pass. That is what keeps Principle V honest through a
 * removal rather than exempting it.
 *
 * WHAT IS BEING GIVEN UP, recorded here because a test file is where someone
 * will meet it. Two features were built around the rule that an agent may not
 * discard the learner's board without being told it may (002/FR-053,
 * 003/FR-030). That rule is repealed. An agent that misreads "this is too easy"
 * as "replace this" now destroys the work with nothing asked, no undo -- a
 * replaced board is not in the undo history -- and no retained copy, since only
 * one game is ever saved.
 *
 * What survives is the narration contract, and that is why the assertions below
 * check for the explanation as carefully as they check for the prompt's absence:
 * it is now the learner's ONLY account of why their board changed.
 */

const SWITCH = 'Moving you up to a harder board, since you have been clearing these comfortably.';
const DRILL = 'Here is a board built around the pattern we were just talking about, to practise it.';

const board = (page: Page) => page.locator('[role="grid"]');
const settled = (page: Page) => expect(board(page)).not.toHaveAttribute('aria-busy', 'true');

/** Put real progress on the board -- the case that used to raise a prompt. */
async function makeProgress(page: Page): Promise<void> {
  await board(page).locator('[data-origin="empty"]').first().click();
  await page.keyboard.press('4');
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
}

test.beforeEach(async ({ page }) => {
  await openWithAgent(page);
});

test('no confirmation banner exists anywhere in the product', async ({ page }) => {
  // FR-024: the mechanism is retired, not merely unused. A prompt no code path
  // can raise would still read to the next maintainer as a live safeguard.
  await expect(page.getByTestId('confirmation-banner')).toHaveCount(0);
});

test('a difficulty switch replaces a board with progress, with no prompt', async ({ page }) => {
  await makeProgress(page);

  const result = await callTool(page, 'switch_difficulty', { difficulty: 'hard', explanation: SWITCH });
  await settled(page);

  expect(result.ok).toBe(true);
  expect(result.data).toMatchObject({ outcome: 'loaded' });
  await expect(page.getByTestId('confirmation-banner')).toHaveCount(0);
  await expect(page.getByLabel('Difficulty')).toHaveValue('hard');
  // The work is gone, and nothing asked.
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
});

test('a practice drill replaces a board with progress, with no prompt', async ({ page }) => {
  await makeProgress(page);

  const result = await callTool(page, 'load_technique_practice', {
    technique: 'hidden-single',
    explanation: DRILL,
  });
  await settled(page);

  expect(result.ok).toBe(true);
  expect(result.data).toMatchObject({ outcome: 'loaded' });
  await expect(page.getByTestId('confirmation-banner')).toHaveCount(0);
});

test('a restart replaces a board with progress, with no prompt', async ({ page }) => {
  await makeProgress(page);

  const result = await callTool(page, 'restart_puzzle', {
    explanation: 'Starting you a fresh board at this level, since this one is not going anywhere.',
  });
  await settled(page);

  expect(result.ok).toBe(true);
  await expect(page.getByTestId('confirmation-banner')).toHaveCount(0);
});

test('the explanation is on screen, because it is now the only account of the change', async ({ page }) => {
  // FR-022. With the prompt gone this is all the learner gets, so it is asserted
  // rather than assumed.
  await makeProgress(page);
  await callTool(page, 'switch_difficulty', { difficulty: 'medium', explanation: SWITCH });
  await settled(page);

  await expect(page.getByTestId('explanation').filter({ hasText: 'Moving you up' })).toBeVisible();
});

test('the call never waits on a human', async ({ page }) => {
  // FR-023. It previously blocked for up to sixty seconds waiting for a click.
  await makeProgress(page);

  const started = Date.now();
  await callTool(page, 'switch_difficulty', { difficulty: 'medium', explanation: SWITCH });
  const elapsed = Date.now() - started;

  expect(elapsed, 'the tool must not wait on a confirmation').toBeLessThan(5_000);
});

test('the learner can still stop the agent, which is now their only protection', async ({ page }) => {
  // FR-026. After the repeal, Disconnect is what stands between the learner and
  // an unwanted replacement, so it gets its own assertion.
  await expect(page.getByTestId('agent-badge')).toBeVisible();
  await page.getByRole('button', { name: 'Disconnect' }).click();

  await expect(page.getByText('Agent disconnected')).toBeVisible();
});
