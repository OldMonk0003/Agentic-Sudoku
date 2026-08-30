import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openWithAgent, callTool } from '../support/agentPage';

/**
 * SC-004 and SC-011 for a written change: the learner must be able to tell who
 * placed a digit without interacting, including in greyscale and under colour
 * vision deficiency -- and a screen-reader learner must be told, without focus
 * moving.
 *
 * Agent digits share --color-ink-player deliberately (001's palette research
 * found a third ink could not clear 4.5:1 on every wash tier), so the whole
 * distinction rests on FORM: italic type plus a sage corner glyph. Which makes
 * these the tests that actually carry FR-044.
 */

const EXPLANATION = 'Only 7 can go here, because the other eight digits already appear in this box.';

/** Approximate a colour-vision deficiency by collapsing the relevant channels. */
const CVD_FILTERS: Record<string, string> = {
  greyscale: 'grayscale(1)',
  protanopia: 'url(#protanopia)',
  achromatopsia: 'grayscale(1) contrast(1.2)',
};

async function fillOne(page: Page) {
  const index = Number(
    await page.locator('[role="gridcell"][data-origin="empty"]').first().getAttribute('data-index'),
  );
  await callTool(page, 'fill_cell', {
    row: Math.floor(index / 9) + 1,
    col: (index % 9) + 1,
    digit: 7,
    explanation: EXPLANATION,
  });
  return index;
}

test.beforeEach(async ({ page }) => {
  await openWithAgent(page);
});

test('axe finds no violation with an agent digit and its explanation on screen', async ({ page }) => {
  await fillOne(page);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('the fill is announced politely and focus never moves (SC-011)', async ({ page }) => {
  // Park the learner on a cell first, so there is a focus to lose.
  const cells = page.locator('[role="gridcell"][data-origin="empty"]');
  const parkedIndex = await cells.nth(1).getAttribute('data-index');
  await page.locator(`[data-index="${parkedIndex}"]`).click();

  const before = await page.evaluate(() => document.activeElement?.getAttribute('data-index'));
  await fillOne(page);
  const after = await page.evaluate(() => document.activeElement?.getAttribute('data-index'));

  expect(after).toBe(before);

  const queue = page.getByTestId('explanation-queue');
  expect(await queue.getAttribute('aria-live')).toBe('polite');
  await expect(queue).toContainText(EXPLANATION);
});

test('the cell says who placed the digit (FR-060)', async ({ page }) => {
  const index = await fillOne(page);
  const label = await page.locator(`[data-index="${index}"]`).getAttribute('aria-label');

  expect(label).toContain('placed by agent');
});

test.describe('authorship survives colour removal (SC-004)', () => {
  for (const [name, filter] of Object.entries(CVD_FILTERS)) {
    test(`agent, learner, and clue stay distinguishable under ${name}`, async ({ page }) => {
      const agentIndex = await fillOne(page);

      // A learner digit too, so all three authorships are on the board at once.
      const learnerIndex = await page
        .locator('[role="gridcell"][data-origin="empty"]')
        .first()
        .getAttribute('data-index');
      await page.locator(`[data-index="${learnerIndex}"]`).click();
      await page.keyboard.press('4');

      await page.addStyleTag({ content: `html { filter: ${filter} !important; }` });

      const styleOf = (index: string | number) =>
        page.locator(`[data-index="${index}"]`).evaluate((el) => ({
          fontStyle: getComputedStyle(el).fontStyle,
          fontWeight: getComputedStyle(el).fontWeight,
          glyph: el.querySelector('[data-agent-placed]') !== null,
        }));

      const agent = await styleOf(agentIndex);
      const learner = await styleOf(learnerIndex!);
      const clue = await styleOf(
        (await page.locator('[role="gridcell"][data-origin="clue"]').first().getAttribute('data-index'))!,
      );

      // The agent: italic AND a glyph. Nobody else has either.
      expect(agent.fontStyle).toBe('italic');
      expect(agent.glyph).toBe(true);
      expect(learner.fontStyle).toBe('normal');
      expect(learner.glyph).toBe(false);
      expect(clue.fontStyle).toBe('normal');
      expect(clue.glyph).toBe(false);

      // And the clue is heavier than the learner's own entry.
      expect(Number(clue.fontWeight)).toBeGreaterThan(Number(learner.fontWeight));
    });
  }
});

test('the learner keeps typing through an agent write (SC-007)', async ({ page }) => {
  const index = await page
    .locator('[role="gridcell"][data-origin="empty"]')
    .nth(2)
    .getAttribute('data-index');
  const cell = page.locator(`[data-index="${index}"]`);
  await cell.click();

  await fillOne(page);
  await page.keyboard.press('6');

  await expect(cell).toHaveText('6');
});
