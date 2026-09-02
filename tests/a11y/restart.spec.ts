import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * The Restart control's accessibility contract (001/FR-046, FR-048, FR-050).
 *
 * Nothing exotic -- it is an ordinary button, and that is the point. It is
 * verified here rather than assumed because it is a NEW control on a page whose
 * accessibility is a gate rather than a follow-up (constitution, Accessibility),
 * and because it is destructive: a learner who cannot see it clearly is a
 * learner who presses it by accident.
 */

const restart = (page: Page) => page.getByRole('button', { name: /restart/i });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.locator('[role="grid"][aria-busy="false"]').waitFor();
});

test('axe is clean with the control present', async ({ page }) => {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('it has an accessible name and is a real button', async ({ page }) => {
  await expect(restart(page)).toBeVisible();
  await expect(restart(page)).toHaveJSProperty('tagName', 'BUTTON');
});

test('it is reachable by keyboard with a visible focus indicator', async ({ page }) => {
  await restart(page).focus();
  await expect(restart(page)).toBeFocused();

  // 001/FR-046 requires the indicator to be visible, not merely present.
  const outline = await restart(page).evaluate((el) => {
    const style = getComputedStyle(el, ':focus-visible');
    return { width: style.outlineWidth, style: style.outlineStyle };
  });
  expect(outline.style).not.toBe('none');
});

test('it does not convey its meaning by colour or icon alone', async ({ page }) => {
  // The glyph is decoration; the word carries the meaning.
  await expect(restart(page)).toContainText(/restart/i);
});

test('it stays usable at the narrowest supported viewport', async ({ page }) => {
  // 001/FR-050: 360px, no horizontal page scroll.
  await page.setViewportSize({ width: 360, height: 780 });
  await page.locator('[role="grid"][aria-busy="false"]').waitFor();

  await expect(restart(page)).toBeVisible();

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflows, 'the page must not scroll horizontally at 360px').toBe(false);

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('it is not adjacent to Undo in the tab order', async ({ page }) => {
  /*
    005/research.md R7, asserted rather than left to layout drift.

    Restart replaces the board without asking, and Erase and Undo are the two
    most-pressed, lowest-stakes controls on the page. A learner tabbing quickly
    between them must not land on Restart by accident -- the consequence is a
    board that cannot be recovered, because a replaced board is not in the undo
    history and only one game is ever saved.
  */
  const order = await page.evaluate(() => {
    const focusable = [...document.querySelectorAll<HTMLElement>('button, select, [tabindex]:not([tabindex="-1"])')];
    return focusable.map((el) => (el.textContent || el.getAttribute('aria-label') || '').trim().toLowerCase());
  });

  const restartAt = order.findIndex((label) => /restart/.test(label));
  const undoAt = order.findIndex((label) => /^undo$/.test(label));

  expect(restartAt, 'Restart should be in the tab order').toBeGreaterThan(-1);
  expect(undoAt, 'Undo should be in the tab order').toBeGreaterThan(-1);
  expect(Math.abs(restartAt - undoAt), 'Restart must not sit next to Undo').toBeGreaterThan(1);
});
