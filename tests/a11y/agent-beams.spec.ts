import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openWithAgent, callTool } from '../support/agentPage';

/**
 * FR-035 and FR-061 for beams.
 *
 * The greyscale claim is structural rather than chromatic: a beam is a LINE and
 * the learner's highlighting is a FILL, so they stay separable with all colour
 * removed. The reduced-motion claim is about the draw-in sweep -- which exists
 * because a ray that grows along its unit shows the DIRECTION of the constraint,
 * and is exactly the kind of motion FR-061 says to drop on request.
 */

const EXPLANATION = 'Row 3 and column 7 already contain a six, so their intersection cannot take one.';

const drawBeams = (page: Page) =>
  callTool(page, 'draw_constraint_beams', {
    beams: [
      { unit_type: 'row', unit_number: 3, digit: 6 },
      { unit_type: 'col', unit_number: 7, digit: 6 },
    ],
    explanation: EXPLANATION,
  });

test('axe finds no violation with beams on screen', async ({ page }) => {
  await openWithAgent(page);
  await drawBeams(page);

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('beams survive greyscale as lines against fills', async ({ page }) => {
  await openWithAgent(page);
  await drawBeams(page);
  await page.locator('[data-index="40"]').click();
  await page.addStyleTag({ content: 'html { filter: grayscale(1) !important; }' });

  const beam = await page
    .locator('[data-agent-beam="row"]')
    .first()
    .evaluate((el) => ({
      borderStyle: getComputedStyle(el).borderTopStyle,
      borderWidth: getComputedStyle(el).borderTopWidth,
    }));

  // A dashed 2px rule is a mark of a different KIND from a wash, and kind is
  // what survives when hue does not.
  expect(beam.borderStyle).toBe('dashed');
  expect(parseFloat(beam.borderWidth)).toBeGreaterThan(0);
});

test('no beam is focusable or announced as an element', async ({ page }) => {
  await openWithAgent(page);
  await drawBeams(page);

  const layer = page.getByTestId('annotation-layer');
  expect(await layer.getAttribute('aria-hidden')).toBe('true');
  expect(await layer.locator('[tabindex], button, a').count()).toBe(0);
});

test.describe('with reduced motion requested', () => {
  test('beams appear at their final state, with no sweep (FR-061)', async ({ page }) => {
    // Emulated per-test rather than via test.use, which this Playwright version
    // does not apply to the context here -- the same note 001's
    // reduced-motion.spec.ts carries.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openWithAgent(page);
    await drawBeams(page);

    const beams = page.locator('[data-agent-beam="row"]');
    await expect(beams).toHaveCount(9);

    // The sweep class is not applied at all: the store carries reducedMotion as
    // a VALUE, published by the View, so the decision is made once and not by a
    // media query inside the tools layer.
    const classes = await beams.first().getAttribute('class');
    expect(classes).not.toContain('agent-beam-row');

    // And the beam is fully drawn, not mid-animation.
    const transform = await beams.first().evaluate((el) => getComputedStyle(el).transform);
    expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(transform);
  });
});

test.describe('with motion allowed', () => {
  test('the beam sweeps in, showing the direction of the constraint', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await openWithAgent(page);
    await drawBeams(page);

    const classes = await page.locator('[data-agent-beam="row"]').first().getAttribute('class');
    expect(classes).toContain('agent-beam-row');
  });
});
