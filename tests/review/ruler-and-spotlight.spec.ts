import { test } from '@playwright/test';
import { installFakeHost } from '../support/browserFakeHost';

/**
 * The screenshot harness for feature 003 -- tasks T004, T032, T052.
 *
 * THIS IS NOT A CHECK. It asserts nothing. It captures the board in every state
 * this feature adds, at 360px and at desktop, in colour and in greyscale, so a
 * human can LOOK at them.
 *
 * That is not belt-and-braces. THREE purely visual defects have shipped past a
 * fully green suite in this project: an invisible grid (all 81 cells in the DOM,
 * zero borders rendered), a board shrink-wrapped to half size, and an agent
 * hatch whose diagonal stripes ran straight through the digit underneath. The
 * third is the instructive one -- the palette contrast test computes ratios
 * against a FLAT token, while the damage was done by STRIPES CROSSING A GLYPH,
 * so no assertion could have caught it.
 *
 * Counting elements proves nothing about whether anything is drawn.
 *
 *   npm run build && npx playwright test tests/review/ruler-and-spotlight.spec.ts
 *
 * Excluded from `npm run test:e2e` by `testIgnore` in playwright.config.ts.
 */

const OUT = 'test-results/review-003';

const VIEWPORTS = [
  { name: '360', width: 360, height: 780 },
  { name: 'desktop', width: 1280, height: 900 },
] as const;

/** Greyscale, so a colour-only cue is exposed rather than assumed absent. */
const GREYSCALE = 'html { filter: grayscale(1) !important; }';

for (const viewport of VIEWPORTS) {
  test(`003 review shots at ${viewport.name}`, async ({ page }) => {
    test.setTimeout(120_000);

    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.addInitScript(installFakeHost);
    await page.goto('/');
    await page.waitForSelector('[role="gridcell"]');

    const call = (name: string, args: Record<string, unknown> = {}) =>
      page.evaluate(
        ([n, a]) =>
          (window as unknown as { call: (n: string, a: object) => Promise<unknown> }).call(
            n as string,
            a as object,
          ),
        [name, args] as const,
      );

    const shot = async (label: string) => {
      await page.screenshot({ path: `${OUT}/${viewport.name}-${label}.png`, fullPage: true });
    };

    // 1. The board as it ships today. The ruler-hidden state must be
    //    byte-identical to this, so this is the reference.
    await shot('01-baseline');

    // 2. The coordinate ruler (US1). Read this one for LEGIBILITY at 360px and
    //    for whether the board is still usable, not for whether labels exist.
    await call('show_coordinate_ruler', {
      explanation: 'Numbering the grid so you can name a cell without counting squares.',
    });
    await shot('02-ruler-shown');

    // 3. The learner's own crosshair and the agent's spotlight ON SCREEN
    //    TOGETHER (US2). This is the pair that must stay tellable apart.
    //    The learner is parked far from where the agent is about to act.
    await page.locator('[data-index="65"]').click();
    await shot('03-learner-crosshair');

    const empty = await page.evaluate(() => {
      const cells = document.querySelectorAll('[role="gridcell"]');
      for (let i = 0; i < cells.length; i++) {
        if (!cells[i]!.textContent?.trim()) return { row: Math.floor(i / 9) + 1, col: (i % 9) + 1 };
      }
      return null;
    });

    if (empty) {
      await call('fill_cell', {
        row: empty.row,
        col: empty.col,
        digit: 9,
        explanation: 'Only a 9 fits here - every other digit already appears in this box.',
      });
      await shot('04-spotlight-with-learner-crosshair');

      // 4. The same frame with no colour at all. If the two markings are only
      //    distinguishable by hue, THIS is where it shows.
      await page.addStyleTag({ content: GREYSCALE });
      await shot('05-spotlight-greyscale');
      await page.reload();
      await page.waitForSelector('[role="gridcell"]');
    }

    // 5. Ruler removed -- must return to the baseline exactly.
    await call('hide_coordinate_ruler', {
      explanation: 'Taking the row and column guides away again now you have the hang of it.',
    });
    await shot('06-ruler-hidden-again');

    console.log(`\nScreenshots written to ${OUT}/ -- now LOOK at them.`);
  });
}
