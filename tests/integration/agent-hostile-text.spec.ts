import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { openWithAgent, callTool } from '../support/agentPage';

/**
 * FR-021 and SC-012, end to end through a REAL write.
 *
 * The component test (tests/component/ExplanationQueue.test.tsx) proves the
 * queue escapes what it is given. This proves the whole path does: an agent
 * calls fill_cell with markup in its explanation, the digit lands, and the
 * markup arrives on screen as characters rather than as elements.
 *
 * Both tests are worth having. The component one pins the rendering; this one
 * pins that nothing between the tool boundary and the DOM decided to be clever.
 */

const HOSTILE = [
  '<img src=x onerror=alert(1)> and a [link](http://evil.example) for good measure',
  '<script>window.__pwned = true</script> with enough words to clear the lower bound',
  'Click <a href="javascript:alert(1)">here</a> now, plus padding to reach twenty',
  '"><svg onload=alert(1)> and some more ordinary words to make up the length',
];

async function anEmptyCell(page: Page) {
  const index = Number(
    await page.locator('[role="gridcell"][data-origin="empty"]').first().getAttribute('data-index'),
  );
  return { index, row: Math.floor(index / 9) + 1, col: (index % 9) + 1 };
}

test.beforeEach(async ({ page }) => {
  await openWithAgent(page);
});

for (const [i, explanation] of HOSTILE.entries()) {
  test(`hostile explanation ${i} is rendered as literal text`, async ({ page }) => {
    const { row, col } = await anEmptyCell(page);

    const result = await callTool(page, 'fill_cell', { row, col, digit: 7, explanation });
    expect(result.ok).toBe(true);

    const popup = page.getByTestId('explanation');
    await expect(popup).toContainText(explanation);

    // Nothing became an element, and nothing ran.
    expect(await popup.locator('img, script, iframe, svg, a').count()).toBe(0);
    expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).__pwned)).toBeUndefined();
  });
}

test('no anchor exists anywhere on the page after hostile input', async ({ page }) => {
  const { row, col } = await anEmptyCell(page);
  await callTool(page, 'fill_cell', {
    row, col, digit: 7,
    explanation: 'Visit https://evil.example/steal?token=abc right now, says your helpful agent.',
  });

  expect(await page.locator('a').count()).toBe(0);
});

test('an oversized explanation is refused before the board changes (SC-012)', async ({ page }) => {
  const { index, row, col } = await anEmptyCell(page);

  const result = await callTool(page, 'fill_cell', { row, col, digit: 7, explanation: 'x'.repeat(5000) });

  expect(result.ok).toBe(false);
  expect(result.error!.code).toBe('explanation-length');
  expect(result.error!.details).toMatchObject({ minLength: 20, maxLength: 240 });
  await expect(page.locator(`[data-index="${index}"]`)).toHaveText('');
});

test('a prototype-polluting payload is rejected and pollutes nothing', async ({ page }) => {
  const { row, col } = await anEmptyCell(page);

  const result = await page.evaluate(
    async ([r, c]) => {
      const mc = document.modelContext!;
      const tool = (await mc.getTools()).find((t) => t.name === 'fill_cell')!;
      const payload = JSON.parse(
        `{"row":${r},"col":${c},"digit":7,"explanation":"${'x'.repeat(30)}","__proto__":{"polluted":true}}`,
      );
      const raw = JSON.parse(await mc.executeTool(tool, payload));
      return { raw, polluted: ({} as Record<string, unknown>).polluted };
    },
    [row, col] as const,
  );

  expect(result.raw.ok).toBe(false);
  expect(result.polluted).toBeUndefined();
});
