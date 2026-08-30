import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openWithAgent, callTool } from '../support/agentPage';

/**
 * SC-006, SC-007, FR-051 and FR-061 for a walkthrough.
 *
 * The claim that matters most here is a NEGATIVE one: at no moment does playback
 * refuse or delay the learner's input. That is what makes SC-006 -- "regain full
 * control within one step, in 100% of attempts" -- true, and it is the reason
 * the progress indicator is a status line rather than a dialog.
 */

const SEQUENCE = 'Three steps that finish this box; follow the reasoning as it goes.';

async function emptyIndices(page: Page, n: number): Promise<number[]> {
  return page.evaluate(
    (count: number) =>
      [...document.querySelectorAll('[role="gridcell"][data-origin="empty"]')]
        .slice(0, count)
        .map((c) => Number(c.getAttribute('data-index'))),
    n,
  );
}

const fillStep = (index: number, digit: number, label: string) => ({
  action: 'fill',
  row: Math.floor(index / 9) + 1,
  col: (index % 9) + 1,
  digit,
  explanation: `${label}: this cell can only take that digit, for the reasons just shown.`,
});

test('axe finds no violation while a walkthrough is playing', async ({ page }) => {
  await openWithAgent(page);
  const [a, b, c] = await emptyIndices(page, 3);

  const running = callTool(page, 'playback_deduction_sequence', {
    explanation: SEQUENCE,
    steps: [fillStep(a!, 1, 'First'), fillStep(b!, 2, 'Second'), fillStep(c!, 3, 'Third')],
  });

  await expect(page.getByTestId('playback-indicator')).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);

  await running;
});

test('the progress indicator is a status line, not a dialog', async ({ page }) => {
  await openWithAgent(page);
  const [a, b] = await emptyIndices(page, 2);

  const running = callTool(page, 'playback_deduction_sequence', {
    explanation: SEQUENCE,
    steps: [fillStep(a!, 1, 'First'), fillStep(b!, 2, 'Second')],
  });

  const indicator = page.getByTestId('playback-indicator');
  await expect(indicator).toBeVisible();
  expect(await indicator.getAttribute('role')).toBe('status');
  expect(await indicator.getAttribute('aria-live')).toBe('polite');

  // No dialog, no backdrop, nothing modal anywhere on the page.
  expect(await page.locator('[role="dialog"], [role="alertdialog"], [aria-modal="true"]').count()).toBe(0);

  await running;
});

test('the learner can type THROUGHOUT, and typing is what stops it (SC-006, SC-007)', async ({ page }) => {
  await openWithAgent(page);
  const [a, b, c, spare] = await emptyIndices(page, 4);

  // Park focus on a cell before playback begins.
  await page.locator(`[data-index="${spare}"]`).click();

  const running = callTool(page, 'playback_deduction_sequence', {
    explanation: SEQUENCE,
    steps: [fillStep(a!, 1, 'First'), fillStep(b!, 2, 'Second'), fillStep(c!, 3, 'Third')],
  });

  await expect(page.locator(`[data-index="${a}"]`)).toHaveText('1');

  // Focus never moved, and the keystroke lands immediately.
  await expect(page.locator(`[data-index="${spare}"]`)).toHaveAttribute('data-selected', 'true');
  await page.keyboard.press('9');
  await expect(page.locator(`[data-index="${spare}"]`)).toHaveText('9');

  const result = await running;
  expect(result.data!.stopped_because).toBe('interrupted');
});

test('nothing on the page is disabled while playback runs (FR-056)', async ({ page }) => {
  await openWithAgent(page);
  const [a, b] = await emptyIndices(page, 2);

  const running = callTool(page, 'playback_deduction_sequence', {
    explanation: SEQUENCE,
    steps: [fillStep(a!, 1, 'First'), fillStep(b!, 2, 'Second')],
  });

  await expect(page.getByTestId('playback-indicator')).toBeVisible();

  // Undo is legitimately disabled only when there is nothing to undo, and by
  // this point there is. No other control may be disabled at all.
  const disabled = await page.evaluate(() =>
    [...document.querySelectorAll('button[disabled]')].map((b) => b.getAttribute('aria-label')),
  );
  expect(disabled).toEqual([]);

  await running;
});

test('with reduced motion, the walkthrough still paces but does not animate', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openWithAgent(page);
  const [a, b] = await emptyIndices(page, 2);

  const started = Date.now();
  const result = await callTool(page, 'playback_deduction_sequence', {
    explanation: SEQUENCE,
    steps: [
      {
        action: 'beam',
        unit_type: 'row',
        unit_number: 1,
        explanation: 'This row already rules out most of the digits this cell could take.',
      },
      fillStep(a!, 1, 'Second'),
    ],
  });
  const elapsed = Date.now() - started;

  expect(result.ok).toBe(true);
  // Still paced -- a walkthrough the learner cannot follow is not a walkthrough.
  expect(elapsed).toBeGreaterThan(500);
  // And the beam is drawn without its sweep.
  const classes = await page.locator('[data-agent-beam="row"]').first().getAttribute('class');
  expect(classes).not.toContain('agent-beam-row');
  expect(b).toBeDefined();
});
