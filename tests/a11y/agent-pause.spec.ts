import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openWithAgent, callTool } from '../support/agentPage';

/**
 * The pause overlay, when an AGENT raised it.
 *
 * This is the recorded deviation in plan.md made checkable. An agent-initiated
 * pause obscures the board, which brushes Principle V's ban on blocking
 * feedback. It is accepted on one ground and one only: the learner can lift it
 * instantly, with their own control, using nothing but a keyboard.
 *
 * If these tests fail, the deviation is no longer justified.
 */

const EXPLANATION = 'You have been at this for twenty minutes, so a short break would do you good.';

test.beforeEach(async ({ page }) => {
  await openWithAgent(page);
  await callTool(page, 'pause_timer', { explanation: EXPLANATION });
  await expect(page.getByTestId('pause-overlay')).toBeVisible();
});

test('axe is clean with an agent-initiated pause on screen', async ({ page }) => {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('the learner can lift an agent pause with the keyboard alone (FR-043)', async ({ page }) => {
  const resume = page.getByRole('button', { name: /resume/i });
  await resume.focus();
  await page.keyboard.press('Enter');

  await expect(page.getByTestId('pause-overlay')).toHaveCount(0);
});

test('the Resume control is reachable by Tab from the top of the page', async ({ page }) => {
  await page.keyboard.press('Tab');

  let found = false;
  for (let i = 0; i < 15 && !found; i++) {
    const name = await page.evaluate(
      () => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent ?? '',
    );
    if (/resume/i.test(name)) found = true;
    else await page.keyboard.press('Tab');
  }

  expect(found, 'the learner must be able to Tab to Resume').toBe(true);
});
