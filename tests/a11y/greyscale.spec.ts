import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * SC-010 / FR-009: the highlight tiers must remain distinguishable with colour
 * removed. This is the check that forced the selection ring -- four stacked
 * washes could not survive greyscale AND keep text at 4.5:1 (research.md R3).
 */

async function openReadyBoard(page: Page) {
  await page.goto('/');
  await page.locator('[role="grid"][aria-busy="false"]').waitFor();
  await page.locator('[role="gridcell"][data-origin="clue"]').first().waitFor();
}

/** Relative luminance of a computed `rgb(...)` colour. */
async function luminanceOf(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement;
    const parts = getComputedStyle(el).backgroundColor.match(/[\d.]+/g)!.map(Number);
    const [r, g, b, a = 1] = parts;
    if (a === 0) throw new Error(`${sel} has a transparent background; tiers must resolve to a real colour`);
    const lin = (c: number) => {
      const v = c / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * lin(r!) + 0.7152 * lin(g!) + 0.0722 * lin(b!);
  }, selector);
}

test('crosshair, matching and plain cells separate by LUMINANCE, not hue alone', async ({ page }) => {
  await openReadyBoard(page);

  // Select a clue so both crosshair and matching tiers are on screen at once.
  await page.locator('[role="gridcell"][data-origin="clue"]').first().click();

  await page.locator('[data-tier="crosshair"]').first().waitFor();
  await page.locator('[data-tier="matching"]').first().waitFor();

  const plain = await luminanceOf(page, '[data-tier="none"]');
  const crosshair = await luminanceOf(page, '[data-tier="crosshair"]');
  const matching = await luminanceOf(page, '[data-tier="matching"]');

  // A strictly descending ladder survives greyscale conversion.
  expect(plain).toBeGreaterThan(crosshair);
  expect(crosshair).toBeGreaterThan(matching);

  // And each step is actually perceptible, not a rounding difference.
  expect(plain - crosshair).toBeGreaterThan(0.02);
  expect(crosshair - matching).toBeGreaterThan(0.02);
});

test('the selected cell is marked by an outline, which is colour-independent', async ({ page }) => {
  await openReadyBoard(page);
  await page.locator('[data-index="40"]').click();

  const outline = await page.evaluate(() => {
    const el = document.querySelector('[data-selected="true"]') as HTMLElement;
    const s = getComputedStyle(el);
    return { width: parseFloat(s.outlineWidth), style: s.outlineStyle };
  });

  expect(outline.width).toBeGreaterThanOrEqual(2);
  expect(outline.style).not.toBe('none');
});

test('matching-digit cells carry a weight cue as well as a wash (FR-009)', async ({ page }) => {
  await openReadyBoard(page);
  await page.locator('[role="gridcell"][data-origin="clue"]').first().click();

  const weights = await page.evaluate(() => {
    const matching = document.querySelector('[data-tier="matching"]') as HTMLElement;
    const plain = document.querySelector('[data-tier="none"][data-origin="clue"]') as HTMLElement;
    return {
      matching: getComputedStyle(matching).fontWeight,
      plain: plain ? getComputedStyle(plain).fontWeight : null,
    };
  });

  expect(Number(weights.matching)).toBeGreaterThanOrEqual(500);
});

test('selecting an empty cell shows crosshair but NO matching highlight (FR-011)', async ({ page }) => {
  await openReadyBoard(page);
  await page.locator('[role="gridcell"][data-origin="empty"]').first().click();

  await expect(page.locator('[data-tier="crosshair"]').first()).toBeVisible();
  await expect(page.locator('[data-tier="matching"]')).toHaveCount(0);
});
