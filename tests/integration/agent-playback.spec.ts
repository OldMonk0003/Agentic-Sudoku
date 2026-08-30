import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { openWithAgent, callTool } from '../support/agentPage';

/**
 * User Story 5 end to end: "Request a three-step walkthrough. Confirm each step
 * shows its own explanation in order, that interrupting mid-sequence stops it
 * cleanly, and that the board is coherent afterwards."
 *
 * These run against the REAL pace (1.2 s a step), because the thing being tested
 * is that a human can watch and interrupt it. The sequencer's timing itself is
 * pinned by a fake clock in tests/unit/playback.sequencer.test.ts.
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

test.beforeEach(async ({ page }) => {
  await openWithAgent(page);
});

test('playback_deduction_sequence is registered', async ({ page }) => {
  const names = await page.evaluate(async () =>
    (await document.modelContext!.getTools()).map((t) => t.name),
  );
  expect(names).toContain('playback_deduction_sequence');
});

test('each step explains itself AS IT RUNS, in order (FR-047)', async ({ page }) => {
  const [a, b, c] = await emptyIndices(page, 3);

  // Fire and forget: we watch it unfold rather than waiting for the result.
  const running = callTool(page, 'playback_deduction_sequence', {
    explanation: SEQUENCE,
    steps: [fillStep(a!, 1, 'First'), fillStep(b!, 2, 'Second'), fillStep(c!, 3, 'Third')],
  });

  // The first explanation is on screen well before the last step runs -- which
  // is the difference between a walkthrough and a summary.
  await expect(page.getByTestId('explanation').filter({ hasText: 'First' })).toHaveCount(1);
  await expect(page.locator(`[data-index="${c}"]`)).toHaveText('');

  const result = await running;
  expect(result.data).toMatchObject({ steps_completed: 3, stopped_because: 'finished' });

  await expect(page.getByTestId('explanation').filter({ hasText: 'Third' })).toHaveCount(1);
});

test('the board stays live and the learner is never locked out (FR-051, SC-007)', async ({ page }) => {
  const [a, b, c, spare] = await emptyIndices(page, 4);

  const running = callTool(page, 'playback_deduction_sequence', {
    explanation: SEQUENCE,
    steps: [fillStep(a!, 1, 'First'), fillStep(b!, 2, 'Second'), fillStep(c!, 3, 'Third')],
  });

  // The learner can see the board and reach a cell while it plays.
  await expect(page.locator('[role="grid"]')).toBeVisible();
  await expect(page.getByTestId('playback-indicator')).toBeVisible();
  await expect(page.locator(`[data-index="${spare}"]`)).toBeEnabled();

  await running;
});

test('touching the board stops playback immediately, keeping completed steps (FR-048, FR-049)', async ({ page }) => {
  const [a, b, c, d] = await emptyIndices(page, 4);

  const running = callTool(page, 'playback_deduction_sequence', {
    explanation: SEQUENCE,
    steps: [
      fillStep(a!, 1, 'First'), fillStep(b!, 2, 'Second'),
      fillStep(c!, 3, 'Third'), fillStep(d!, 4, 'Fourth'),
    ],
  });

  // Wait for the first step to land, then take over.
  await expect(page.locator(`[data-index="${a}"]`)).toHaveText('1');
  await page.locator(`[data-index="${d}"]`).click();

  const result = await running;

  // An interruption is a SUCCESS: the learner taking control is the system working.
  expect(result.ok).toBe(true);
  expect(result.data!.stopped_because).toBe('interrupted');
  expect(result.data!.steps_completed as number).toBeLessThan(4);

  // What ran, stands. What did not, did not.
  await expect(page.locator(`[data-index="${a}"]`)).toHaveText('1');
  await expect(page.locator(`[data-index="${d}"]`)).toHaveText('');
  await expect(page.getByTestId('playback-indicator')).toHaveCount(0);
});

test('after an interruption, Undo steps back ONE AT A TIME (FR-050)', async ({ page }) => {
  const [a, b, c, d] = await emptyIndices(page, 4);

  const running = callTool(page, 'playback_deduction_sequence', {
    explanation: SEQUENCE,
    steps: [
      fillStep(a!, 1, 'First'), fillStep(b!, 2, 'Second'),
      fillStep(c!, 3, 'Third'), fillStep(d!, 4, 'Fourth'),
    ],
  });

  await expect(page.locator(`[data-index="${b}"]`)).toHaveText('2');
  await page.locator(`[data-index="${d}"]`).click();
  const result = await running;
  const completed = result.data!.steps_completed as number;
  expect(completed).toBeGreaterThanOrEqual(2);

  // One press, one step back -- not the whole sequence at once.
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator(`[data-index="${a}"]`)).toHaveText('1');

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator(`[data-index="${a}"]`)).toHaveText('');
});

test('a structurally invalid sequence plays nothing at all', async ({ page }) => {
  const [a, b] = await emptyIndices(page, 2);

  const result = await callTool(page, 'playback_deduction_sequence', {
    explanation: SEQUENCE,
    steps: [
      fillStep(a!, 1, 'First'),
      { action: 'beam', explanation: 'A step missing its unit entirely, so the whole call is refused.' },
    ],
  });

  expect(result.ok).toBe(false);
  expect(result.error!.code).toBe('invalid-input');
  await expect(page.locator(`[data-index="${a}"]`)).toHaveText('');
  await expect(page.locator(`[data-index="${b}"]`)).toHaveText('');
});

test('a mixed sequence can highlight, beam, and fill', async ({ page }) => {
  const [a, b] = await emptyIndices(page, 2);

  const result = await callTool(page, 'playback_deduction_sequence', {
    explanation: SEQUENCE,
    steps: [
      {
        action: 'highlight',
        cells: [{ row: Math.floor(a! / 9) + 1, col: (a! % 9) + 1 }],
        explanation: 'Start here: this is the most constrained cell in the whole box.',
      },
      {
        action: 'beam',
        unit_type: 'row',
        unit_number: Math.floor(a! / 9) + 1,
        explanation: 'This row already rules out most of the digits it could otherwise take.',
      },
      fillStep(b!, 5, 'Third'),
    ],
  });

  expect(result.ok).toBe(true);
  expect(result.data).toMatchObject({ steps_completed: 3, stopped_because: 'finished' });
  await expect(page.locator('[data-agent-annotation="target"]')).toHaveCount(1);
  await expect(page.locator('[data-agent-beam="row"]')).toHaveCount(9);
});
