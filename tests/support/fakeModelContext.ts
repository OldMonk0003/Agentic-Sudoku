/**
 * A deliberately strict, spec-conformant stand-in for `document.modelContext`.
 *
 * Written from the published WebMCP IDL, not from what is convenient
 * (specs/002-webmcp-agent-tutor/research.md R1):
 *
 *   Promise<undefined>                 registerTool(tool, options)
 *   Promise<sequence<RegisteredTool>>  getTools(options)
 *   Promise<DOMString>                 executeTool(tool, inputObject, options)
 *
 * Three behaviours are modelled precisely because our production code depends
 * on them being true:
 *
 *   1. `registerTool` REJECTS a duplicate name with InvalidStateError -- so
 *      registration is not natively idempotent and needs our own guard.
 *   2. Teardown is an AbortSignal. There is no `unregisterTool`.
 *   3. `executeTool` resolves to a JSON STRING, and a rejected handler collapses
 *      into an opaque UnknownError -- which is why no handler of ours may throw.
 *
 * If this fake is laxer than the standard, our code will quietly depend on the
 * laxity. tests/unit/fakeModelContext.test.ts is what stops that.
 */

export interface FakeToolAnnotations {
  readonly readOnlyHint: boolean;
  readonly untrustedContentHint: boolean;
}

export interface FakeModelContextTool {
  readonly name: string;
  readonly title?: string;
  readonly description: string;
  readonly inputSchema?: object;
  readonly annotations?: Partial<FakeToolAnnotations>;
  execute(input: object, options: { signal: AbortSignal }): Promise<unknown>;
}

export interface FakeRegisteredTool {
  readonly name: string;
  readonly title?: string;
  readonly description: string;
  readonly inputSchema?: object;
  readonly annotations: FakeToolAnnotations;
  readonly origin: string;
}

export interface FakeModelContext extends EventTarget {
  registerTool(tool: FakeModelContextTool, options?: { signal?: AbortSignal }): Promise<undefined>;
  getTools(): Promise<FakeRegisteredTool[]>;
  executeTool(tool: { name: string }, input?: object, options?: { signal?: AbortSignal }): Promise<string>;
}

/** The standard's own name rule: 1-128 chars of [A-Za-z0-9_.-]. */
const NAME_PATTERN = /^[A-Za-z0-9_.-]{1,128}$/;

class FakeModelContextImpl extends EventTarget implements FakeModelContext {
  readonly #tools = new Map<string, FakeModelContextTool>();
  readonly #origin: string;

  constructor(origin: string) {
    super();
    this.#origin = origin;
  }

  async registerTool(
    tool: FakeModelContextTool,
    options: { signal?: AbortSignal } = {},
  ): Promise<undefined> {
    if (!tool || typeof tool.name !== 'string' || !NAME_PATTERN.test(tool.name)) {
      throw new DOMException(`invalid tool name: ${String(tool?.name)}`, 'SyntaxError');
    }
    if (typeof tool.description !== 'string' || tool.description.length === 0) {
      throw new DOMException(`tool ${tool.name} has no description`, 'SyntaxError');
    }
    if (typeof tool.execute !== 'function') {
      throw new DOMException(`tool ${tool.name} has no execute callback`, 'SyntaxError');
    }
    if (this.#tools.has(tool.name)) {
      throw new DOMException(`tool ${tool.name} is already registered`, 'InvalidStateError');
    }

    // An already-aborted signal means the registration is over before it began.
    if (options.signal?.aborted) return undefined;

    this.#tools.set(tool.name, tool);
    this.dispatchEvent(new Event('toolchange'));

    options.signal?.addEventListener(
      'abort',
      () => {
        // Remove exactly this registration, not merely the name -- a later
        // re-registration under the same name must survive an older abort.
        if (this.#tools.get(tool.name) === tool) {
          this.#tools.delete(tool.name);
          this.dispatchEvent(new Event('toolchange'));
        }
      },
      { once: true },
    );

    return undefined;
  }

  async getTools(): Promise<FakeRegisteredTool[]> {
    return [...this.#tools.values()].map((tool) => ({
      name: tool.name,
      ...(tool.title === undefined ? {} : { title: tool.title }),
      description: tool.description,
      ...(tool.inputSchema === undefined ? {} : { inputSchema: tool.inputSchema }),
      annotations: {
        readOnlyHint: tool.annotations?.readOnlyHint ?? false,
        untrustedContentHint: tool.annotations?.untrustedContentHint ?? false,
      },
      origin: this.#origin,
    }));
  }

  async executeTool(
    tool: { name: string },
    input: object = {},
    options: { signal?: AbortSignal } = {},
  ): Promise<string> {
    const registered = this.#tools.get(tool?.name);
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
      value = await registered.execute(input, { signal: controller.signal });
    } catch {
      // The reason is DESTROYED here, exactly as the standard specifies. This
      // single line is the whole argument for returning structured errors.
      throw new DOMException('tool execution failed', 'UnknownError');
    }

    return JSON.stringify(value);
  }
}

export function createFakeModelContext(origin = 'http://localhost'): FakeModelContext {
  return new FakeModelContextImpl(origin);
}

/**
 * Attach a fake host to a document, returning a teardown that restores it.
 *
 * `document.modelContext` is a readonly attribute on the real thing, so this
 * defines the property rather than assigning it.
 */
export function installFakeModelContext(
  target: object = globalThis.document,
): { context: FakeModelContext; uninstall(): void } {
  const context = createFakeModelContext();
  const existing = Object.getOwnPropertyDescriptor(target, 'modelContext');

  Object.defineProperty(target, 'modelContext', {
    value: context,
    configurable: true,
    writable: false,
  });

  return {
    context,
    uninstall() {
      if (existing) Object.defineProperty(target, 'modelContext', existing);
      else delete (target as Record<string, unknown>).modelContext;
    },
  };
}
