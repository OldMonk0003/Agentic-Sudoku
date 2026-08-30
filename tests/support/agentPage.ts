import type { Page } from '@playwright/test';
import { installFakeHost } from './browserFakeHost';

/**
 * Open the board with an agent host attached, and get a `call` helper.
 *
 * The host is installed with `addInitScript` so it exists BEFORE the client
 * bundle evaluates. The site feature-detects at module evaluation, so a host
 * that appears later is never seen -- correct behaviour (FR-013), and the reason
 * a console-pasted fake cannot work.
 */
export async function openWithAgent(page: Page) {
  await page.addInitScript(installFakeHost);
  await page.goto('/');
  await page.locator('[role="grid"][aria-busy="false"]').waitFor();
  await page.locator('[role="gridcell"][data-origin="clue"]').first().waitFor();
}

export interface ToolResult {
  ok: boolean;
  tool: string;
  surface_version: string;
  data?: Record<string, unknown>;
  error?: { code: string; message: string; details?: Record<string, unknown> };
}

/** Invoke a tool exactly as an agent would: through getTools + executeTool. */
export async function callTool(
  page: Page,
  name: string,
  args: Record<string, unknown> = {},
): Promise<ToolResult> {
  return page.evaluate(
    async ([toolName, input]) => {
      const mc = document.modelContext!;
      const tool = (await mc.getTools()).find((t) => t.name === toolName);
      if (!tool) throw new Error(`no tool named ${String(toolName)}`);
      return JSON.parse(await mc.executeTool(tool, input as object));
    },
    [name, args] as const,
  );
}

export async function toolNames(page: Page): Promise<string[]> {
  return page.evaluate(async () => (await document.modelContext!.getTools()).map((t) => t.name));
}

/** A snapshot of everything an annotation must leave alone (FR-034). */
export async function boardFingerprint(page: Page): Promise<string> {
  return page.evaluate(() => {
    const cells = [...document.querySelectorAll('[role="gridcell"]')].map((cell) => ({
      text: cell.textContent,
      origin: cell.getAttribute('data-origin'),
    }));
    const timer = document.querySelector('[data-testid="timer"]')?.textContent ?? '';
    const undoDisabled = document
      .querySelector('button[aria-label="Undo"]')
      ?.hasAttribute('disabled');
    return JSON.stringify({ cells, timer, undoDisabled });
  });
}
