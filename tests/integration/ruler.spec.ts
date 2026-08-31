import { test, expect } from '@playwright/test';
import { installFakeHost } from '../support/browserFakeHost';

/**
 * FR-012 and FR-015 -- the ruler persists, and does NOT expire.
 *
 * The expiry test is the one that earns its place. Every other mark the agent
 * puts on this board self-destructs after sixty seconds (002/FR-033), and for
 * good reason: an abandoned agent session must not be able to deface the board
 * permanently. The ruler is the single exemption, because a coordinate guide
 * that vanishes mid-conversation defeats the entire purpose of having one.
 *
 * That exemption is a decision, not an oversight, so it gets a test.
 */

const EXPLANATION = 'Numbering the grid so you can name a cell to me without counting squares first.';

async function call(page: import('@playwright/test').Page, name: string, args: Record<string, unknown> = {}) {
  return page.evaluate(
    ([n, a]) =>
      (window as unknown as { call: (n: string, a: object) => Promise<unknown> }).call(
        n as string,
        a as object,
      ),
    [name, args] as const,
  );
}

const ruler = (page: import('@playwright/test').Page) => page.getByTestId('ruler-columns');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installFakeHost);
  await page.goto('/');
  await page.waitForSelector('[role="gridcell"]');
});

test('the board starts unruled', async ({ page }) => {
  await expect(ruler(page)).toHaveCount(0);
});

test('the agent can number both axes', async ({ page }) => {
  await call(page, 'show_coordinate_ruler', { explanation: EXPLANATION });

  await expect(page.getByTestId('ruler-columns')).toBeVisible();
  await expect(page.getByTestId('ruler-rows')).toBeVisible();
});

test('the ruler survives a reload (FR-015)', async ({ page }) => {
  await call(page, 'show_coordinate_ruler', { explanation: EXPLANATION });
  await expect(ruler(page)).toBeVisible();

  await page.reload();
  await page.waitForSelector('[role="gridcell"]');
  await expect(ruler(page)).toBeVisible();
});

test('a hidden ruler stays hidden across a reload', async ({ page }) => {
  await call(page, 'show_coordinate_ruler', { explanation: EXPLANATION });
  await call(page, 'hide_coordinate_ruler', { explanation: EXPLANATION });

  await page.reload();
  await page.waitForSelector('[role="gridcell"]');
  await expect(ruler(page)).toHaveCount(0);
});

/*
  The exemption from 002/FR-033, tested directly. Annotations and toasts are
  gone after sixty seconds; the ruler is not. We advance the page clock rather
  than waiting, so this costs milliseconds.
*/
test('the ruler does not expire like an annotation (FR-012)', async ({ page }) => {
  await call(page, 'show_coordinate_ruler', { explanation: EXPLANATION });

  // Well past ANNOTATION_TTL_MS, and past the expiry tick that reaps them.
  await page.clock.install();
  await page.clock.fastForward('05:00');

  await expect(ruler(page)).toBeVisible();
});

test('the learner can turn the ruler on themselves', async ({ page }) => {
  await page.getByRole('switch', { name: /row and column|coordinate|guides|numbers/i }).click();
  await expect(ruler(page)).toBeVisible();
});

test('the ruler changes nothing about the game (FR-014)', async ({ page }) => {
  const before = await page.evaluate(() => ({
    cells: [...document.querySelectorAll('[role="gridcell"]')].map((c) => c.textContent),
    timer: document.querySelector('[data-testid="timer"]')?.textContent,
  }));

  await call(page, 'show_coordinate_ruler', { explanation: EXPLANATION });

  const after = await page.evaluate(() => ({
    cells: [...document.querySelectorAll('[role="gridcell"]')].map((c) => c.textContent),
    timer: document.querySelector('[data-testid="timer"]')?.textContent,
  }));

  expect(after.cells).toEqual(before.cells);
});

test('Undo is unaffected by the ruler (FR-014)', async ({ page }) => {
  const undo = page.getByRole('button', { name: /undo/i });
  await expect(undo).toBeDisabled();

  await call(page, 'show_coordinate_ruler', { explanation: EXPLANATION });

  // Showing the ruler created nothing to undo.
  await expect(undo).toBeDisabled();
});
