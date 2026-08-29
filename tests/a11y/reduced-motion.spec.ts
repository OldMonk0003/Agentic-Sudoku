import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * FR-049 and Principle V: motion is reduced or removed on request, with no
 * exceptions. The pause overlay is the largest piece of motion in the feature.
 */

async function openReadyBoard(page: Page) {
  await page.goto('/');
  await page.locator('[role="grid"][aria-busy="false"]').waitFor();
  await page.locator('[role="gridcell"][data-origin="clue"]').first().waitFor();
}

test.describe('with prefers-reduced-motion: reduce', () => {
  test('the pause overlay appears without transition', async ({ page }) => {
    // Emulated per-test rather than via test.use, which this Playwright version
    // does not accept at describe level.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openReadyBoard(page);
    await page.getByRole('button', { name: /pause/i }).click();

    const overlay = page.getByTestId('pause-overlay');
    await expect(overlay).toBeVisible();

    const durations = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="pause-overlay"]') as HTMLElement;
      const s = getComputedStyle(el);
      return { transition: s.transitionDuration, animation: s.animationDuration };
    });

    // The global reduced-motion rule collapses everything to ~0.01ms.
    expect(parseFloat(durations.transition)).toBeLessThan(0.05);
    expect(parseFloat(durations.animation)).toBeLessThan(0.05);
  });

  test('stays free of axe violations while paused', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openReadyBoard(page);
    await page.getByRole('button', { name: /pause/i }).click();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});

test('the pause overlay actually obscures the board (FR-035)', async ({ page }) => {
  await openReadyBoard(page);

  const clue = page.locator('[role="gridcell"][data-origin="clue"]').first();
  await expect(clue).toBeVisible();

  await page.getByRole('button', { name: /pause/i }).click();

  // The digits must not be readable while the clock is stopped.
  const boardHidden = await page.evaluate(() => {
    const grid = document.querySelector('[role="grid"]') as HTMLElement;
    const s = getComputedStyle(grid);
    return s.visibility === 'hidden' || s.opacity === '0' || grid.getAttribute('aria-hidden') === 'true';
  });
  expect(boardHidden).toBe(true);
});

test('resuming restores the board and continues the clock', async ({ page }) => {
  await openReadyBoard(page);

  await page.getByRole('button', { name: /pause/i }).click();
  await expect(page.getByTestId('pause-overlay')).toBeVisible();

  await page.getByRole('button', { name: /resume/i }).click();
  await expect(page.getByTestId('pause-overlay')).toHaveCount(0);
  await expect(page.locator('[role="gridcell"][data-origin="clue"]').first()).toBeVisible();
});
