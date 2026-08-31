import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * SC-010: "With no agent host present, the site scores identically against every
 * success criterion in feature 001, with zero agent-related interface elements
 * visible."
 *
 * No host is injected in this file. This is the default state of every browser
 * that does not implement WebMCP -- which today is most of them -- so it is the
 * state most people will actually see, and it must be feature 001 exactly.
 */

async function openBoard(page: Page) {
  await page.goto('/');
  await page.locator('[role="grid"][aria-busy="false"]').waitFor();
  await page.locator('[role="gridcell"][data-origin="clue"]').first().waitFor();
}

test.beforeEach(async ({ page }) => {
  await openBoard(page);
});

test('there is no agent host, and nothing tried to invent one', async ({ page }) => {
  expect(await page.evaluate(() => 'modelContext' in document)).toBe(false);
  // Principle I: no bespoke bridge, no window globals standing in for the standard.
  expect(await page.evaluate(() => '__agent' in window)).toBe(false);
  expect(await page.evaluate(() => 'agent' in window)).toBe(false);
});

test('not one agent-related element is rendered', async ({ page }) => {
  for (const selector of [
    '[data-testid="agent-badge"]',
    '[data-testid="explanation-queue"]',
    '[data-testid="explanation"]',
    '[data-testid="agent-toast"]',
    '[data-testid="annotation-layer"]',
    '[data-testid="confirmation-banner"]',
    '[data-testid="playback-indicator"]',
    '[data-agent-annotation]',
    '[data-agent-beam]',
    '[data-agent-placed]',
  ]) {
    await expect(page.locator(selector), selector).toHaveCount(0);
  }
});

test('the accessibility tree offers no agent affordance', async ({ page }) => {
  const snapshot = (await page.locator('body').ariaSnapshot()).toLowerCase();

  // "agentic sudoku" is the site's own name; an affordance is something else.
  expect(snapshot).not.toContain('agent connected');
  expect(snapshot).not.toContain('disconnect');
  expect(snapshot).not.toContain('agent explanations');
});

test('001 still holds: select, type, erase, undo, all by keyboard', async ({ page }) => {
  const index = await page
    .locator('[role="gridcell"][data-origin="empty"]')
    .first()
    .getAttribute('data-index');
  const cell = page.locator(`[data-index="${index}"]`);

  await cell.click();
  await page.keyboard.press('5');
  await expect(cell).toHaveText('5');

  await page.keyboard.press('Backspace');
  await expect(cell).toHaveText('');

  await page.keyboard.press('7');
  await expect(cell).toHaveText('7');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(cell).toHaveText('');
});

test('001 still holds: highlighting, conflicts, pencil mode, timer, pause', async ({ page }) => {
  /*
    Pick an EMPTY, non-clue cell rather than hardcoding index 40.
    Puzzles are generated with a time-based seed, so cell 40 is a starting clue
    on some boards -- and pencilling into a clue correctly does nothing, which
    made this test fail perhaps one run in five. Found while adding feature 003;
    the flake predates it.
  */
  const target = page.locator('[role="gridcell"]:not([data-origin="clue"])').first();
  const index = await target.getAttribute('data-index');

  await target.click();
  await expect(page.locator('[data-tier="crosshair"]').first()).toBeVisible();

  await page.getByRole('switch', { name: 'Pencil notes' }).click();
  await page.keyboard.press('3');
  await expect(page.locator(`[data-index="${index}"] [data-candidate="3"]`)).toHaveCount(1);

  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByTestId('pause-overlay')).toBeVisible();
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.getByTestId('pause-overlay')).toHaveCount(0);
});

test('001 still holds: axe clean, and no request after load', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));

  await page.locator('[data-index="40"]').click();
  await page.keyboard.press('5');

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
  expect(requests).toEqual([]);
});

test('001 still holds: the session survives a reload', async ({ page }) => {
  const index = await page
    .locator('[role="gridcell"][data-origin="empty"]')
    .first()
    .getAttribute('data-index');
  await page.locator(`[data-index="${index}"]`).click();
  await page.keyboard.press('6');

  await page.waitForFunction(() => localStorage.getItem('agentic-sudoku/session') !== null);
  await page.reload();
  await page.locator('[role="grid"][aria-busy="false"]').waitFor();

  await expect(page.locator(`[data-index="${index}"]`)).toHaveText('6');
});
