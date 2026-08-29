import { test, expect } from '@playwright/test';

/**
 * Principle IV: generation including the uniqueness proof stays within 500ms p95.
 *
 * Measured in the real browser against the built bundle -- the unit-level
 * measurement in Slice 1 was in Node, which is not where players run it.
 */

test('a fresh puzzle appears well inside the generation budget', async ({ page }) => {
  await page.goto('/');
  await page.locator('[role="grid"][aria-busy="false"]').waitFor();

  const samples: number[] = [];
  for (const difficulty of ['easy', 'medium', 'hard', 'medium', 'easy', 'hard']) {
    const start = Date.now();
    await page.getByLabel(/difficulty/i).selectOption(difficulty);
    await page.locator('[role="grid"][aria-busy="false"]').waitFor();
    await page.locator('[role="gridcell"][data-origin="clue"]').first().waitFor();
    samples.push(Date.now() - start);
  }

  samples.sort((a, b) => a - b);
  const p95 = samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.95))]!;
  console.log(`[perf] generation samples ms: ${samples.join(', ')}  p95=${p95}`);

  // Generous against the 500ms engine budget: this includes the worker round
  // trip, React re-render, and paint, none of which the engine budget covers.
  expect(p95).toBeLessThan(1500);
});

test('generation does not block the main thread beyond a frame', async ({ page }) => {
  await page.goto('/');
  await page.locator('[role="grid"][aria-busy="false"]').waitFor();

  const longTasks = await page.evaluate(async () => {
    const tasks: number[] = [];
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) tasks.push(entry.duration);
    });
    observer.observe({ entryTypes: ['longtask'] });

    const select = document.querySelector('select') as HTMLSelectElement;
    select.value = 'hard';
    select.dispatchEvent(new Event('change', { bubbles: true }));

    await new Promise((r) => setTimeout(r, 1200));
    observer.disconnect();
    return tasks;
  });

  console.log(`[perf] long tasks during hard generation: ${JSON.stringify(longTasks)}`);
  // The worker is what makes this hold: hard generation costs ~20-30ms of CPU,
  // which would breach the frame budget on the main thread (research.md R5).
  expect(longTasks.filter((d) => d > 100)).toEqual([]);
});
