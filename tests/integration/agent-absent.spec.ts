import { test, expect } from '@playwright/test';

/**
 * FR-013 and SC-010: with no agent host, the site behaves EXACTLY as feature 001
 * specifies — "no error, no degraded banner, and no dead agent-related controls
 * on screen".
 *
 * The subtlety worth stating: "absent" must render nothing at all. A badge
 * reading "No agent connected" would satisfy a naive reading and fail this
 * requirement, because it advertises a capability the learner cannot use and
 * makes the page differ from 001.
 *
 * These tests run WITHOUT injecting a host, which is the default for every
 * browser Playwright drives today.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('[role="gridcell"]');
});

test('the page exposes no agent-related element', async ({ page }) => {
  await expect(page.getByTestId('agent-badge')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /disconnect/i })).toHaveCount(0);
  await expect(page.locator('[data-agent-annotation]')).toHaveCount(0);

  // Not /agent/i: the site is CALLED "Agentic Sudoku", and its own <h1> is not
  // an agent affordance. What must be absent is any statement about an agent's
  // presence, and any control over one.
  await expect(page.getByText(/agent (connected|disconnected)/i)).toHaveCount(0);
});

test('no host means nothing was registered, and nothing threw', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.reload();
  await page.waitForSelector('[role="gridcell"]');

  expect(await page.evaluate(() => 'modelContext' in document)).toBe(false);
  expect(errors).toEqual([]);
});

test('the board is fully playable, exactly as feature 001', async ({ page }) => {
  // Pinned to the index. A [data-origin="empty"] locator re-resolves once the
  // digit lands, latching onto a DIFFERENT cell -- the same trap 001 documents
  // at the top of tests/integration/play.spec.ts.
  const index = await page.locator('[role="gridcell"][data-origin="empty"]').first().getAttribute('data-index');
  const cell = page.locator(`[data-index="${index}"]`);

  await cell.click();
  await page.keyboard.press('5');
  await expect(cell).toHaveText('5');

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(cell).toHaveText('');

  // The keyboard path, which is what 001's audit found broken. Tabbing from a
  // fresh load rather than from the Undo button, which is where focus sits after
  // the click above.
  await page.reload();
  await page.locator('[role="grid"][aria-busy="false"]').waitFor();
  // Wait for hydration, not merely for markup: pressing Tab before the client
  // bundle has attached its handlers made this flake once.
  await page.locator('[role="gridcell"][data-origin="clue"]').first().waitFor();
  await expect(page.locator('[role="gridcell"][tabindex="0"]')).toHaveCount(1);

  let reachedBoard = false;
  for (let i = 0; i < 12 && !reachedBoard; i++) {
    await page.keyboard.press('Tab');
    reachedBoard = (await page.locator('[role="gridcell"]:focus').count()) === 1;
  }
  expect(reachedBoard, 'the board must be reachable by Tab alone').toBe(true);
});

test('the accessibility tree contains no agent affordance', async ({ page }) => {
  const snapshot = await page.locator('body').ariaSnapshot();
  const flattened = snapshot.toLowerCase();

  // "agentic sudoku" is the site's own name, so the check is for affordances:
  // a statement about an agent, or a control over one.
  expect(flattened).not.toContain('agent connected');
  expect(flattened).not.toContain('agent disconnected');
  expect(flattened).not.toContain('disconnect');
  expect(flattened).not.toContain('annotation');
  expect(flattened).not.toContain('explanation');
});
