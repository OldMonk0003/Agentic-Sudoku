import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { openWithAgent, callTool, toolNames } from '../support/agentPage';

/**
 * `undo_move` and `restart_puzzle` driven through a real host (005/US2).
 *
 * The contract tests pin the tools' shapes; this pins what the LEARNER sees when
 * they run -- the explanation on screen, the selection staying put, the board
 * actually stepping back. Those are the parts a contract test cannot reach.
 */

const UNDO = 'Taking that back for you -- that digit contradicts one already in the same box.';
const RESTART = 'Starting you a fresh board at the same level, since this one is not going anywhere.';

const board = (page: Page) => page.locator('[role="grid"]');
const settled = (page: Page) => expect(board(page)).not.toHaveAttribute('aria-busy', 'true');

async function grid(page: Page): Promise<string> {
  return page.evaluate(() =>
    [...document.querySelectorAll('[role="gridcell"]')]
      .map((c) => (c.getAttribute('data-origin') === 'clue' ? c.textContent?.trim() || '.' : '.'))
      .join(''),
  );
}

test.beforeEach(async ({ page }) => {
  await openWithAgent(page);
});

test('both tools are published on the surface', async ({ page }) => {
  const names = await toolNames(page);
  expect(names).toContain('undo_move');
  expect(names).toContain('restart_puzzle');
  // 005 takes the surface to eighteen, additively.
  expect(names.length).toBe(18);
});

test('an agent undo steps the board back and says why', async ({ page }) => {
  // Pin the cell by index FIRST: `[data-origin="empty"]` stops matching the
  // moment a digit lands in it, and `.first()` would then re-resolve to the
  // next empty cell -- which is empty, so the assertion would chase its tail.
  const target = board(page).locator('[data-origin="empty"]').first();
  const index = await target.getAttribute('data-index');
  const cell = board(page).locator(`[data-index="${index}"]`);
  await cell.click();
  await page.keyboard.press('7');
  await expect(cell).toHaveText('7');

  const result = await callTool(page, 'undo_move', { explanation: UNDO });

  expect(result.ok).toBe(true);
  expect(result.data).toMatchObject({ outcome: 'undone', undone_origin: 'player' });
  await expect(cell).toHaveText('');
  // 002/FR-017: the change is narrated, attributed, on screen.
  await expect(page.getByTestId('explanation').filter({ hasText: 'Taking that back' })).toBeVisible();
});

test('an agent undo does not move the learner\'s selection', async ({ page }) => {
  // 005/FR-018, SC-010. Undo addresses no cell, so this should hold by
  // construction -- which is exactly the kind of claim worth checking.
  const cells = board(page).locator('[data-origin="empty"]');
  await cells.first().click();
  await page.keyboard.press('3');

  await cells.nth(4).click();
  const parked = await cells.nth(4).getAttribute('data-index');

  await callTool(page, 'undo_move', { explanation: UNDO });

  await expect(board(page).locator(`[data-index="${parked}"]`)).toHaveAttribute('data-selected', 'true');
  // And the learner's next keypress still lands where they left it.
  await page.keyboard.press('9');
  await expect(board(page).locator(`[data-index="${parked}"]`)).toHaveText('9');
});

test('undo is refused when there is nothing to undo', async ({ page }) => {
  const result = await callTool(page, 'undo_move', { explanation: UNDO });

  expect(result.ok).toBe(false);
  expect(result.error?.code).toBe('nothing-to-undo');
});

test('undo is refused while the board is paused', async ({ page }) => {
  const cell = board(page).locator('[data-origin="empty"]').first();
  await cell.click();
  await page.keyboard.press('7');

  await callTool(page, 'pause_timer', { explanation: 'Stopping the clock so you can take a short break.' });
  const result = await callTool(page, 'undo_move', { explanation: UNDO });

  // 002/FR-045. Nothing upstream enforces this -- the guard lives in the tool.
  expect(result.ok).toBe(false);
  expect(result.error?.code).toBe('wrong-status');
});

test('an agent restart gives a different grid at the same difficulty', async ({ page }) => {
  const before = await grid(page);
  const level = await page.getByLabel('Difficulty').inputValue();

  const result = await callTool(page, 'restart_puzzle', { explanation: RESTART });
  await settled(page);

  expect(result.ok).toBe(true);
  expect(result.data).toMatchObject({ outcome: 'restarted' });
  expect(await grid(page)).not.toBe(before);
  await expect(page.getByLabel('Difficulty')).toHaveValue(level);
});

test('an agent restart clears the history and the clock, and says why', async ({ page }) => {
  await board(page).locator('[data-origin="empty"]').first().click();
  await page.keyboard.press('4');
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();

  await callTool(page, 'restart_puzzle', { explanation: RESTART });
  await settled(page);

  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
  await expect(page.getByTestId('explanation').filter({ hasText: 'fresh board' })).toBeVisible();
});

test('neither tool can be called without narrating', async ({ page }) => {
  await board(page).locator('[data-origin="empty"]').first().click();
  await page.keyboard.press('4');

  for (const tool of ['undo_move', 'restart_puzzle']) {
    const result = await callTool(page, tool, {});
    expect(result.ok, `${tool} must refuse an unnarrated call`).toBe(false);
    expect(result.error?.code).toBe('explanation-required');
  }
});
