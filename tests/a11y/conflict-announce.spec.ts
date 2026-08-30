import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * FR-026: conflict state must be conveyed by a cue other than colour AND exposed
 * to assistive technology -- Principle V forbids colour-only signalling, and the
 * author's brief only specified "soft red".
 */

async function openReadyBoard(page: Page) {
  await page.goto('/');
  await page.locator('[role="grid"][aria-busy="false"]').waitFor();
  await page.locator('[role="gridcell"][data-origin="clue"]').first().waitFor();
}

async function createRowConflict(page: Page) {
  return page.evaluate(() => {
    const cells = Array.from(document.querySelectorAll('[role="gridcell"]'));
    for (let row = 0; row < 9; row++) {
      const inRow = cells.slice(row * 9, row * 9 + 9);
      const clue = inRow.find((c) => c.getAttribute('data-origin') === 'clue');
      const empty = inRow.find((c) => c.getAttribute('data-origin') === 'empty');
      if (clue && empty) {
        return { emptyIndex: empty.getAttribute('data-index')!, digit: clue.textContent!.trim() };
      }
    }
    throw new Error('no row with both a clue and an empty cell');
  });
}

test('announces conflicts politely, without stealing focus', async ({ page }) => {
  await openReadyBoard(page);
  const { emptyIndex, digit } = await createRowConflict(page);

  const cell = page.locator(`[data-index="${emptyIndex}"]`);
  await cell.click();
  await page.keyboard.press(digit);

  // Scoped by test id rather than by role. Feature 002 added agent live regions
  // (the explanation queue and the annotation summary), so "the only polite
  // status region on the page" stopped being a statement about conflicts. The
  // requirement is unchanged: ONE conflict announcement, polite, no focus steal.
  const region = page.getByTestId('conflict-announcement');
  await expect(region).toHaveCount(1);
  await expect(region).toContainText(/conflict/i);

  // Focus stayed on the cell the player was working in.
  const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-index'));
  expect(focused).toBe(emptyIndex);
});

test('names the conflict in the cell label, so a screen reader hears it in place', async ({ page }) => {
  await openReadyBoard(page);
  const { emptyIndex, digit } = await createRowConflict(page);

  await page.locator(`[data-index="${emptyIndex}"]`).click();
  await page.keyboard.press(digit);

  await expect(page.locator(`[data-index="${emptyIndex}"]`)).toHaveAttribute('aria-label', /conflict/i);
});

test('stays free of axe violations with a conflict on screen', async ({ page }) => {
  await openReadyBoard(page);
  const { emptyIndex, digit } = await createRowConflict(page);
  await page.locator(`[data-index="${emptyIndex}"]`).click();
  await page.keyboard.press(digit);

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});

test('the conflict wash still supports its ink at 4.5:1', async ({ page }) => {
  await openReadyBoard(page);
  const { emptyIndex, digit } = await createRowConflict(page);
  await page.locator(`[data-index="${emptyIndex}"]`).click();
  await page.keyboard.press(digit);

  const ratio = await page.evaluate((i) => {
    const el = document.querySelector(`[data-index="${i}"]`) as HTMLElement;
    const s = getComputedStyle(el);
    const lum = (colour: string) => {
      const [r, g, b] = colour.match(/[\d.]+/g)!.map(Number);
      const lin = (c: number) => {
        const v = c / 255;
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * lin(r!) + 0.7152 * lin(g!) + 0.0722 * lin(b!);
    };
    const a = lum(s.color);
    const b = lum(s.backgroundColor);
    const [hi, lo] = a > b ? [a, b] : [b, a];
    return (hi + 0.05) / (lo + 0.05);
  }, emptyIndex);

  expect(ratio).toBeGreaterThanOrEqual(4.5);
});
