import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Performance budgets (Principle IV).
 *
 * IMPORTANT: the 250 KB gzipped first-load JS budget is DEFERRED by author
 * decision (plan.md, Complexity Tracking). It is reported here as informational
 * output and blocks nothing. Every TIMING budget still gates.
 */

test('reports first-load JS size (informational — budget deferred)', () => {
  const chunkDir = join(process.cwd(), 'out', '_next', 'static', 'chunks');
  if (!existsSync(chunkDir)) {
    test.skip(true, 'no build output; run npm run build first');
    return;
  }

  let rawBytes = 0;
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith('.js')) rawBytes += statSync(full).size;
    }
  };
  walk(chunkDir);

  const gzipped = Number(
    execSync(`cat $(find ${chunkDir} -name '*.js') | gzip -c | wc -c`, { shell: '/bin/sh' })
      .toString()
      .trim(),
  );

  console.log(
    `[budget:informational] JS raw ${(rawBytes / 1024).toFixed(1)} KB, ` +
      `gzipped ${(gzipped / 1024).toFixed(1)} KB (250 KB budget deferred — blocks nothing)`,
  );

  expect(gzipped).toBeGreaterThan(0);
});

test('time to interactive stays within 2s (SC-001)', async ({ page }) => {
  const start = Date.now();
  await page.goto('/', { waitUntil: 'load' });
  await page.getByRole('grid', { name: /sudoku/i }).waitFor();
  expect(Date.now() - start).toBeLessThan(2000);
});

test('no long task blocks the main thread beyond one frame on interaction', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const longTasks = await page.evaluate(async () => {
    const tasks: number[] = [];
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) tasks.push(entry.duration);
    });
    observer.observe({ entryTypes: ['longtask'] });
    document.querySelector<HTMLElement>('[role="gridcell"]')?.click();
    await new Promise((r) => setTimeout(r, 600));
    observer.disconnect();
    return tasks;
  });

  expect(longTasks.filter((d) => d > 50)).toEqual([]);
});
