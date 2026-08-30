import { test, expect } from '@playwright/test';
import { openWithAgent, callTool, boardFingerprint } from '../support/agentPage';

/**
 * User Story 3 end to end: "Ask the agent to justify one elimination. Confirm
 * beams appear along the correct lines, are distinguishable from the crosshair
 * highlighting of feature 001, and clear on request."
 */

const EXPLANATION = 'Row 3 and column 7 already contain a six, so their intersection cannot take one.';

test.beforeEach(async ({ page }) => {
  await openWithAgent(page);
});

test('draw_constraint_beams is registered in the browser', async ({ page }) => {
  const names = await page.evaluate(async () =>
    (await document.modelContext!.getTools()).map((t) => t.name),
  );
  expect(names).toContain('draw_constraint_beams');
});

test('a row beam spans its row and a column beam spans its column', async ({ page }) => {
  const result = await callTool(page, 'draw_constraint_beams', {
    beams: [
      { unit_type: 'row', unit_number: 3, digit: 6 },
      { unit_type: 'col', unit_number: 7, digit: 6 },
    ],
    explanation: EXPLANATION,
  });
  expect(result.ok).toBe(true);

  // Nine cells each: the ray spans the whole unit.
  await expect(page.locator('[data-agent-beam="row"]')).toHaveCount(9);
  await expect(page.locator('[data-agent-beam="col"]')).toHaveCount(9);
});

test('crossing beams remain individually discernible (FR-029)', async ({ page }) => {
  await callTool(page, 'draw_constraint_beams', {
    beams: [
      { unit_type: 'row', unit_number: 3 },
      { unit_type: 'col', unit_number: 7 },
    ],
    explanation: EXPLANATION,
  });

  // Index = (row - 1) * 9 + (col - 1). Row 3, column 7 -> 24: where the two rays
  // cross. BOTH are present there, running in different directions, so neither
  // hides the other -- which is the claim FR-029 actually makes.
  const both = await page.evaluate(() => {
    const layer = document.querySelector('[data-testid="annotation-layer"]')!;
    const cellSpan = layer.children[24]!;
    return {
      row: cellSpan.querySelector('[data-agent-beam="row"]') !== null,
      col: cellSpan.querySelector('[data-agent-beam="col"]') !== null,
    };
  });
  expect(both).toEqual({ row: true, col: true });
});

test('a box beam frames the box rather than drawing a line', async ({ page }) => {
  await callTool(page, 'draw_constraint_beams', {
    beams: [{ unit_type: 'box', unit_number: 1 }],
    explanation: EXPLANATION,
  });

  // A box is an area, not a line: nine framed cells.
  await expect(page.locator('[data-agent-beam="box"]')).toHaveCount(9);
});

test('beams change nothing on the board', async ({ page }) => {
  const before = await boardFingerprint(page);
  await callTool(page, 'draw_constraint_beams', {
    beams: [{ unit_type: 'row', unit_number: 3 }],
    explanation: EXPLANATION,
  });
  expect(await boardFingerprint(page)).toBe(before);
});

test("the learner's crosshair still works and stays distinguishable (FR-032)", async ({ page }) => {
  await callTool(page, 'draw_constraint_beams', {
    beams: [{ unit_type: 'row', unit_number: 3 }],
    explanation: EXPLANATION,
  });

  await page.locator('[data-index="40"]').click();

  // Theirs is a wash; the agent's is a dashed line. Different kinds of mark.
  const crosshairBackground = await page
    .locator('[data-tier="crosshair"]')
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  const beamStyle = await page
    .locator('[data-agent-beam="row"]')
    .first()
    .evaluate((el) => getComputedStyle(el).borderTopStyle);

  expect(crosshairBackground).not.toBe('rgba(0, 0, 0, 0)');
  expect(beamStyle).toBe('dashed');
});

test('beams clear on request, along with the other marks', async ({ page }) => {
  await callTool(page, 'draw_constraint_beams', {
    beams: [{ unit_type: 'row', unit_number: 3 }],
    explanation: EXPLANATION,
  });
  await expect(page.locator('[data-agent-beam="row"]')).toHaveCount(9);

  await callTool(page, 'clear_visual_annotations', {
    explanation: 'Clearing my beams so we can look at the next constraint with fresh eyes.',
  });
  await expect(page.locator('[data-agent-beam]')).toHaveCount(0);
});
