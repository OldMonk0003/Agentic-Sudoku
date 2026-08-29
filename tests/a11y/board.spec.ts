import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** Accessibility is a gate on every slice, not a final cleanup (constitution). */

async function openReadyBoard(page: Page) {
  await page.goto('/');
  await page.locator('[role="grid"][aria-busy="false"]').waitFor();
  await page.locator('[role="gridcell"][data-origin="clue"]').first().waitFor();
}

test('has no automatically detectable accessibility violations', async ({ page }) => {
  await openReadyBoard(page);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations).toEqual([]);
});

test('exposes the board as a grid with row and column semantics (FR-047)', async ({ page }) => {
  await openReadyBoard(page);
  const grid = page.getByRole('grid', { name: /sudoku/i });
  await expect(grid).toHaveAttribute('aria-rowcount', '9');
  await expect(grid).toHaveAttribute('aria-colcount', '9');
});

test('announces each cell coordinate, value, and whether it is a clue (FR-047)', async ({ page }) => {
  await openReadyBoard(page);
  const clue = page.locator('[role="gridcell"][data-origin="clue"]').first();
  const label = await clue.getAttribute('aria-label');
  expect(label).toMatch(/row \d/i);
  expect(label).toMatch(/column \d/i);
  expect(label).toMatch(/given|clue/i);
});

test('moves programmatic focus with the selection so keyboard and screen reader stay in step', async ({ page }) => {
  await openReadyBoard(page);
  await page.locator('[data-index="0"]').click();
  await page.keyboard.press('ArrowRight');

  const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-index'));
  expect(focused).toBe('1');
});

test('every control is reachable by keyboard with a visible focus indicator (FR-046)', async ({ page }) => {
  await openReadyBoard(page);
  await page.keyboard.press('Tab');
  const outline = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const s = getComputedStyle(el);
    return { tag: el.tagName, outline: s.outlineStyle, width: s.outlineWidth };
  });
  expect(outline.tag).not.toBe('BODY');
});
