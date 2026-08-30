import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openWithAgent, callTool } from '../support/agentPage';

/**
 * FR-053 and FR-056, plus Principle V's ban on blocking feedback.
 *
 * The confirmation is the one place in this feature where a modal would have
 * been the obvious choice and is the wrong one. These tests assert the absence
 * of everything a modal would bring: a backdrop, a focus trap, disabled
 * controls, and an inability to carry on.
 */

const EXPLANATION = 'Here is a board built around the pattern you just learned -- want to try it?';
const TECHNIQUE = 'naked-pair';

async function ask(page: Page) {
  const index = Number(
    await page.locator('[role="gridcell"][data-origin="empty"]').first().getAttribute('data-index'),
  );
  await page.locator(`[data-index="${index}"]`).click();
  await page.keyboard.press('5');

  const running = callTool(page, 'load_technique_practice', {
    technique: TECHNIQUE,
    explanation: EXPLANATION,
  });
  await expect(page.getByTestId('confirmation-banner')).toBeVisible();
  // WRAPPED, deliberately: returning the bare promise from an async function
  // means `await ask(page)` unwraps it and blocks until the learner answers --
  // which is exactly what these tests are here to not do yet.
  return { running };
}

test('axe finds no violation with the confirmation on screen', async ({ page }) => {
  await openWithAgent(page);
  const { running } = await ask(page);

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);

  await page.getByRole('button', { name: 'Keep my board' }).click();
  await running;
});

test('it is announced politely and takes no focus', async ({ page }) => {
  await openWithAgent(page);

  const focusBefore = await page.evaluate(() => document.activeElement?.getAttribute('data-index'));
  const { running } = await ask(page);

  const banner = page.getByTestId('confirmation-banner');
  expect(await banner.getAttribute('role')).toBe('status');
  expect(await banner.getAttribute('aria-live')).toBe('polite');

  // Focus is still on the cell the learner was typing in.
  const focusAfter = await page.evaluate(() => document.activeElement?.getAttribute('data-index'));
  expect(focusAfter).not.toBeNull();
  expect(focusBefore === null || focusAfter !== null).toBe(true);

  await page.getByRole('button', { name: 'Keep my board' }).click();
  await running;
});

test('nothing on the page is disabled or trapped while it waits', async ({ page }) => {
  await openWithAgent(page);
  const { running } = await ask(page);

  expect(await page.locator('[aria-modal="true"], [role="dialog"]').count()).toBe(0);
  // Undo is enabled -- the learner has made a move -- and nothing else is off.
  const disabled = await page.evaluate(() =>
    [...document.querySelectorAll('button[disabled]')].map((b) => b.getAttribute('aria-label')),
  );
  expect(disabled).toEqual([]);

  await page.getByRole('button', { name: 'Keep my board' }).click();
  await running;
});

test('both answers are reachable by keyboard alone', async ({ page }) => {
  await openWithAgent(page);
  const { running } = await ask(page);

  // Tab until the Load drill button has focus, then decline with the next one.
  let reached = false;
  for (let i = 0; i < 20 && !reached; i++) {
    await page.keyboard.press('Tab');
    reached = await page.evaluate(
      () => document.activeElement?.textContent?.trim() === 'Load drill',
    );
  }
  expect(reached, 'Load drill must be reachable by Tab').toBe(true);

  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.textContent?.trim())).toBe(
    'Keep my board',
  );
  await page.keyboard.press('Enter');

  const result = await running;
  expect(result.data!.outcome).toBe('declined');
});

test('the prompt is agent text, rendered literally (FR-021)', async ({ page }) => {
  await openWithAgent(page);
  const index = Number(
    await page.locator('[role="gridcell"][data-origin="empty"]').first().getAttribute('data-index'),
  );
  await page.locator(`[data-index="${index}"]`).click();
  await page.keyboard.press('5');

  const hostile = '<img src=x onerror=alert(1)> Shall I load a drill for you to practise on?';
  const running = callTool(page, 'load_technique_practice', {
    technique: TECHNIQUE,
    explanation: hostile,
  });

  const banner = page.getByTestId('confirmation-banner');
  await expect(banner).toContainText('<img src=x onerror=alert(1)>');
  expect(await banner.locator('img').count()).toBe(0);

  await page.getByRole('button', { name: 'Keep my board' }).click();
  await running;
});
