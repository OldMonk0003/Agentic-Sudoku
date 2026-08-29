import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Principle IV: interaction to next paint within 100ms, board validation within
 * 16ms. SC-004 restates the first in user terms.
 */

async function openReadyBoard(page: Page) {
  await page.goto('/');
  await page.locator('[role="grid"][aria-busy="false"]').waitFor();
  await page.locator('[role="gridcell"][data-origin="clue"]').first().waitFor();
}

test('selection and highlighting paint within 100ms (SC-004)', async ({ page }) => {
  await openReadyBoard(page);

  const durations = await page.evaluate(async () => {
    const cells = Array.from(document.querySelectorAll<HTMLElement>('[role="gridcell"]'));
    const samples: number[] = [];

    for (const cell of cells.slice(0, 20)) {
      const start = performance.now();
      cell.click();
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      samples.push(performance.now() - start);
    }
    return samples;
  });

  durations.sort((a, b) => a - b);
  const p95 = durations[Math.floor(durations.length * 0.95)]!;
  console.log(`[perf] selection-to-paint p50=${durations[10]!.toFixed(1)}ms p95=${p95.toFixed(1)}ms`);
  expect(p95).toBeLessThan(100);
});

test('digit entry paints within 100ms', async ({ page }) => {
  await openReadyBoard(page);

  const durations = await page.evaluate(async () => {
    const empties = Array.from(
      document.querySelectorAll<HTMLElement>('[role="gridcell"][data-origin="empty"]'),
    ).slice(0, 15);
    const samples: number[] = [];

    for (const cell of empties) {
      cell.click();
      const start = performance.now();
      cell.dispatchEvent(new KeyboardEvent('keydown', { key: '5', bubbles: true }));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      samples.push(performance.now() - start);
    }
    return samples;
  });

  durations.sort((a, b) => a - b);
  const p95 = durations[Math.floor(durations.length * 0.95)]!;
  console.log(`[perf] entry-to-paint p95=${p95.toFixed(1)}ms`);
  expect(p95).toBeLessThan(100);
});

test('no interaction produces a long task', async ({ page }) => {
  await openReadyBoard(page);

  const longTasks = await page.evaluate(async () => {
    const tasks: number[] = [];
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) tasks.push(entry.duration);
    });
    observer.observe({ entryTypes: ['longtask'] });

    const cells = Array.from(document.querySelectorAll<HTMLElement>('[role="gridcell"]'));
    for (const cell of cells.slice(0, 40)) {
      cell.click();
      cell.dispatchEvent(new KeyboardEvent('keydown', { key: '3', bubbles: true }));
    }

    await new Promise((r) => setTimeout(r, 500));
    observer.disconnect();
    return tasks;
  });

  console.log(`[perf] long tasks during 40 interactions: ${JSON.stringify(longTasks)}`);
  expect(longTasks.filter((d) => d > 50)).toEqual([]);
});
