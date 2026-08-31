import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { installFakeHost } from '../support/browserFakeHost';

/**
 * FR-020, FR-021, FR-025, FR-027.
 *
 * The greyscale test is the one that earns its place. The learner's crosshair
 * and the agent's spotlight are the two markings most likely to be confused,
 * and they will be on screen together constantly. If the only thing separating
 * them is hue, a learner with a colour vision deficiency sees one board with two
 * identical highlights and cannot tell which marks are theirs.
 *
 * The separation is by FORM -- flat wash versus dashed edge rule -- which is
 * what survives greyscale with no colour at all.
 */

const EXPLANATION = 'Only a nine fits here, because the other eight digits already appear in this box.';

async function call(page: Page, name: string, args: Record<string, unknown> = {}) {
  return page.evaluate(
    ([n, a]) =>
      (window as unknown as { call: (n: string, a: object) => Promise<unknown> }).call(
        n as string,
        a as object,
      ),
    [name, args] as const,
  );
}

async function fillSomewhere(page: Page) {
  const target = await page.evaluate(() => {
    const cells = document.querySelectorAll('[role="gridcell"]');
    for (let i = 0; i < cells.length; i++) {
      if (!cells[i]!.textContent?.trim()) return { row: Math.floor(i / 9) + 1, col: (i % 9) + 1 };
    }
    return null;
  });
  await call(page, 'fill_cell', { ...target, digit: 9, explanation: EXPLANATION });
  return target!;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installFakeHost);
  await page.goto('/');
  await page.waitForSelector('[role="gridcell"]');
});

test('axe is clean with a spotlight on screen', async ({ page }) => {
  await fillSomewhere(page);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('axe is clean with the learner crosshair AND the spotlight together', async ({ page }) => {
  await page.locator('[data-index="65"]').click();
  await fillSomewhere(page);

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('the two markings are separated by form, not only colour (FR-021)', async ({ page }) => {
  await page.locator('[data-index="65"]').click();
  await fillSomewhere(page);

  // Strip every colour from the page. What remains must still distinguish them.
  await page.addStyleTag({ content: 'html { filter: grayscale(1) !important; }' });

  const spotlit = page.locator('[data-spotlit="true"]').first();
  const outline = await spotlit.evaluate((el) => {
    const style = getComputedStyle(el);
    return { style: style.outlineStyle, width: style.outlineWidth };
  });

  // A dashed rule is a FORM cue: it reads as a dash with no colour at all.
  expect(outline.style).toBe('dashed');
  expect(parseFloat(outline.width)).toBeGreaterThan(0);

  // The learner's own selection is still a ring, which is a different form.
  const learner = page.locator('[data-index="65"]');
  const ring = await learner.evaluate((el) => getComputedStyle(el).boxShadow);
  expect(ring).not.toBe('none');
});

test('the spotlight is announced politely and takes no focus (FR-025)', async ({ page }) => {
  const before = await page.evaluate(() => document.activeElement?.tagName);
  const target = await fillSomewhere(page);

  const announcement = page.getByTestId('annotation-announcement');
  await expect(announcement).toHaveAttribute('aria-live', 'polite');
  await expect(announcement).toContainText(new RegExp(`row ${target.row}`, 'i'));

  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe(before);
});

test('a spotlit cell says so in its own label, in place (FR-025)', async ({ page }) => {
  const target = await fillSomewhere(page);
  const index = (target.row - 1) * 9 + (target.col - 1);

  const label = await page.locator(`[data-index="${index}"]`).getAttribute('aria-label');
  expect(label).toMatch(/agent/i);
});

test('reduced motion suppresses any spotlight transition (FR-027)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await page.waitForSelector('[role="gridcell"]');
  await fillSomewhere(page);

  const animated = await page.locator('[data-spotlit="true"]').first().evaluate((el) => {
    const style = getComputedStyle(el);
    return style.animationName !== 'none' && style.animationDuration !== '0s';
  });
  expect(animated).toBe(false);
});
