import { test } from '@playwright/test';
import { installFakeHost } from '../support/browserFakeHost';

/**
 * The headed review harness -- quickstart.md Path B.
 *
 * This is a REVIEW AID, not a check. It asserts almost nothing; it opens a real
 * browser against the static export with a spec-conformant host installed before
 * load, runs the slice's demo calls, and then stops so a human can look at the
 * board and drive more calls themselves.
 *
 * It is excluded from `npm run test:e2e` by `testIgnore` in playwright.config.ts,
 * because it pauses waiting for a person.
 *
 *   npm run build && npm run review:agent -- --slice 2
 *
 * Everything it exercises is the production code path. Only the host is
 * substituted, and only because most browsers do not ship one yet.
 */

const slice = Number(process.env.REVIEW_SLICE ?? process.argv.find((a) => /^\d$/.test(a)) ?? 7);

test('agent review harness', async ({ page }) => {
  test.setTimeout(0); // a human is driving

  await page.addInitScript(installFakeHost);
  await page.goto('/');
  await page.waitForSelector('[role="gridcell"]');

  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await page.evaluate(
      ([n, a]) =>
        (window as unknown as { call: (n: string, a: object) => Promise<unknown> }).call(
          n as string,
          a as object,
        ),
      [name, args] as const,
    );
    console.log(`\n▶ ${name}\n`, JSON.stringify(result, null, 2));
    return result;
  };

  const names = await page.evaluate(async () =>
    (
      await document.modelContext!.getTools()
    ).map((t) => t.name),
  );
  console.log(`\nRegistered tools (${names.length}):`, names);

  // Slice 0 — perception.
  await call('get_board_state');
  await call('check_for_conflicts');
  await call('get_board_state', { nope: 1 }); // expect ok:false, unexpected-argument

  if (slice >= 1) {
    await call('highlight_pattern_cells', {
      target_cells: [{ row: 4, col: 5 }],
      because_cells: [{ row: 4, col: 1 }, { row: 4, col: 3 }],
      explanation: 'Only one cell in this box can still take a 7 — the others are ruled out by their row.',
    });
    await call('show_pattern_hint_toast', {
      explanation: 'Look for a digit that has only one home left in a box. That is a hidden single.',
    });
    await call('highlight_pattern_cells', { target_cells: [{ row: 1, col: 1 }] }); // expect rejection
  }

  if (slice >= 2) {
    await call('fill_cell', {
      row: 4,
      col: 5,
      digit: 7,
      explanation: 'Only 7 can go here — the other eight digits already appear in this box.',
    });
  }

  if (slice >= 3) {
    await call('draw_constraint_beams', {
      beams: [
        { unit_type: 'row', unit_number: 3, digit: 6 },
        { unit_type: 'col', unit_number: 7, digit: 6 },
      ],
      explanation: 'Row 3 and column 7 already contain a 6, so their intersection cannot take one.',
    });
  }

  if (slice >= 4) {
    await call('auto_fill_all_pencil_marks', {
      explanation: 'Pencilling in every legal candidate so the naked pairs become visible to you.',
    });
  }

  // The browser stays open. Use the DevTools console: call('get_board_state')
  await page.pause();
});
