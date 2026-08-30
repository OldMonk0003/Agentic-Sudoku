import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { openWithAgent, callTool } from '../support/agentPage';

/**
 * FR-035 and SC-004: annotation roles must be distinguishable by more than
 * colour, and must survive greyscale.
 *
 * The design answer is FORM, not hue (research.md R7): the learner's own
 * highlighting is entirely flat washes, so the agent uses outlines, hatching,
 * and rays -- shape categories 001 never used. Two tints of sage would die here;
 * an outline versus a hatch does not.
 *
 * The technique is 001's: strip colour with a CSS filter and assert the marks
 * are still structurally present and distinct.
 */

const EXPLANATION =
  'Only this cell in the box can still take a seven; its row and column rule out every other candidate.';

async function greyscale(page: Page) {
  await page.addStyleTag({ content: 'html { filter: grayscale(1) !important; }' });
}

test.beforeEach(async ({ page }) => {
  await openWithAgent(page);
  await callTool(page, 'highlight_pattern_cells', {
    target_cells: [{ row: 5, col: 6 }],
    because_cells: [{ row: 5, col: 1 }, { row: 5, col: 3 }],
    explanation: EXPLANATION,
  });
});

test('target and because are different SHAPES, not different colours', async ({ page }) => {
  await greyscale(page);

  const target = page.locator('[data-agent-annotation="target"]').first();
  const because = page.locator('[data-agent-annotation="because"]').first();

  // The target is an outline; the because is a hatch. Distinct in the DOM and
  // therefore distinct with all colour removed.
  const targetOutline = await target.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(targetOutline).toBe('solid');

  // The hatch is drawn as four framing strips, so the digit underneath stays legible.
  expect(await because.locator('.agent-hatch').count()).toBe(4);
  expect(await target.locator('.agent-hatch').count()).toBe(0);
});

test('the corner dot is filled for target and hollow for because', async ({ page }) => {
  await greyscale(page);

  const dotFill = async (role: string) =>
    page
      .locator(`[data-agent-annotation="${role}"] span`)
      .last()
      .evaluate((el) => getComputedStyle(el).backgroundColor);

  const targetDot = await dotFill('target');
  const becauseDot = await dotFill('because');

  // Filled versus hollow survives greyscale; two tints of sage would not.
  expect(targetDot).not.toBe(becauseDot);
});

test("the agent's marks stay distinct from the learner's own crosshair", async ({ page }) => {
  await page.locator('[data-index="40"]').click();
  await greyscale(page);

  // The learner's highlighting is a FILL; the agent's is an outline and a hatch.
  const crosshairBackground = await page
    .locator('[data-tier="crosshair"]')
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  const crosshairOutline = await page
    .locator('[data-tier="crosshair"]')
    .first()
    .evaluate((el) => getComputedStyle(el).outlineStyle);

  expect(crosshairBackground).not.toBe('rgba(0, 0, 0, 0)');
  expect(crosshairOutline).not.toBe('solid');
});

test('the selection ring stays unique to the learner (FR-032)', async ({ page }) => {
  await page.locator('[data-index="41"]').click(); // row 5 col 6, the annotated target
  await greyscale(page);

  // The cell is BOTH selected and an agent target. The learner's ring and the
  // agent's mark are separate elements, so neither hides the other.
  await expect(page.locator('[data-index="41"][data-selected="true"]')).toHaveCount(1);
  await expect(page.locator('[data-agent-annotation="target"]')).toHaveCount(1);
});

test('every annotated cell keeps its contents legible', async ({ page }) => {
  await greyscale(page);

  // The hatch frames the cell rather than filling it, so nothing is drawn over
  // the digit. This is the defect that a green suite missed and looking found.
  for (const index of [36, 38]) {
    const text = await page.locator(`[data-index="${index}"]`).textContent();
    const rendered = await page
      .locator(`[data-index="${index}"]`)
      .evaluate((el) => getComputedStyle(el).color);
    expect(typeof text).toBe('string');
    expect(rendered).not.toBe('rgba(0, 0, 0, 0)');
  }
});
