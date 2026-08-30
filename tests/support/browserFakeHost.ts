/**
 * The page-side fake WebMCP host, for Playwright.
 *
 * This function is stringified by `page.addInitScript` and evaluated in the page
 * BEFORE any application script runs -- which is the whole point. The site
 * feature-detects `document.modelContext` at module evaluation, so a host that
 * appears afterwards is never seen. That is correct behaviour (FR-013), not a
 * bug to work around, and it is why a console-pasted fake cannot work.
 *
 * It must therefore be entirely SELF-CONTAINED: no imports, no closure over
 * anything outside its own body.
 *
 * It mirrors tests/support/fakeModelContext.ts, which is the Node-side
 * implementation that tests/unit/fakeModelContext.test.ts pins to the IDL. Two
 * implementations exist because one runs in a page and one does not; any drift
 * between them shows up as a disagreement between the contract tests and the
 * end-to-end tests.
 */
export function installFakeHost(): void {
  const tools = new Map<string, Record<string, unknown>>();

  class FakeModelContext extends EventTarget {
    async registerTool(
      tool: Record<string, unknown>,
      options: { signal?: AbortSignal } = {},
    ): Promise<undefined> {
      const name = tool?.name as string;
      if (typeof name !== 'string' || !/^[A-Za-z0-9_.-]{1,128}$/.test(name)) {
        throw new DOMException(`invalid tool name: ${String(name)}`, 'SyntaxError');
      }
      if (tools.has(name)) {
        throw new DOMException(`tool ${name} is already registered`, 'InvalidStateError');
      }
      if (options.signal?.aborted) return undefined;

      tools.set(name, tool);
      this.dispatchEvent(new Event('toolchange'));

      options.signal?.addEventListener(
        'abort',
        () => {
          if (tools.get(name) === tool) {
            tools.delete(name);
            this.dispatchEvent(new Event('toolchange'));
          }
        },
        { once: true },
      );
      return undefined;
    }

    async getTools(): Promise<Record<string, unknown>[]> {
      return [...tools.values()].map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: {
          readOnlyHint:
            (tool.annotations as Record<string, unknown> | undefined)?.readOnlyHint ?? false,
          untrustedContentHint:
            (tool.annotations as Record<string, unknown> | undefined)?.untrustedContentHint ?? false,
        },
        origin: window.location.origin,
      }));
    }

    async executeTool(
      tool: { name: string },
      input: object = {},
      options: { signal?: AbortSignal } = {},
    ): Promise<string> {
      const registered = tools.get(tool?.name);
      if (!registered) {
        throw new DOMException(`no tool named ${String(tool?.name)}`, 'NotFoundError');
      }

      const controller = new AbortController();
      if (options.signal) {
        if (options.signal.aborted) controller.abort();
        else options.signal.addEventListener('abort', () => controller.abort(), { once: true });
      }

      let value: unknown;
      try {
        value = await (registered.execute as (i: object, o: object) => Promise<unknown>)(input, {
          signal: controller.signal,
        });
      } catch {
        // The reason is destroyed here, exactly as the standard specifies.
        throw new DOMException('tool execution failed', 'UnknownError');
      }
      return JSON.stringify(value);
    }
  }

  Object.defineProperty(document, 'modelContext', {
    value: new FakeModelContext(),
    configurable: true,
    writable: false,
  });

  /**
   * The reviewer's console helper, matching the snippet in quickstart.md so both
   * review paths are driven with identical calls. Test-only: it is injected by
   * Playwright and exists in no shipped bundle.
   */
  (window as unknown as Record<string, unknown>).call = async (name: string, args: object = {}) => {
    const mc = document.modelContext!;
    const found = (await mc.getTools()).find((t) => t.name === name);
    if (!found) throw new Error(`no tool named ${name}`);
    return JSON.parse(await mc.executeTool(found, args));
  };
}
