import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** FR-050: usable to a 360px viewport with no horizontal page scroll. */

async function openReadyBoard(page: Page) {
  await page.goto('/');
  await page.locator('[role="grid"][aria-busy="false"]').waitFor();
  await page.locator('[role="gridcell"][data-origin="clue"]').first().waitFor();
}

const VIEWPORTS = [
  { name: '360px phone', width: 360, height: 780 },
  { name: '390px phone', width: 390, height: 844 },
  { name: '768px tablet', width: 768, height: 1024 },
  { name: '1280px desktop', width: 1280, height: 800 },
];

for (const viewport of VIEWPORTS) {
  test(`no horizontal page scroll at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openReadyBoard(page);

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));

    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
  });

  test(`the board stays square and visible at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openReadyBoard(page);

    const box = (await page.locator('[role="grid"]').boundingBox())!;
    expect(Math.abs(box.width - box.height)).toBeLessThan(2);
    expect(box.width).toBeGreaterThan(200);
    expect(box.x).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  });
}

test('keypad targets stay at least 44px at 360px (FR-050)', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await openReadyBoard(page);

  const heights = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[role="group"][aria-label="Number pad"] button')).map(
      (b) => b.getBoundingClientRect().height,
    ),
  );

  expect(heights).toHaveLength(9);
  for (const height of heights) expect(height).toBeGreaterThanOrEqual(44);
});

test('every control remains reachable at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await openReadyBoard(page);

  await expect(page.getByLabel(/difficulty/i)).toBeVisible();
  await expect(page.getByRole('switch', { name: /pencil|notes/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /pause/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /erase/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /undo/i })).toBeVisible();
});
