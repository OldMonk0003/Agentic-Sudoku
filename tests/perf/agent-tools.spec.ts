import { test, expect } from '@playwright/test';
import { installFakeHost } from '../support/browserFakeHost';

/**
 * Principle IV: "Agent tool call, invocation to returned result: <= 100 ms
 * (excluding generation)", measured at p95.
 *
 * Two tools are EXEMPT by recorded deviation, and the exemption is deliberate
 * rather than a concession to slowness — see plan.md § Complexity Tracking:
 *
 *   - playback_deduction_sequence  paces steps for a human to watch
 *   - load_technique_practice      waits for a human to answer a confirmation
 *
 * Both resolve only when something outside our control finishes, and FR-049 and
 * FR-053 require them to report that outcome — which an early acknowledgement
 * could not carry. Every other tool gates here.
 */

const EXEMPT = new Set(['playback_deduction_sequence', 'load_technique_practice']);
const BUDGET_MS = 100;
const SAMPLES = 40;

/** Representative valid input per tool, so we measure work rather than rejection. */
const INPUTS: Record<string, Record<string, unknown>> = {
  get_board_state: {},
  check_for_conflicts: {},
  highlight_pattern_cells: {
    target_cells: [{ row: 4, col: 5 }],
    because_cells: [{ row: 4, col: 1 }],
    explanation: 'Pointing at the one cell in this box that can still take a seven.',
  },
  show_pattern_hint_toast: {
    explanation: 'Look for a digit with only one home left in a box — that is a hidden single.',
  },
  clear_visual_annotations: {
    explanation: 'Clearing my marks so we can look at the next pattern with fresh eyes.',
  },
  draw_constraint_beams: {
    beams: [{ unit_type: 'row', unit_number: 3, digit: 6 }],
    explanation: 'Row 3 already contains a six, so nothing else in that row can take one.',
  },
  update_pencil_marks: {
    cells: [{ row: 5, col: 5, digits: [1, 2] }],
    explanation: 'Narrowing this cell to the only two digits its row and column still permit.',
  },
  auto_fill_all_pencil_marks: {
    acknowledges_replacing_marks: true,
    explanation: 'Pencilling every legal candidate so the naked pairs become visible to you.',
  },
};

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]!;
}

test('every non-exempt tool returns within the 100 ms budget at p95', async ({ page }) => {
  await page.addInitScript(installFakeHost);
  await page.goto('/');
  await page.waitForSelector('[role="gridcell"]');

  const names: string[] = await page.evaluate(async () =>
    (
      await document.modelContext!.getTools()
    ).map((t) => t.name),
  );
  expect(names.length).toBeGreaterThan(0);

  const report: Record<string, number> = {};

  for (const name of names) {
    if (EXEMPT.has(name)) continue;

    const timings: number[] = await page.evaluate(
      async ([toolName, samples, input]) => {
        const mc = document.modelContext!;
        const tool = (await mc.getTools()).find((t) => t.name === toolName)!;
        const measured: number[] = [];
        for (let i = 0; i < (samples as number); i++) {
          const start = performance.now();
          await mc.executeTool(tool, input as object);
          measured.push(performance.now() - start);
        }
        return measured;
      },
      [name, SAMPLES, INPUTS[name] ?? {}] as const,
    );

    report[name] = Math.round(percentile(timings, 95) * 100) / 100;
  }

  console.log('agent tool call p95 (ms):', report);

  for (const [name, p95] of Object.entries(report)) {
    expect(p95, `${name} p95`).toBeLessThanOrEqual(BUDGET_MS);
  }
});

test('a tool call does not block the main thread beyond one frame', async ({ page }) => {
  await page.addInitScript(installFakeHost);
  await page.goto('/');
  await page.waitForSelector('[role="gridcell"]');

  const longTasks: number[] = await page.evaluate(async () => {
    const observed: number[] = [];
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) observed.push(entry.duration);
    });
    observer.observe({ entryTypes: ['longtask'] });

    const mc = document.modelContext!;
    const tool = (await mc.getTools()).find((t) => t.name === 'get_board_state')!;
    for (let i = 0; i < 30; i++) await mc.executeTool(tool, {});

    await new Promise((resolve) => setTimeout(resolve, 200));
    observer.disconnect();
    return observed;
  });

  // Principle IV: blocking the main thread beyond one 16 ms frame is prohibited.
  // A long task is >50 ms, so any entry here is well past the line.
  expect(longTasks).toEqual([]);
});
