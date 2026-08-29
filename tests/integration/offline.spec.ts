import { test, expect } from '@playwright/test';

/**
 * SC-009: "A player can disconnect from the network entirely and complete a full
 * solve session -- generation, play, saving, and reloading -- with no loss of
 * function and no gameplay data leaving the device."
 *
 * This is the strongest available proof of Principle II. If anything in the
 * gameplay path reaches the network, these fail.
 */

test('a full session works with the network disconnected', async ({ page, context }) => {
  // Load once, then cut the connection entirely.
  await page.goto('/');
  await page.locator('[role="grid"][aria-busy="false"]').waitFor();
  await context.setOffline(true);

  // Generation still works offline -- puzzles are computed, never fetched.
  await page.getByLabel(/difficulty/i).selectOption('hard');
  await page.locator('[role="grid"][aria-busy="false"]').waitFor();
  await expect(page.locator('[role="gridcell"][data-origin="clue"]').first()).toBeVisible();

  // Play: a value, pencil notes, erase, undo.
  const empties = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[role="gridcell"][data-origin="empty"]'))
      .slice(0, 2)
      .map((c) => c.getAttribute('data-index')!),
  );

  await page.locator(`[data-index="${empties[0]}"]`).click();
  await page.keyboard.press('6');
  await expect(page.locator(`[data-index="${empties[0]}"]`)).toContainText('6');

  await page.getByRole('switch', { name: /pencil|notes/i }).click();
  await page.locator(`[data-index="${empties[1]}"]`).click();
  await page.keyboard.press('2');
  await expect(page.locator(`[data-index="${empties[1]}"] [data-candidate="2"]`)).toBeVisible();

  await page.getByRole('button', { name: /undo/i }).click();
  await expect(page.locator(`[data-index="${empties[1]}"] [data-candidate="2"]`)).toHaveCount(0);

  // Timer runs, pause works.
  await expect(page.getByTestId('timer')).not.toHaveText('00:00', { timeout: 3000 });
  await page.getByRole('button', { name: /pause/i }).click();
  await expect(page.getByTestId('pause-overlay')).toBeVisible();
  await page.getByRole('button', { name: /resume/i }).click();

  await context.setOffline(false);
});

/**
 * KNOWN GAP, deliberately not papered over.
 *
 * SC-009 says a player can "disconnect from the network entirely and complete a
 * full solve session -- generation, play, saving, and RELOADING". Saving works
 * offline and is asserted below. Reloading offline does not, because serving the
 * app shell from cache needs a service worker, and no functional requirement or
 * task in this feature calls for one.
 *
 * Everything SC-009 asks for short of the reload is verified here; the reload
 * clause is recorded as an open gap for a scope decision rather than quietly
 * dropped from the criterion.
 */
test('saving works offline (the restore half of SC-009)', async ({ page, context }) => {
  await page.goto('/');
  await page.locator('[role="grid"][aria-busy="false"]').waitFor();
  await context.setOffline(true);

  const [index] = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[role="gridcell"][data-origin="empty"]'))
      .slice(0, 1)
      .map((c) => c.getAttribute('data-index')!),
  );

  await page.locator(`[data-index="${index}"]`).click();
  await page.keyboard.press('9');
  await page.waitForTimeout(500);

  // The write itself succeeded with no network -- storage is entirely local.
  const saved = await page.evaluate(() => {
    const raw = localStorage.getItem('agentic-sudoku/session');
    return raw === null ? null : (JSON.parse(raw) as { values: string }).values;
  });
  expect(saved).not.toBeNull();

  await context.setOffline(false);

  // And it restores on a reload once the shell can be fetched again.
  await page.reload();
  await page.locator('[role="grid"][aria-busy="false"]').waitFor();
  await expect(page.locator(`[data-index="${index}"]`)).toContainText('9');
});

test('zero network requests occur after the initial load', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const requests: string[] = [];
  page.on('request', (r) => requests.push(`${r.method()} ${r.url()}`));

  // Exercise the whole feature surface.
  await page.getByLabel(/difficulty/i).selectOption('medium');
  await page.locator('[role="grid"][aria-busy="false"]').waitFor();

  const [index] = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[role="gridcell"][data-origin="empty"]'))
      .slice(0, 1)
      .map((c) => c.getAttribute('data-index')!),
  );
  await page.locator(`[data-index="${index}"]`).click();
  await page.keyboard.press('4');
  await page.getByRole('switch', { name: /pencil|notes/i }).click();
  await page.getByRole('button', { name: /pause/i }).click();
  await page.getByRole('button', { name: /resume/i }).click();
  await page.waitForTimeout(800);

  expect(requests, `unexpected network activity: ${requests.join(', ')}`).toEqual([]);
});
