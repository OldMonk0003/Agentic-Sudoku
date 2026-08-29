import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * The full accessibility sweep (T111).
 *
 * Accessibility was a gate on every slice, so this should find nothing. It
 * exists to prove that across EVERY board state, not just the default one.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function openReadyBoard(page: Page) {
  await page.goto('/');
  await page.locator('[role="grid"][aria-busy="false"]').waitFor();
  await page.locator('[role="gridcell"][data-origin="clue"]').first().waitFor();
}

async function scan(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(results.violations, `${label}: ${JSON.stringify(results.violations.map((v) => v.id))}`).toEqual([]);
}

test('clean on a freshly loaded board', async ({ page }) => {
  await openReadyBoard(page);
  await scan(page, 'fresh board');
});

test('clean with a cell selected and highlighting active', async ({ page }) => {
  await openReadyBoard(page);
  await page.locator('[role="gridcell"][data-origin="clue"]').first().click();
  await scan(page, 'selection + crosshair + matching');
});

test('clean with pencil notes on the board', async ({ page }) => {
  await openReadyBoard(page);
  await page.getByRole('switch', { name: /pencil|notes/i }).click();
  const index = await page.locator('[role="gridcell"][data-origin="empty"]').first().getAttribute('data-index');
  await page.locator(`[data-index="${index}"]`).click();
  await page.keyboard.press('1');
  await page.keyboard.press('5');
  await scan(page, 'pencil notes');
});

test('clean while paused', async ({ page }) => {
  await openReadyBoard(page);
  await page.getByRole('button', { name: /pause/i }).click();
  await scan(page, 'paused');
});

test('clean at a 360px viewport', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await openReadyBoard(page);
  await scan(page, '360px');
});

test('clean while generating', async ({ page }) => {
  await page.goto('/');
  // Catch the skeleton state before generation resolves.
  await page.locator('[role="grid"]').waitFor();
  await scan(page, 'generating');
});
