import { test, expect } from '@playwright/test';

/**
 * Zero server runtime (Principle II) can only be proved against the static
 * export served by a plain file server. `next dev` cannot prove it, because the
 * dev server is a server. playwright.config.ts serves `out/` for exactly this.
 */

test('renders the board from static files with no server runtime', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('grid', { name: /sudoku/i })).toBeVisible();
});

test('draws all 81 cells', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('gridcell')).toHaveCount(81);
});

test('makes no network request after load (FR-043, SC-009)', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const lateRequests: string[] = [];
  page.on('request', (r) => lateRequests.push(r.url()));

  await page.getByRole('gridcell').first().click();
  await page.waitForTimeout(500);

  expect(lateRequests).toEqual([]);
});

/**
 * REGRESSION: the first Slice 0 build had all 81 cells in the DOM and passing
 * tests, but rendered an INVISIBLE grid -- `border-hairline` is not a Tailwind v4
 * width utility and preflight sets border-width to 0. Counting elements proved
 * nothing. These assert the grid is actually drawn, and that the 3x3 structure is
 * carried by weight rather than colour (FR-053).
 */
test('actually draws the grid lines', async ({ page }) => {
  await page.goto('/');

  const widths = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[role="gridcell"]')).map((cell) => {
      const s = getComputedStyle(cell as HTMLElement);
      return { right: parseFloat(s.borderRightWidth), bottom: parseFloat(s.borderBottomWidth) };
    }),
  );

  // Every cell except those on the outer right/bottom edge draws a line.
  const drawn = widths.filter((w) => w.right > 0 || w.bottom > 0);
  expect(drawn.length).toBeGreaterThanOrEqual(72);
});

test('box seams are heavier than cell hairlines (FR-053)', async ({ page }) => {
  await page.goto('/');

  const measure = (index: number) =>
    page.evaluate((i) => {
      const cell = document.querySelector(`[data-index="${i}"]`) as HTMLElement;
      const s = getComputedStyle(cell);
      return parseFloat(s.borderRightWidth);
    }, index);

  // Row 1: column 3 ends a box (heavy); column 4 is interior to a box (hairline).
  const boxSeam = await measure(2);
  const hairline = await measure(3);

  expect(boxSeam).toBeGreaterThan(hairline);
  expect(hairline).toBeGreaterThan(0);
});

test('board frame is visible', async ({ page }) => {
  await page.goto('/');
  const frame = await page.evaluate(() => {
    const grid = document.querySelector('[role="grid"]') as HTMLElement;
    return parseFloat(getComputedStyle(grid).borderTopWidth);
  });
  expect(frame).toBeGreaterThan(0);
});

/**
 * REGRESSION: wrapping the board for the pause overlay shrink-wrapped it -- the
 * wrapper had no width, so the board's own `w-full max-w-[...]` collapsed with
 * it. Every test still passed while the board rendered at a fraction of its size.
 */
test('the board fills its available width and stays square', async ({ page }) => {
  await page.goto('/');
  await page.locator('[role="grid"][aria-busy="false"]').waitFor();

  const box = await page.locator('[role="grid"]').boundingBox();
  expect(box).not.toBeNull();

  // Square within a pixel of rounding.
  expect(Math.abs(box!.width - box!.height)).toBeLessThan(2);
  // And actually large -- not collapsed to a fraction of the viewport.
  const viewport = page.viewportSize()!;
  expect(box!.width).toBeGreaterThan(Math.min(viewport.width, viewport.height) * 0.55);
});

test('paints the Japandi ground rather than plain white', async ({ page }) => {
  await page.goto('/');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).not.toBe('rgb(255, 255, 255)');
  expect(bg).not.toBe('rgba(0, 0, 0, 0)');
});
