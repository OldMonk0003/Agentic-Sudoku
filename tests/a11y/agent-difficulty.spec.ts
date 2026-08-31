import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openWithAgent, callTool } from '../support/agentPage';

/**
 * The difficulty confirmation is an INLINE BANNER, never a modal (FR-037,
 * Principle V).
 *
 * That is the same decision 002 made for the drill prompt, and it holds for the
 * same reason: Principle V bans blocking feedback outright, so there is no
 * backdrop, no focus trap, and nothing behind it is disabled. The learner can
 * ignore it entirely and keep solving. After a minute it gives up and the agent
 * is told they declined -- which is the right default when the only thing at
 * stake is whether the agent may throw their work away.
 */

const EXPLANATION = 'You have cleared three easy boards quickly, so a harder one would suit you now.';

test.beforeEach(async ({ page }) => {
  await openWithAgent(page);
  const empty = page.locator('[role="gridcell"]:not([data-origin="clue"])').first();
  await empty.click();
  await page.keyboard.press('5');
});

test('axe is clean with the difficulty confirmation showing', async ({ page }) => {
  const running = callTool(page, 'switch_difficulty', { difficulty: 'hard', explanation: EXPLANATION });
  await expect(page.getByTestId('confirmation-banner')).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);

  await page.getByTestId('confirmation-banner').getByRole('button', { name: /keep my board/i }).click();
  await running;
});

test('the confirmation takes no focus and blocks nothing', async ({ page }) => {
  const focusBefore = await page.evaluate(() => document.activeElement?.getAttribute('data-index'));

  const running = callTool(page, 'switch_difficulty', { difficulty: 'hard', explanation: EXPLANATION });
  await expect(page.getByTestId('confirmation-banner')).toBeVisible();

  // Focus is where the learner left it.
  expect(await page.evaluate(() => document.activeElement?.getAttribute('data-index'))).toBe(focusBefore);

  // And the board is still theirs: they can keep playing while it waits.
  await page.keyboard.press('7');
  await expect(page.locator(`[data-index="${focusBefore}"]`)).toContainText('7');

  await page.getByTestId('confirmation-banner').getByRole('button', { name: /keep my board/i }).click();
  await running;
});

test('the confirmation is announced politely, not asserted', async ({ page }) => {
  const running = callTool(page, 'switch_difficulty', { difficulty: 'hard', explanation: EXPLANATION });

  const banner = page.getByTestId('confirmation-banner');
  await expect(banner).toHaveAttribute('aria-live', 'polite');
  await expect(banner).toHaveAttribute('role', 'status');

  await banner.getByRole('button', { name: /keep my board/i }).click();
  await running;
});

test('both answers are reachable by keyboard alone', async ({ page }) => {
  const running = callTool(page, 'switch_difficulty', { difficulty: 'hard', explanation: EXPLANATION });
  const banner = page.getByTestId('confirmation-banner');
  await expect(banner).toBeVisible();

  await banner.getByRole('button', { name: /keep my board/i }).focus();
  await page.keyboard.press('Enter');

  const result = await running;
  expect(result.data).toMatchObject({ outcome: 'declined' });
});
