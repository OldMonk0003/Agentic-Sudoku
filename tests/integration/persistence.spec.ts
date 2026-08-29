import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** User Story 6 acceptance scenarios, end to end. */

async function openReadyBoard(page: Page) {
  await page.goto('/');
  await page.locator('[role="grid"][aria-busy="false"]').waitFor();
  await page.locator('[role="gridcell"][data-origin="clue"]').first().waitFor();
}

async function boardFingerprint(page: Page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('[role="gridcell"]')).map((c) => ({
      index: c.getAttribute('data-index'),
      origin: c.getAttribute('data-origin'),
      text: c.textContent?.trim() ?? '',
    })),
  );
}

test('restores the exact board, notes and elapsed time after a reload (FR-041)', async ({ page }) => {
  await openReadyBoard(page);

  const empties = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[role="gridcell"][data-origin="empty"]'))
      .slice(0, 3)
      .map((c) => c.getAttribute('data-index')!),
  );

  // A value, then two pencilled candidates.
  await page.locator(`[data-index="${empties[0]}"]`).click();
  await page.keyboard.press('7');

  await page.getByRole('switch', { name: /pencil|notes/i }).click();
  await page.locator(`[data-index="${empties[1]}"]`).click();
  await page.keyboard.press('3');
  await page.keyboard.press('9');

  // Let the clock advance and the debounced save land.
  await expect(page.getByTestId('timer')).not.toHaveText('00:00', { timeout: 3000 });
  await page.waitForTimeout(500);

  const before = await boardFingerprint(page);
  const elapsedBefore = await page.getByTestId('timer').textContent();

  await page.reload();
  await page.locator('[role="grid"][aria-busy="false"]').waitFor();

  expect(await boardFingerprint(page)).toEqual(before);
  await expect(page.locator(`[data-index="${empties[0]}"]`)).toContainText('7');
  await expect(page.locator(`[data-index="${empties[1]}"] [data-candidate="3"]`)).toBeVisible();
  await expect(page.locator(`[data-index="${empties[1]}"] [data-candidate="9"]`)).toBeVisible();

  // Elapsed time survives; it must not restart at zero.
  await expect(page.getByTestId('timer')).not.toHaveText('00:00');
  expect(elapsedBefore).not.toBe('00:00');
});

test('does NOT restore undo history — documented behaviour, not a defect', async ({ page }) => {
  await openReadyBoard(page);
  const [index] = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[role="gridcell"][data-origin="empty"]'))
      .slice(0, 1)
      .map((c) => c.getAttribute('data-index')!),
  );

  await page.locator(`[data-index="${index}"]`).click();
  await page.keyboard.press('5');
  await expect(page.getByRole('button', { name: /undo/i })).toBeEnabled();
  await page.waitForTimeout(500);

  await page.reload();
  await page.locator('[role="grid"][aria-busy="false"]').waitFor();

  await expect(page.locator(`[data-index="${index}"]`)).toContainText('5');
  await expect(page.getByRole('button', { name: /undo/i })).toBeDisabled();
});

test('discards corrupt saved data and starts fresh, with no error screen (FR-044)', async ({ page }) => {
  await openReadyBoard(page);
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) localStorage.setItem(key, 'corrupted{{{');
  });

  await page.reload();
  await page.locator('[role="grid"][aria-busy="false"]').waitFor();

  // A playable board, not a broken one.
  await expect(page.locator('[role="gridcell"][data-origin="clue"]').first()).toBeVisible();
  await expect(page.locator('[role="gridcell"]')).toHaveCount(81);
});

test('stays playable when storage is unavailable, and says so once (FR-042)', async ({ page }) => {
  // Block storage before any script runs.
  await page.addInitScript(() => {
    const boom = () => {
      throw new DOMException('SecurityError');
    };
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => ({ getItem: boom, setItem: boom, removeItem: boom }),
    });
  });

  await openReadyBoard(page);

  // Fully playable.
  const [index] = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[role="gridcell"][data-origin="empty"]'))
      .slice(0, 1)
      .map((c) => c.getAttribute('data-index')!),
  );
  await page.locator(`[data-index="${index}"]`).click();
  await page.keyboard.press('8');
  await expect(page.locator(`[data-index="${index}"]`)).toContainText('8');

  // Told once, unobtrusively -- not a modal, not a blocker.
  const notice = page.getByTestId('storage-notice');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText(/progress|saved/i);
  await expect(page.locator('dialog')).toHaveCount(0);
});

test('the saved payload never contains a complete 81-digit grid', async ({ page }) => {
  await openReadyBoard(page);
  await page.waitForTimeout(500);

  const leaked = await page.evaluate(() =>
    Object.keys(localStorage).some((k) => /\d{81}/.test(localStorage.getItem(k) ?? '')),
  );
  expect(leaked).toBe(false);
});
