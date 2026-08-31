import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * The ruler's accessibility contract (FR-016, FR-017).
 *
 * The central assertion is a NEGATIVE one: the gutters must be absent from the
 * accessibility tree. Every cell already announces its own coordinates
 * (001/FR-047), so exposing the ruler would append a second coordinate to every
 * cell announcement -- making the board worse for a screen-reader learner in
 * service of an aid that exists to stop sighted learners counting squares.
 *
 * The toggle itself IS exposed, and is the learner's own control.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('[role="gridcell"]');
});

const toggle = (page: import('@playwright/test').Page) =>
  page.getByRole('switch', { name: /row and column|coordinate|guides|numbers/i });

test('axe is clean with the ruler hidden', async ({ page }) => {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('axe is clean with the ruler shown', async ({ page }) => {
  await toggle(page).click();
  await expect(page.getByTestId('ruler-columns')).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('the gutters are not in the accessibility tree (FR-017)', async ({ page }) => {
  await toggle(page).click();
  await expect(page.getByTestId('ruler-columns')).toBeVisible();

  const snapshot = JSON.stringify(await page.accessibility.snapshot());
  expect(snapshot).not.toMatch(/Columns/);
});

test('cell announcements are unchanged by the ruler (001/FR-047)', async ({ page }) => {
  const first = page.locator('[role="gridcell"]').first();
  const before = await first.getAttribute('aria-label');

  await toggle(page).click();
  await expect(page.getByTestId('ruler-columns')).toBeVisible();

  expect(await first.getAttribute('aria-label')).toBe(before);
});

test('the toggle is reachable and operable by keyboard alone', async ({ page }) => {
  await page.keyboard.press('Tab');
  for (let i = 0; i < 12; i++) {
    const focused = await page.evaluate(() => document.activeElement?.getAttribute('role'));
    const name = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent);
    if (focused === 'switch' && /row and column|coordinate|guides|numbers/i.test(name ?? '')) break;
    await page.keyboard.press('Tab');
  }

  await page.keyboard.press('Enter');
  await expect(page.getByTestId('ruler-columns')).toBeVisible();
});

test('the board stays usable at 360px with the ruler shown (FR-016)', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await toggle(page).click();
  await expect(page.getByTestId('ruler-columns')).toBeVisible();

  // The grid must not be squeezed out of usability by the gutters. A cell has
  // to remain a real tap target.
  const cell = await page.locator('[role="gridcell"]').first().boundingBox();
  expect(cell!.width).toBeGreaterThan(24);
  expect(cell!.height).toBeGreaterThan(24);

  // And the page must not scroll sideways.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
