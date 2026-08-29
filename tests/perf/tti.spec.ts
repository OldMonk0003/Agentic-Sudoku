import { test, expect } from '@playwright/test';

/**
 * SC-001: "A first-time visitor is looking at a playable puzzle within 2 seconds
 * of opening the site, having taken zero actions to get there."
 *
 * The 4G simulation is the point -- the budget is meaningless on a loopback
 * connection with no latency.
 */

test('a playable puzzle appears within 2s on a fast connection', async ({ page }) => {
  const start = Date.now();
  await page.goto('/', { waitUntil: 'load' });
  await page.locator('[role="grid"][aria-busy="false"]').waitFor();
  await page.locator('[role="gridcell"][data-origin="clue"]').first().waitFor();

  const elapsed = Date.now() - start;
  console.log(`[perf] time to playable board (local): ${elapsed}ms`);
  expect(elapsed).toBeLessThan(2000);
});

test('a playable puzzle appears within 2s on simulated 4G (SC-001)', async ({ page, context }) => {
  // Simulated 4G: ~9Mbps down, 170ms RTT.
  const client = await context.newCDPSession(page);
  await client.send('Network.enable');
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: (9 * 1024 * 1024) / 8,
    uploadThroughput: (9 * 1024 * 1024) / 8,
    latency: 170,
  });

  const start = Date.now();
  await page.goto('/', { waitUntil: 'load' });
  await page.locator('[role="grid"][aria-busy="false"]').waitFor();
  await page.locator('[role="gridcell"][data-origin="clue"]').first().waitFor();

  const elapsed = Date.now() - start;
  console.log(`[perf] time to playable board (simulated 4G): ${elapsed}ms`);
  expect(elapsed).toBeLessThan(2000);
});

test('the visitor takes zero actions to reach a playable board', async ({ page }) => {
  await page.goto('/');
  await page.locator('[role="grid"][aria-busy="false"]').waitFor();

  // No dialog, no onboarding overlay, no consent gate standing in the way.
  await expect(page.locator('dialog')).toHaveCount(0);
  await expect(page.locator('[aria-modal="true"]')).toHaveCount(0);
  await expect(page.locator('[role="gridcell"][data-origin="clue"]').first()).toBeVisible();
});
